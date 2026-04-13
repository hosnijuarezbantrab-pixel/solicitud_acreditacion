import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Accionista } from './entities/accionista.entity';
import {
  BuscarPorDpiDto, ActualizarDatosEditablesDto, AccionistaResponseDto,
} from './dto/accionista.dto';

@Injectable()
export class AccionistasService {
  private readonly logger = new Logger(AccionistasService.name);
  private readonly MESES_VIGENCIA = parseInt(process.env.MESES_VIGENCIA_ACCIONISTA || '18', 10);

  constructor(
    @InjectRepository(Accionista)
    private readonly repo: Repository<Accionista>,
  ) {}

  // ── Búsqueda (G-06 FIX: llamado desde GET /accionistas/buscar?dpi=) ─────

  async buscarPorDpi(dto: BuscarPorDpiDto): Promise<AccionistaResponseDto> {
    const acc = await this.repo.findOne({ where: { numeroDpi: dto.dpi } });
    if (!acc) throw new NotFoundException(`101: Accionista con DPI ${dto.dpi} no encontrado.`);
    if (acc.estatusAccionista === 3)
      throw new NotFoundException(`100: Estado del Accionista No es válido.`);
    return this.toResponse(acc);
  }

  async buscarPorCodigo(accionista: string): Promise<AccionistaResponseDto> {
    const acc = await this.repo.findOne({ where: { accionista } });
    if (!acc) throw new NotFoundException(`101: Accionista ${accionista} no encontrado.`);
    return this.toResponse(acc);
  }

  verificarVigencia(fechaActu: Date | null): { vigente: boolean; meses: number } {
    if (!fechaActu) return { vigente: false, meses: Infinity };
    const meses = this.calcularMesesEntre(fechaActu, new Date());
    return { vigente: meses <= this.MESES_VIGENCIA, meses };
  }

  // ── G-17 FIX: acepta aliases de campos del frontend ──────────────────────

  async actualizarDatosEditables(
    accionista: string,
    dto: ActualizarDatosEditablesDto,
    usuarioActu: string,
  ): Promise<AccionistaResponseDto> {
    const acc = await this.repo.findOne({ where: { accionista } });
    if (!acc) throw new NotFoundException(`Accionista ${accionista} no encontrado.`);

    const updates: Partial<Accionista> = { usuarioActu, fechaActu: new Date() };

    // Aceptar tanto camelCase (backend) como snake_case (frontend)
    const correo = dto.correoElectronico ?? dto.email;
    const tel    = dto.tel_celular ?? dto.telefono;
    const depto  = dto.codDepto   ?? (dto.cod_depto  ? Number(dto.cod_depto)  : undefined);
    const mun    = dto.codMunicipio ?? (dto.cod_municipio ? Number(dto.cod_municipio) : undefined);
    const zona   = dto.zona !== undefined ? Number(dto.zona) : undefined;

    if (correo    !== undefined) updates.correoElectronico = correo;
    if (tel       !== undefined) updates.telefono          = tel;
    if (dto.codPais !== undefined) updates.codPais         = dto.codPais;
    if (depto     !== undefined) updates.codDepto          = depto;
    if (mun       !== undefined) updates.codMunicipio      = mun;
    if (dto.direccion !== undefined) updates.direccion     = dto.direccion;
    if (zona      !== undefined) updates.zona              = zona;

    await this.repo.update({ accionista }, updates);
    this.logger.log(`Datos editables → accionista ${accionista} por ${usuarioActu}`);
    return this.buscarPorCodigo(accionista);
  }

  // ── G-04 + G-18 FIX: toResponse con todos los aliases ────────────────────

