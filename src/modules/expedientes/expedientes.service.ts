import {
  Injectable, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Accasamblea } from '../acreditacion/entities/accasamblea.entity';
import { AccasambleaHis } from '../acreditacion/entities/accasamblea-his.entity';
import { AsambleaActual } from '../asambleas/entities/asamblea-actual.entity';
import { Accionista } from '../accionistas/entities/accionista.entity';
import { ImprimirCredencialDto, RegistrarMotivoRechazoDto } from '../acreditacion/dto/acreditacion.dto';

/** Estado denegado (variables.estado_denegado en Oracle Forms) */
const ESTADO_DENEGADO = 10;
const ESTADO_CRED_EMITIR = 6;
const ESTADO_CRED_ENTREGADA = 8;
const ESTADO_RECIBIDO = 2;
const ESTADO_ENTREGADO = 1;

/**
 * ExpedientesService
 *
 * Gestiona las operaciones específicas del módulo ACCFRM0080:
 *   - Imprimir Formulario + Constancia (BTT_EXPEDIENTE / R9)
 *   - Imprimir Credencial (BTN_CREDENCIAL / R10) con sus 3 escenarios
 *   - Registrar Motivo de Rechazo (ITEM538 / R11)
 *   - Asociar votos propios/ajenos (BTT_ASOCIAR1/2 / R8)
 */
@Injectable()
export class ExpedientesService {
  private readonly logger = new Logger(ExpedientesService.name);
  private readonly MESES_VIGENCIA = parseInt(
    process.env.MESES_VIGENCIA_ACCIONISTA || '18', 10,
  );

