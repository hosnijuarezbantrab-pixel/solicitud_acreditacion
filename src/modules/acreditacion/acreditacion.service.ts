import {
  Injectable, BadRequestException, ConflictException,
  NotFoundException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Accasamblea } from './entities/accasamblea.entity';
import { AccasambleaHis } from './entities/accasamblea-his.entity';
import { AccDetinversionAsamblea } from './entities/acc-detinversion.entity';
import { ExpedienteSecuencia } from './entities/expediente-secuencia.entity';
import { AsambleaActual } from '../asambleas/entities/asamblea-actual.entity';
import { Accionista } from '../accionistas/entities/accionista.entity';
import { CorrelativoService } from './services/correlativo.service';
import {
  RegistrarAcreditacionDto,
  AcreditacionResponseDto,
  ResultadoAcreditacionDto,
  ActualizarExpedienteDto,
} from './dto/acreditacion.dto';

/**
 * AcreditacionService
 *
 * Encapsula la lógica completa de acreditación de accionistas en asambleas.
 *
 * Equivalencias con Oracle Forms:
 *   registrarAcreditacion() → P_REGISTRO_ASAMBLEA_NUEVO → PRC_INSERTA_ASAMBLEA_C
 *   actualizarExpediente()  → PRE-UPDATE de ACCASAMBLEA en ACCFRM0080
 *   validarAcreditacion()   → Validaciones de ACCIONISTA.KEY-NEXT-ITEM en ACCFRM0081
 *
 * Flujo completo de acreditación (ACCFRM0081):
 *   1. Validar vigencia del accionista (ac_fnc_meses_vencimiento_act)
 *   2. Validar que no exista registro previo por asamblea (ACC_VALIDA_ACCIONISTA)
 *   3. Validar período de entrega de expedientes (ACCASAMBLEA_ACTUAL fechas)
 *   4. Obtener sede del usuario (AC_SEDE_X_USUARIO)
 *   5. Por cada asamblea activa:
 *      a. Reservar correlativo con SELECT FOR UPDATE (CorrelativoService)
 *      b. INSERT en AC.ACCASAMBLEA con estado=2 (RECIBIDO), votos=0
 *   6. UPDATE ACC_DETINVERSION_ASAMBLEA con correlativo asignado
 *   7. INSERT en ACCASAMBLEA_HIS (PRC_GENERA_HISTORICO)
 *   8. COMMIT automático al salir del bloque dataSource.transaction()
 */
@Injectable()
export class AcreditacionService {
  private readonly logger = new Logger(AcreditacionService.name);
  private readonly MESES_VIGENCIA = parseInt(
    process.env.MESES_VIGENCIA_ACCIONISTA || '18', 10,
  );