  toResponse(acc: Accionista): AccionistaResponseDto {
    const { vigente, meses } = this.verificarVigencia(acc.fechaActu);
    const ESTATUS: Record<number, string> = {
      21: 'Activo', 11: 'Activo-Nuevo', 31: 'Suspendido', 99: 'Inactivo',
    };
    const GENERO: Record<string, string> = { M: 'Masculino', F: 'Femenino' };

    const nombre    = this.buildNombre(acc);
    const iniciales = this.buildIniciales(acc);
    const fechaActuIso = acc.fechaActu?.toISOString() ?? null;
    const fechaActuGT  = acc.fechaActu
      ? acc.fechaActu.toLocaleDateString('es-GT')
      : null;

    // G-18: dividendos — en la entidad no existe, se expone como 0 por ahora.
    // El DBA debe agregar DIVIDENDOS_ACCIONISTA a ACCACCIONISTA o calcularlo
    // desde ACC_DETINVERSION_ASAMBLEA según la lógica de negocio.
    const dividendos = (acc as any).dividendos ?? 0;

    return {
      // Identificadores con ambos nombres (G-04)
      accionista:              acc.accionista,
      codigo:                  acc.accionista,

      nombre,
      iniciales,
      dpi:                     acc.numeroDpi ?? '',
      nit:                     acc.nit ?? '',

      // Estatus con alias (G-04)
      estatusAccionista:       acc.estatusAccionista,
      estatus:                 acc.estatusAccionista,
      estatusDesc:             ESTATUS[acc.estatusAccionista] ?? `Est.${acc.estatusAccionista}`,
      descripEstatus:          ESTATUS[acc.estatusAccionista] ?? `Est.${acc.estatusAccionista}`,

      // Demográficos (alias G-04)
      fechaNacimiento:         acc.fechaNacimiento?.toISOString().split('T')[0] ?? '',
      fecha_nacimiento:        acc.fechaNacimiento?.toISOString().split('T')[0] ?? '',
      genero:                  acc.genero ?? '',
      generoDesc:              GENERO[acc.genero ?? ''] ?? acc.genero ?? '',
      apellidoCasada:          acc.apellidoCasada ?? '',
      primerNombre:            acc.primerNombre ?? '',
      segundoNombre:           acc.segundoNombre ?? '',
      primerApellido:          acc.primerApellido ?? '',
      segundoApellido:         acc.segundoApellido ?? '',

      // Contacto con alias (G-04 / G-17)
      correoElectronico:       acc.correoElectronico ?? '',
      email:                   acc.correoElectronico ?? '',
      telefono:                acc.telefono ?? '',
      tel_celular:             acc.telefono ?? '',
      tel_casa:                '',   // un solo campo en DB
      tel_trabajo:             '',

      // Dirección con alias numérico+string (G-04)
      codPais:                 acc.codPais,
      cod_depto:               String(acc.codDepto ?? ''),
      codDepto:                acc.codDepto,
      cod_municipio:           String(acc.codMunicipio ?? ''),
      codMunicipio:            acc.codMunicipio,
      direccion:               acc.direccion ?? '',
      zona:                    acc.zona,

      // Acciones con alias (G-04)
      cantidadAcciones:        acc.cantidadAcciones ?? 0,
      acciones_comunes:        acc.cantidadAcciones ?? 0,
      cantidadAccionesPref:    acc.cantidadAccionesPref ?? 0,
      acciones_preferentes_a:  acc.cantidadAccionesPref ?? 0,

      // G-18: dividendos
      dividendos,

      // Vigencia con alias (G-04)
      fechaActu:               fechaActuIso,
      ultima_actualizacion:    fechaActuGT,
      fecha_actu_iso:          fechaActuIso ? fechaActuIso.split('T')[0] : null,
      vigente,
      mesesDesdeActualizacion: meses === Infinity ? -1 : meses,

      // Campos adicionales que usa DatosPersonalesForm (G-04)
      // No están en la entidad actual — se exponen vacíos hasta que el
      // DBA agregue las columnas correspondientes a ACCACCIONISTA.
      actividad_economica: (acc as any).actividadEconomica ?? '',
      profesion:           (acc as any).profesion          ?? '',
      nivel_estudios:      (acc as any).nivelEstudios      ?? '',
      lugar_trabajo:       (acc as any).lugarTrabajo       ?? '',
      patrono_nombre:      (acc as any).patronoNombre      ?? '',
      estado_civil:        (acc as any).estadoCivil        ?? '',
      proveedor_bantrab:   'N',
      empleado_bantrab:    'N',
      pariente_id:         'N',
    };
  }

  private buildNombre(acc: Accionista): string {
    if (acc.accTipper === '2') return acc.accRazon ?? acc.nombre ?? '';
    return [acc.primerNombre, acc.segundoNombre, acc.primerApellido, acc.segundoApellido, acc.apellidoCasada]
      .filter(Boolean).join(' ').trim() || acc.nombre || '';
  }

  private buildIniciales(acc: Accionista): string {
    const nombre = this.buildNombre(acc);
    const partes = nombre.trim().split(/\s+/);
    return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? partes[0]?.[1] ?? '')).toUpperCase();
  }

  private calcularMesesEntre(desde: Date, hasta: Date): number {
    const años = hasta.getFullYear() - desde.getFullYear();
    const meses = hasta.getMonth() - desde.getMonth();
    const dias = hasta.getDate() - desde.getDate();
    return Math.max(0, años * 12 + meses + (dias < 0 ? -1 : 0));
  }
}