  constructor(
    @InjectRepository(Accasamblea)
    private readonly expRepo: Repository<Accasamblea>,
    @InjectRepository(AccasambleaHis)
    private readonly hisRepo: Repository<AccasambleaHis>,
    @InjectRepository(AsambleaActual)
    private readonly asambleaRepo: Repository<AsambleaActual>,
    @InjectRepository(Accionista)
    private readonly accionistaRepo: Repository<Accionista>,
    private readonly dataSource: DataSource,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  // R9 — BTT_EXPEDIENTE: Imprimir Formulario + Constancia
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Equivale al WHEN-BUTTON-PRESSED de BTT_EXPEDIENTE en ACCFRM0080.
   *
   * Pasos:
   *   1. Obtiene TRUNC(fecha_actu) de AC.ACCACCIONISTA
   *   2. AC_PKG_INFO_ACCIONISTA.ac_fnc_meses_vencimiento_act(fecha_actu)
   *      Si venció → error 301
   *   3. Si estado = 1 (Entregado) → UPDATE estado a 2 (Recibido)
   *      fecha_recibido = SYSDATE si era null
   *   4. Genera registro de impresión (accrep0806 + accrep0185)
   *      En el backend: retorna metadata del formulario para que el cliente imprima
   */
  async imprimirFormularioConstancia(
    tipoAsamblea: string,
    asamblea: string,
    expediente: number,
    tipoDocemitido: number,
    autorizaAntecedentes: string,
    usuarioImpresion: string,
  ) {
    const exp = await this.expRepo.findOne({
      where: { tipoAsamblea, asamblea, expediente, tipoDocemitido },
    });
    if (!exp) {
      throw new NotFoundException(`105: Expediente ${expediente} no encontrado.`);
    }

    // Validar vigencia del accionista
    const acc = await this.accionistaRepo.findOne({
      where: { accionista: exp.accionista },
      select: ['accionista', 'fechaActu'],
    });
    this.validarVigencia(acc?.fechaActu ?? null, exp.accionista);

    // Si estado = 1 → cambiar a 2 (RECIBIDO)
    const ahora = new Date();
    const actualizaciones: Partial<Accasamblea> = {
      usuarioActu: usuarioImpresion,
      fechaActu:   ahora,
    };

    if (exp.estadoExpediente === ESTADO_ENTREGADO) {
      actualizaciones.estadoExpediente = ESTADO_RECIBIDO;
      actualizaciones.fechaRecibido    = ahora;
      actualizaciones.fechaCambioestado = ahora;
    }

    // UPDATE autoriza_antecedentes (P_IMPRIMIR_EXPEDIENTE lo hace en Oracle)
    actualizaciones.autorizaAntecedentes = autorizaAntecedentes;

    await this.expRepo.update(
      { tipoAsamblea, asamblea, expediente, tipoDocemitido },
      actualizaciones,
    );

    this.logger.log(
      `BTT_EXPEDIENTE — Formulario impreso: expediente ${expediente} asamblea ${asamblea} por ${usuarioImpresion}`,
    );

    return {
      expediente,
      asamblea,
      accionista:       exp.accionista,
      estadoAnterior:   exp.estadoExpediente,
      estadoNuevo:      actualizaciones.estadoExpediente ?? exp.estadoExpediente,
      fechaRecibido:    actualizaciones.fechaRecibido?.toISOString() ?? null,
      // Metadata para impresión (el cliente consume accrep0806 + accrep0185)
      reportes: [
        {
          codigo:      'accrep0806',
          descripcion: 'Formulario de Participación en Asamblea',
          parametros:  { expediente, tipoAsamblea, asamblea, tipoDocemitido },
        },
        {
          codigo:      'accrep0185',
          descripcion: 'Constancia de Acreditación',
          parametros:  { expediente, tipoAsamblea, asamblea, tipoDocemitido },
        },
      ],
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // R10 — BTN_CREDENCIAL: Imprimir Credencial con sus 3 escenarios
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Equivale al WHEN-BUTTON-PRESSED de BTN_CREDENCIAL en ACCFRM0080.
   *
   * Variables Oracle:
   *   pn_estado_aimprimir = 6 (Credencial a Emitir)
   *   pn_estado_entregada = 8 (Credencial Entregada)
   *
   * Escenarios:
   *   A. Estado 6/8 + en rango fechas + primera vez → impresión libre
   *      ACC_DESCTRX_ACCIONES → votos_propios; estado → 8; ESTADO_IMPRESION = 'S'
   *   B. Estado 6/8 + en rango + ESTADO_IMPRESION='S' (reimpresión)
   *      → Error 703 + requiere AUTH REIMPRESION DE CREDENCIAL (ya validada en frontend)
   *      → ESTADO_REIMPRESION = 'S'
   *   C. Estado 6/8 + FUERA de rango
   *      → Error 702 + requiere AUTH CREDENCIAL FUERA DE RANGO (ya validada en frontend)
   *      → ESTADO_REIMPRESION = 'S'
   *   D. Estado distinto a 6 u 8 → Error 701
   */
  async imprimirCredencial(
    tipoAsamblea: string,
    asamblea: string,
    expediente: number,
    tipoDocemitido: number,
    dto: ImprimirCredencialDto,
  ) {
    const exp = await this.expRepo.findOne({
      where: { tipoAsamblea, asamblea, expediente, tipoDocemitido },
    });
    if (!exp) {
      throw new NotFoundException(`105: Expediente ${expediente} no encontrado.`);
    }

    const estado = exp.estadoExpediente;

    // Paso C del Oracle Forms — estado debe ser 6 u 8
    if (estado !== ESTADO_CRED_EMITIR && estado !== ESTADO_CRED_ENTREGADA) {
      throw new BadRequestException(
        `701: No puede imprimir la credencial con estado: ${estado}. ` +
        `Requiere estado 6 (Credencial a Emitir) o 8 (Credencial Entregada).`,
      );
    }

    // Obtener asamblea para rangos de credencial
    const asambleaData = await this.asambleaRepo.findOne({
      where: { tipoAsamblea, asamblea },
    });

    // Determinar si está en el rango de fechas de credencial
    const ahora = new Date();
    const enRango = this.estaEnRangoCredencial(asambleaData, ahora);
    const esReimpresion = exp.estadoImpresion === 'S';

    const updates: Partial<Accasamblea> = {
      usuarioActu:       dto.usuarioImpresion,
      fechaActu:         ahora,
      usuarioEntregacred: dto.usuarioImpresion,
    };

    let escenario: 'primera' | 'reimpresion' | 'fuera_rango';

    if (enRango && !esReimpresion) {
      // ── Escenario A: Primera impresión ideal ─────────────────────────────
      escenario = 'primera';
      updates.estadoExpediente = ESTADO_CRED_ENTREGADA;
      updates.estadoImpresion  = 'S';
      updates.fechaCredencial  = ahora;
      updates.fechaCambioestado = ahora;
    } else if (enRango && esReimpresion) {
      // ── Escenario B: Reimpresión (AUTH ya validada en frontend) ──────────
      escenario = 'reimpresion';
      updates.estadoReimpresion = 'S';
      updates.fechaCredencial   = ahora;
    } else {
      // ── Escenario C: Fuera de rango (AUTH ya validada en frontend) ───────
      escenario = 'fuera_rango';
      if (!esReimpresion) updates.estadoImpresion = 'S';
      updates.estadoReimpresion = 'S';
      updates.fechaCredencial   = ahora;
    }

    await this.expRepo.update(
      { tipoAsamblea, asamblea, expediente, tipoDocemitido },
      updates,
    );

    this.logger.log(
      `BTN_CREDENCIAL [${escenario}] — credencial ${expediente} asamblea ${asamblea} por ${dto.usuarioImpresion}` +
      (dto.usuarioAutoriza ? ` (autoriza: ${dto.usuarioAutoriza})` : ''),
    );

    return {
      expediente,
      credencial:      exp.credencial,
      escenario,
      estadoNuevo:     updates.estadoExpediente ?? estado,
      estadoImpresion: updates.estadoImpresion ?? exp.estadoImpresion,
      estadoReimpresion: updates.estadoReimpresion ?? exp.estadoReimpresion,
      fechaCredencial: ahora.toISOString(),
      enRango,
      reporte: {
        codigo:      'accrep0806',
        descripcion: 'Credencial de Acreditación',
        parametros:  { expediente, credencial: exp.credencial, tipoAsamblea, asamblea },
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // R11 — ITEM538: Motivo de Rechazo (ACCASAMBLEA_DENEGADA)
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Registra el motivo de rechazo de un expediente.
   * Solo disponible cuando estado_expediente = 10 (DENEGADO).
   *
   * Validaciones (bloque PAGE_6 del Oracle Forms):
   *   - Error 704: estado ≠ 10 → no puede ir a sección de motivos
   *   - Error 705: código de motivo no existe
   *   - Error 708: motivo inactivo en AC_MOTIVO_RECHAZO_ASAMBLEA
   *   - Error 709: motivo ya registrado para este expediente
   */
  async registrarMotivoRechazo(
    tipoAsamblea: string,
    asamblea: string,
    expediente: number,
    tipoDocemitido: number,
    dto: RegistrarMotivoRechazoDto,
  ) {
    const exp = await this.expRepo.findOne({
      where: { tipoAsamblea, asamblea, expediente, tipoDocemitido },
    });
    if (!exp) {
      throw new NotFoundException(`105: Expediente ${expediente} no encontrado.`);
    }

    // Error 704: solo estado 10 (DENEGADO)
    if (exp.estadoExpediente !== ESTADO_DENEGADO) {
      throw new BadRequestException(
        `704: No es posible ir a la sección de Motivos de rechazo. ` +
        `Únicamente puede hacerlo con el estado: ${ESTADO_DENEGADO} - Denegado. ` +
        `Estado actual: ${exp.estadoExpediente}.`,
      );
    }

    // Validar motivo en AC_MOTIVO_RECHAZO_ASAMBLEA
    const rows: Array<{ estado_motivo: number }> = await this.dataSource.query(
      `SELECT ESTADO_MOTIVO FROM AC.AC_MOTIVO_RECHAZO_ASAMBLEA
        WHERE CODIGO_MOTIVO = :1`,
      [dto.codigoMotivo],
    );

    if (!rows.length) {
      throw new BadRequestException(
        `705: El código de Motivo de Rechazo no existe. Consulte la lista de valores.`,
      );
    }

    // Error 708: motivo inactivo
    if (rows[0].estado_motivo !== 1) {
      throw new BadRequestException(
        `708: El código de Motivo de Rechazo está INACTIVO. Favor verifique.`,
      );
    }

    // Error 709: verificar duplicado para este expediente
    const duplicado: Array<{ cnt: number }> = await this.dataSource.query(
      `SELECT COUNT(1) AS cnt FROM AC.ACCASAMBLEA_DENEGADA
        WHERE TIPO_ASAMBLEA = :1 AND ASAMBLEA = :2
          AND EXPEDIENTE = :3 AND CODIGO_MOTIVO = :4`,
      [tipoAsamblea, asamblea, expediente, dto.codigoMotivo],
    );
    if ((duplicado[0]?.cnt ?? 0) > 0) {
      throw new BadRequestException(
        `709: El código de Motivo de Rechazo ya fue ingresado para este expediente. Favor verifique.`,
      );
    }

    // INSERT en ACCASAMBLEA_DENEGADA
    await this.dataSource.query(
      `INSERT INTO AC.ACCASAMBLEA_DENEGADA
         (TIPO_ASAMBLEA, ASAMBLEA, EXPEDIENTE, TIPO_DOCEMITIDO, ACCIONISTA,
          CODIGO_MOTIVO, OBSERVACIONES, ESTADO_EXPEDIENTE, USUARIO_CREA, FECHA_CREA)
       VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, SYSDATE)`,
      [
        tipoAsamblea, asamblea, expediente, tipoDocemitido, exp.accionista,
        dto.codigoMotivo, dto.observaciones ?? null, ESTADO_DENEGADO, dto.usuarioCrea,
      ],
    );

    this.logger.log(
      `ITEM538 — Motivo ${dto.codigoMotivo} registrado para expediente ${expediente} asamblea ${asamblea}`,
    );

    return {
      expediente,
      asamblea,
      codigoMotivo:  dto.codigoMotivo,
      observaciones: dto.observaciones ?? null,
      registrado:    true,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // R8 — BTT_ASOCIAR: Validación para asociar votos
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Valida si el expediente puede asociar votos propios o ajenos.
   * Equivale a BTT_ASOCIAR1/2.WHEN-BUTTON-PRESSED de ACCFRM0080.
   *
   * Reglas:
   *   - tipo_docemitido > 1 → Error 160 (preferente no puede representar)
   *   - votos_propios + votos_ajenos >= 2000 → Error 114 (BTT_ASOCIAR1 bloquea)
   */
  async validarAsociarVotos(
    tipoAsamblea: string,
    asamblea: string,
    expediente: number,
    tipoDocemitido: number,
    tipoAsociacion: 'propios' | 'ajenos',
  ) {
    const exp = await this.expRepo.findOne({
      where: { tipoAsamblea, asamblea, expediente, tipoDocemitido },
      select: ['expediente', 'tipoDocemitido', 'votosPropios', 'votosAjenos'],
    });
    if (!exp) {
      throw new NotFoundException(`Expediente ${expediente} no encontrado.`);
    }

    // R8: preferente no puede representar/ser representado
    if (exp.tipoDocemitido > 1) {
      throw new BadRequestException(
        `160: Un expediente preferente no puede ser representante o representado.`,
      );
    }

    const totalActual = (exp.votosPropios ?? 0) + (exp.votosAjenos ?? 0);

    // R8: límite de 2000 acciones
    if (tipoAsociacion === 'propios' && totalActual >= 2000) {
      throw new BadRequestException(
        `114: Representante tiene registradas 2,000 acciones. No puede representar más accionistas.`,
      );
    }

    // Para ajenos: solo aviso (no bloquea según V.DIC-2010)
    return {
      puedeAsociar:    true,
      totalVotosActual: totalActual,
      aviso: tipoAsociacion === 'ajenos' && totalActual >= 2000
        ? `114: Representante tiene registradas ${totalActual} acciones. Acción continúa para votos ajenos.`
        : null,
    };
  }

  // ── Helper: verificar rango de fechas de credencial ──────────────────────
  private estaEnRangoCredencial(asamblea: AsambleaActual | null, hoy: Date): boolean {
    if (!asamblea?.fechaEntregaCredDesde || !asamblea?.fechaEntregaCredHasta) return false;
    const desde = new Date(asamblea.fechaEntregaCredDesde);
    const hasta = new Date(asamblea.fechaEntregaCredHasta);
    desde.setHours(0, 0, 0, 0);
    hasta.setHours(23, 59, 59, 999);
    const h = new Date(hoy);
    h.setHours(12, 0, 0, 0);
    return h >= desde && h <= hasta;
  }

  private validarVigencia(fechaActu: Date | null, accionista: string): void {
    if (!fechaActu) {
      throw new BadRequestException(
        `301: El accionista ${accionista} debe actualizar sus datos. Sin fecha de actualización.`,
      );
    }
    const meses = this.calcularMeses(fechaActu, new Date());
    if (meses > this.MESES_VIGENCIA) {
      throw new BadRequestException(
        `301: El accionista debe actualizar sus datos. Última act.: ${fechaActu.toLocaleDateString('es-GT')} (${meses} meses).`,
      );
    }
  }

  private calcularMeses(desde: Date, hasta: Date): number {
    const a = hasta.getFullYear() - desde.getFullYear();
    const m = hasta.getMonth()    - desde.getMonth();
    const d = hasta.getDate()     - desde.getDate();
    return Math.max(0, a * 12 + m + (d < 0 ? -1 : 0));
  }
}

  // ── G-10 FIX: métodos adicionales ─────────────────────────────────────────

  async getDetalleExpediente(expediente: number) {
    try {
      return await this.dataSource.query(
        `SELECT CORRELATIVO, NOMBRE_PERSONA, NUMERO_DPI, ORDEN_CEDULA,
                REGISTRO_CEDULA, D_DEPTOEXTEN, D_MUNIEXTEN
           FROM AC.ACC_DETALLE_EXPEDIENTE
          WHERE EXPEDIENTE = :1 ORDER BY CORRELATIVO`,
        [expediente],
      );
    } catch { return []; }
  }

  async getMotivosRechazo(expediente: number) {
    try {
      return await this.dataSource.query(
        `SELECT CODIGO_MOTIVO, OBSERVACIONES, ESTADO_EXPEDIENTE, FECHA_CREA
           FROM AC.ACCASAMBLEA_DENEGADA
          WHERE EXPEDIENTE = :1 ORDER BY FECHA_CREA`,
        [expediente],
      );
    } catch { return []; }
  }