  constructor(
    @InjectRepository(Accasamblea)
    private readonly accasambleaRepo: Repository<Accasamblea>,
    @InjectRepository(AccasambleaHis)
    private readonly hisRepo: Repository<AccasambleaHis>,
    @InjectRepository(AccDetinversionAsamblea)
    private readonly detInvRepo: Repository<AccDetinversionAsamblea>,
    @InjectRepository(AsambleaActual)
    private readonly asambleaActualRepo: Repository<AsambleaActual>,
    @InjectRepository(Accionista)
    private readonly accionistaRepo: Repository<Accionista>,
    private readonly dataSource: DataSource,
    private readonly correlativoSvc: CorrelativoService,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  // ACCFRM0081 — Acreditación en múltiples asambleas
  // Equivale a: TOOLBAR.WHEN-BUTTON-PRESSED → ac_prc_valida_preferente
  //             → KEY-COMMIT → P_REGISTRO_ASAMBLEA_NUEVO → PRC_INSERTA_ASAMBLEA_C
  // ════════════════════════════════════════════════════════════════════════════

  async registrarAcreditacion(
    dto: RegistrarAcreditacionDto,
  ): Promise<AcreditacionResponseDto> {

    // ── Pre-validaciones (fuera de la transacción) ─────────────────────────
    // Se ejecutan primero para fallar rápido sin consumir conexiones de BD.

    // 1. Vigencia del accionista (ac_fnc_meses_vencimiento_act)
    const acc = await this.accionistaRepo.findOne({
      where: { accionista: dto.accionista },
      select: ['accionista', 'nombre', 'estatusAccionista', 'fechaActu', 'numeroDpi'],
    });
    if (!acc) {
      throw new NotFoundException(`101: Accionista ${dto.accionista} no encontrado.`);
    }
    this.validarEstadoAccionista(acc);
    this.validarVigencia(acc.fechaActu, acc.accionista);

    // 2. Obtener asambleas activas
    const asambleas = await this.asambleaActualRepo.find({
      where: { estadoAsamblea: 'S' },
      order: { tipoAsamblea: 'ASC' },
    });
    if (asambleas.length === 0) {
      throw new BadRequestException('221: No hay asambleas activas para acreditar.');
    }

    // 3. Validar período de entrega de expedientes (P_REGISTRO_ASAMBLEA_NUEVO inicio)
    this.validarPeriodoEntrega(asambleas);

    // 4. Validar duplicidad por cada asamblea (ACC_VALIDA_ACCIONISTA)
    await this.validarDuplicidadPorAsambleas(dto.accionista, asambleas);

    // ── Transacción principal ──────────────────────────────────────────────
    // Todo lo que sigue ocurre en UNA sola transacción de base de datos.
    // Si cualquier INSERT/UPDATE falla → ROLLBACK completo → sin huecos.
    const correlativos = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        const resultados: ResultadoAcreditacionDto[] = [];

        // 5. Obtener sede del usuario (AC_SEDE_X_USUARIO)
        const sede = await this.obtenerSede(dto.usuarioCrea, manager);

        // 6. Por cada asamblea: correlativo + INSERT ACCASAMBLEA
        for (const asamblea of asambleas) {
          const correlativo = await this.correlativoSvc.reservar(
            asamblea.tipoAsamblea,
            asamblea.asamblea,
            dto.tipoDocemitido,
            manager,
          );

          const ahora = new Date();

          // INSERT en AC.ACCASAMBLEA
          // Estado siempre = 2 (RECIBIDO) al crear — forzado en PRC_INSERTA_ASAMBLEA_C
          await manager.insert(Accasamblea, {
            tipoAsamblea:        asamblea.tipoAsamblea,
            asamblea:            asamblea.asamblea,
            accionista:          dto.accionista,
            estadoExpediente:    2,
            expediente:          correlativo,
            credencial:          correlativo, // Credencial = Expediente en la creación
            tipoDocemitido:      dto.tipoDocemitido,
            nombreNoAccionista:  dto.nombreAccionista,
            fechaAsamblea:       asamblea.fechaAsamblea,
            fechaCrea:           ahora,
            fechaEntrega:        ahora, // SYSDATE al registrar
            ejercioVoto:         'N',
            votosPropios:        0,
            votosAjenos:         0,
            votosConsignados:    0,
            votosNulos:          0,
            cantidadRepresentados: 0,
            desdeCarta:          0,
            hastaCarta:          0,
            sede:                sede,
            codigoSedeEntrega:   dto.codigoSedeEntrega ?? sede,
            usuarioCrea:         dto.usuarioCrea,
            autorizaAntecedentes: dto.autorizaAntecedentes ?? 'N',
            estadoImpresion:     'N',
            estadoReimpresion:   'N',
          });

          resultados.push({
            asamblea:            asamblea.asamblea,
            tipoAsamblea:        asamblea.tipoAsamblea,
            descripcionAsamblea: asamblea.tipoAsamblea === 'O' ? 'ORDINARIA' : 'EXTRAORDINARIA',
            expediente:          correlativo,
            credencial:          correlativo,
            estadoExpediente:    2,
            fechaEntrega:        ahora.toISOString(),
            fecha_entrega:       ahora.toLocaleDateString('es-GT'),  // G-08 alias
            fechaCrea:           ahora.toISOString(),
          });
        }

        // 7. UPDATE ACC_DETINVERSION_ASAMBLEA con el correlativo asignado
        //    (equivale al loop de actualización en P_REGISTRO_ASAMBLEA_NUEVO)
        if (resultados.length > 0) {
          await this.actualizarDetInversion(dto.accionista, resultados, manager);
        }

        // 8. INSERT histórico por cada asamblea (PRC_GENERA_HISTORICO)
        await this.insertarHistorico(dto, resultados, manager);

        // Al salir del callback → TypeORM ejecuta COMMIT automático.
        // Si hubo excepción → ROLLBACK automático.
        return resultados;
      },
    );

    this.logger.log(
      `Acreditación completada — accionista ${dto.accionista} en ${correlativos.length} asamblea(s)`,
    );

    return {
      accionista:       dto.accionista,
      nombreAccionista: dto.nombreAccionista ?? '',
      tipoDocemitido:   dto.tipoDocemitido ?? 1,
      correlativos,
      expedientes: correlativos,  // G-08 alias para el frontend
      mensaje:          `El accionista fue acreditado en ${correlativos.length} asamblea(s). ` +
                        correlativos.map(
                          (r) => `Expediente N° ${r.expediente} asignado a asamblea ${r.asamblea}`,
                        ).join('. '),
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ACCFRM0080 — Consulta de expediente individual
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Obtiene el expediente de un accionista en una asamblea específica.
   * Equivale al POST-QUERY del bloque ACCASAMBLEA en ACCFRM0080:
   *   carga nombre, DPI, estado, tipo_asamblea, tipo_documento,
   *   calcula TOTAL_VOTOS = NVL(VOTOS_PROPIOS,0) + NVL(VOTOS_AJENOS,0),
   *   sincroniza checks con fechas.
   */
  async obtenerExpediente(
    tipoAsamblea: string,
    asamblea: string,
    accionista: string,
    tipoDocemitido: number,
  ) {
    const exp = await this.accasambleaRepo.findOne({
      where: { tipoAsamblea, asamblea, accionista, tipoDocemitido },
    });

    if (!exp) return null;

    // POST-QUERY: sincronizar checks con fechas
    const checkFecEntregado  = exp.fechaEntrega   ? 'S' : 'N';
    const checkFecRecibido   = exp.fechaRecibido  ? 'S' : 'N';
    const checkCredencial    = exp.fechaCredencial ? 'S' : 'N';

    // POST-QUERY: TOTAL_VOTOS := NVL(VOTOS_PROPIOS,0) + NVL(VOTOS_AJENOS,0)
    const totalVotos = (exp.votosPropios ?? 0) + (exp.votosAjenos ?? 0);

    return {
      ...exp,
      totalVotos,
      checkFecEntregado,
      checkFecRecibido,
      checkCredencial,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ACCFRM0080 — PRE-UPDATE: actualizar expediente con validaciones
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Actualiza un expediente individual aplicando las reglas de negocio
   * del PRE-UPDATE de ACCFRM0080.
   *
   * Reglas aplicadas:
   *   R2: Si nuevo_estado < estado_actual → requiere AUTH (validada en frontend, auditada aquí)
   *   R5: check_fec_recibido solo si estado = 2
   *   R6: check_fec_entregado → fecha_entrega = now / null
   *   R4: check_credencial → fecha_credencial = now / null (con FECHACRED)
   *   R13 PRE-UPDATE: usuario_actu, fecha_actu, si estado=2 y anterior≠2 → registra movimiento
   *                   si estado=5 → p_actualiza_estado (INSERT en accasamblea_det)
   */
  async actualizarExpediente(
    tipoAsamblea: string,
    asamblea: string,
    expediente: number,
    tipoDocemitido: number,
    dto: ActualizarExpedienteDto,
  ) {
    const exp = await this.accasambleaRepo.findOne({
      where: { tipoAsamblea, asamblea, expediente, tipoDocemitido },
    });

    if (!exp) {
      throw new NotFoundException(
        `118: Expediente ${expediente} no encontrado en asamblea ${asamblea}.`,
      );
    }

    const estadoAnterior = exp.estadoExpediente;
    const ahora = new Date();

    // Construir updates
    const updates: Partial<Accasamblea> = {
      usuarioActu:   dto.usuarioActu,
      fechaActu:     ahora,
    };

    // Estado
    if (dto.estadoExpediente !== undefined) {
      updates.estadoExpediente    = dto.estadoExpediente;
      updates.fechaCambioestado   = ahora;
      updates.autorizaUltimoEstado = dto.autorizaUltimoEstado ?? null;
    }

    // R6: CHECK_FEC_ENTREGADO
    if (dto.checkFecEntregado === 'S') updates.fechaEntrega  = ahora;
    else if (dto.checkFecEntregado === 'N') updates.fechaEntrega = null;

    // R5: CHECK_FEC_RECIBIDO (solo si estado = 2)
    if (dto.checkFecRecibido !== undefined) {
      const estadoFinal = dto.estadoExpediente ?? estadoAnterior;
      if (estadoFinal !== 2) {
        throw new BadRequestException(
          '221: No se puede poner fecha de Recibo cuando el expediente no tiene Estado 2 - RECIBIDO.',
        );
      }
      if (dto.checkFecRecibido === 'S') updates.fechaRecibido = ahora;
      else updates.fechaRecibido = null;
    }

    // R4: CHECK_CREDENCIAL
    if (dto.checkCredencial === 'S') updates.fechaCredencial = ahora;
    else if (dto.checkCredencial === 'N') updates.fechaCredencial = null;

    // Votos
    if (dto.votosPropios      !== undefined) updates.votosPropios     = dto.votosPropios;
    if (dto.votosAjenos       !== undefined) updates.votosAjenos      = dto.votosAjenos;
    if (dto.votosConsignados  !== undefined) updates.votosConsignados = dto.votosConsignados;
    if (dto.votosNulos        !== undefined) updates.votosNulos       = dto.votosNulos;
    if (dto.desdeCarta        !== undefined) updates.desdeCarta       = dto.desdeCarta;
    if (dto.hastaCarta        !== undefined) updates.hastaCarta       = dto.hastaCarta;
    if (dto.ejercioVoto       !== undefined) updates.ejercioVoto      = dto.ejercioVoto;
    if (dto.autorizaAntecedentes !== undefined) updates.autorizaAntecedentes = dto.autorizaAntecedentes;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        Accasamblea,
        { tipoAsamblea, asamblea, expediente, tipoDocemitido },
        updates,
      );

      // R13 PRE-UPDATE: Si cambia a estado 2 desde otro estado → INSERT histórico
      const nuevoEstado = dto.estadoExpediente ?? estadoAnterior;
      if (nuevoEstado === 2 && estadoAnterior !== 2) {
        await manager.insert(AccasambleaHis, {
          tipoAsamblea,
          asamblea,
          accionista:       exp.accionista,
          expediente,
          estadoExpediente: 2,
          usuarioCorte:     dto.usuarioActu,
          usuarioAutoriza:  dto.autorizaUltimoEstado ?? null,
          votosPropios:     exp.votosPropios ?? 0,
          votosAjenos:      exp.votosAjenos ?? 0,
          votosConsignados: exp.votosConsignados ?? 0,
          votosNulos:       exp.votosNulos ?? 0,
          desdeCarta:       exp.desdeCarta ?? 0,
          hastaCarta:       exp.hastaCarta ?? 0,
          fechaEntrega:     ahora,
          tipoDocemitido,
        });
      }
    });

    this.logger.log(
      `Expediente ${expediente} actualizado — asamblea ${asamblea} por ${dto.usuarioActu}`,
    );

    return this.obtenerExpediente(tipoAsamblea, asamblea, exp.accionista, tipoDocemitido);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Consultas de soporte
  // ════════════════════════════════════════════════════════════════════════════

  /** Verifica si el accionista ya está registrado en una asamblea (ACC_VALIDA_ACCIONISTA). */
  async validarAccionistaPorAsamblea(
    tipoAsamblea: string,
    asamblea: string,
    accionista: string,
  ): Promise<boolean> {
    const count = await this.accasambleaRepo.count({
      where: { tipoAsamblea, asamblea, accionista },
    });
    return count > 0;
  }

  /** Lista los expedientes de un accionista en todas las asambleas. */
  async listarExpedientesDeAccionista(accionista: string) {
    return this.accasambleaRepo.find({
      where: { accionista },
      order: { tipoAsamblea: 'ASC', asamblea: 'ASC' },
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Validaciones internas (equivalentes a procedimientos Oracle)
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * F_VERIFICA_ESTADO_ACC: estatus 3 = no válido → error 100.
   */
  private validarEstadoAccionista(acc: Accionista): void {
    if (acc.estatusAccionista === 3) {
      throw new BadRequestException(
        `100: Estado de Accionista No es válido. El accionista está marcado como no válido.`,
      );
    }
  }

  /**
   * ac_fnc_meses_vencimiento_act: valida que la fecha de actualización
   * del accionista no haya superado el umbral configurado (MESES_VIGENCIA_ACCIONISTA).
   */
  private validarVigencia(fechaActu: Date | null, accionista: string): void {
    if (!fechaActu) {
      throw new BadRequestException(
        `301: El accionista ${accionista} debe actualizar sus datos. No tiene fecha de actualización registrada.`,
      );
    }
    const meses = this.calcularMeses(fechaActu, new Date());
    if (meses > this.MESES_VIGENCIA) {
      throw new BadRequestException(
        `301: El accionista debe actualizar sus datos. Última actualización: ${fechaActu.toLocaleDateString('es-GT')}. Han transcurrido ${meses} meses (máximo: ${this.MESES_VIGENCIA}).`,
      );
    }
  }

  /**
   * P_REGISTRO_ASAMBLEA_NUEVO — validación de fechas:
   * SELECT COUNT(1) FROM ACCASAMBLEA_ACTUAL
   *  WHERE Estado_Asamblea = 'S'
   *    AND TRUNC(SYSDATE) BETWEEN Fecha_Entregaexped_Desde AND Fecha_Entregaexped_Hasta
   */
  private validarPeriodoEntrega(asambleas: AsambleaActual[]): void {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const algunaVigente = asambleas.some((a) => {
      if (!a.fechaEntregaExpdDesde || !a.fechaEntregaExpdHasta) return false;
      const desde = new Date(a.fechaEntregaExpdDesde);
      const hasta = new Date(a.fechaEntregaExpdHasta);
      desde.setHours(0, 0, 0, 0);
      hasta.setHours(23, 59, 59, 999);
      return hoy >= desde && hoy <= hasta;
    });

    if (!algunaVigente) {
      throw new BadRequestException(
        '116: Fechas para Entrega y Recepción de Expedientes han Expirado o son incorrectas.',
      );
    }
  }

  /**
   * ACC_VALIDA_ACCIONISTA para múltiples asambleas.
   * Error 121: "El accionista ya se encuentra registrado en la asamblea: X"
   */
  private async validarDuplicidadPorAsambleas(
    accionista: string,
    asambleas: AsambleaActual[],
  ): Promise<void> {
    for (const a of asambleas) {
      const existe = await this.accasambleaRepo.count({
        where: { tipoAsamblea: a.tipoAsamblea, asamblea: a.asamblea, accionista },
      });
      if (existe > 0) {
        throw new ConflictException(
          `121: El accionista ya se encuentra registrado en la asamblea: ${a.asamblea} (${a.tipoAsamblea === 'O' ? 'ORDINARIA' : 'EXTRAORDINARIA'}).`,
        );
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Operaciones de escritura dentro de transacción
  // ════════════════════════════════════════════════════════════════════════════

  private async obtenerSede(usuario: string, manager: EntityManager): Promise<number | null> {
    const rows: Array<{ sede: number }> = await manager.query(
      `SELECT SEDE FROM AC.AC_SEDE_X_USUARIO
        WHERE USUARIO_SEDE = :1 AND ESTADO = 'A' AND ROWNUM = 1`,
      [usuario],
    );
    return rows[0]?.sede ?? null;
  }

  /**
   * Actualiza ACC_DETINVERSION_ASAMBLEA con el expediente asignado.
   * Equivale al loop de actualización en P_REGISTRO_ASAMBLEA_NUEVO.
   */
  private async actualizarDetInversion(
    accionista: string,
    resultados: ResultadoAcreditacionDto[],
    manager: EntityManager,
  ): Promise<void> {
    for (const r of resultados) {
      await manager.query(
        `UPDATE AC.ACC_DETINVERSION_ASAMBLEA
            SET EXPEDIENTE = :1
          WHERE ACCIONISTA = :2
            AND TIPO_ASAMBLEA = :3
            AND ASAMBLEA = :4`,
        [r.expediente, accionista, r.tipoAsamblea, r.asamblea],
      );
    }
  }

  /**
   * PRC_GENERA_HISTORICO: inserta en ACCASAMBLEA_HIS por cada asamblea registrada.
   * Solo inserta si no existe ya un histórico para accionistas de gobierno
   * (consulta ACC_PARAMETROS_GENERALES LIKE 'ACC_GOBIERNO%').
   */
  private async insertarHistorico(
    dto: RegistrarAcreditacionDto,
    resultados: ResultadoAcreditacionDto[],
    manager: EntityManager,
  ): Promise<void> {
    const ahora = new Date();

    for (const r of resultados) {
      try {
        await manager.insert(AccasambleaHis, {
          tipoAsamblea:     r.tipoAsamblea,
          asamblea:         r.asamblea,
          accionista:       dto.accionista,
          expediente:       r.expediente,
          estadoExpediente: 2,
          usuarioCorte:     dto.usuarioCrea,
          usuarioAutoriza:  null,
          votosPropios:     0,
          votosAjenos:      0,
          votosConsignados: 0,
          votosNulos:       0,
          desdeCarta:       0,
          hastaCarta:       0,
          fechaEntrega:     ahora,
          tipoDocemitido:   dto.tipoDocemitido,
        });
      } catch (err) {
        // Error 901: No bloquea el flujo — loguea y continúa
        this.logger.error(
          `901: Error al insertar histórico asamblea ${r.asamblea}: ${err.message}`,
        );
      }
    }
  }

  // ── Helper: meses entre fechas ──────────────────────────────────────────
  private calcularMeses(desde: Date, hasta: Date): number {
    const años  = hasta.getFullYear() - desde.getFullYear();
    const meses = hasta.getMonth()    - desde.getMonth();
    const dias  = hasta.getDate()     - desde.getDate();
    return Math.max(0, años * 12 + meses + (dias < 0 ? -1 : 0));
  }
}
