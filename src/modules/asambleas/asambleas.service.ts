import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AsambleaActual } from './entities/asamblea-actual.entity';

/**
 * G-05 FIX: AsambleaDto ahora incluye todos los campos que usa el frontend:
 *   id, num, tipo, descripcion, fecha, fecha_entrega_desde/hasta, fecha_cred_desde/hasta
 */
export interface AsambleaDto {
  // Campos originales del backend
  tipoAsamblea: string;
  tipoAsambleaDesc: string;
  asamblea: string;
  ordinal: string;
  fechaAsamblea: string;
  estadoAsamblea: string;
  fechaEntregaExpdDesde: string;
  fechaEntregaExpdHasta: string;
  fechaEntregaCredDesde: string;
  fechaEntregaCredHasta: string;
  enPeriodoEntrega: boolean;
  enPeriodoCredencial: boolean;
  indConflictoInteres: boolean;

  // Aliases para compatibilidad con el frontend (G-05)
  id: string;                   // tipoAsamblea + '|' + asamblea — usado como key en React
  num: string;                  // alias de asamblea
  tipo: string;                 // alias de tipoAsamblea
  descripcion: string;          // alias de tipoAsambleaDesc
  fecha: string;                // fechaAsamblea formateada es-GT
  estado: string;               // alias de estadoAsamblea
  fecha_entrega_desde: string;  // alias de fechaEntregaExpdDesde
  fecha_entrega_hasta: string;  // alias
  fecha_cred_desde: string;     // alias de fechaEntregaCredDesde
  fecha_cred_hasta: string;     // alias
}

@Injectable()
export class AsambleasService {
  private readonly logger = new Logger(AsambleasService.name);

  constructor(
    @InjectRepository(AsambleaActual)
    private readonly repo: Repository<AsambleaActual>,
  ) {}

  async getAsambleasActivas(): Promise<AsambleaDto[]> {
    const rows = await this.repo.find({
      where: { estadoAsamblea: 'S' },
      order: { tipoAsamblea: 'ASC' },
    });
    return rows.map((a) => this.toDto(a));
  }

  async validarPeriodoAcreditacion(): Promise<void> {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const activas = await this.repo.find({ where: { estadoAsamblea: 'S' } });
    const hayVigente = activas.some((a) => {
      const desde = a.fechaEntregaExpdDesde;
      const hasta = a.fechaEntregaExpdHasta;
      return desde && hasta && hoy >= desde && hoy <= hasta;
    });
    if (!hayVigente)
      throw new BadRequestException('116: Fechas para Entrega y Recepción de Expedientes han Expirado.');
  }

  enRangoEntregaExpediente(asamblea: AsambleaActual): boolean {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const desde = asamblea.fechaEntregaExpdDesde;
    const hasta = asamblea.fechaEntregaExpdHasta;
    return !!(desde && hasta && hoy >= desde && hoy <= hasta);
  }

  enRangoEntregaCredencial(asamblea: AsambleaActual): boolean {
    const hoy = new Date();
    const desde = asamblea.fechaEntregaCredDesde;
    const hasta = asamblea.fechaEntregaCredHasta;
    return !!(desde && hasta && hoy >= desde && hoy <= hasta);
  }

  async getUna(tipoAsamblea: string, asamblea: string): Promise<AsambleaActual> {
    const a = await this.repo.findOne({ where: { tipoAsamblea, asamblea } });
    if (!a) throw new BadRequestException(`102: Asamblea no válida: ${tipoAsamblea}-${asamblea}`);
    return a;
  }

  // G-05 FIX: toDto incluye todos los aliases que necesita el frontend
  toDto(a: AsambleaActual): AsambleaDto {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const enPeriodoEntrega = !!(a.fechaEntregaExpdDesde && a.fechaEntregaExpdHasta
      && hoy >= a.fechaEntregaExpdDesde && hoy <= a.fechaEntregaExpdHasta);
    const enPeriodoCredencial = !!(a.fechaEntregaCredDesde && a.fechaEntregaCredHasta
      && hoy >= a.fechaEntregaCredDesde && hoy <= a.fechaEntregaCredHasta);

    const TIPO: Record<string, string> = { O: 'ORDINARIA', E: 'EXTRAORDINARIA' };
    const fmt = (d?: Date) => d?.toISOString().split('T')[0] ?? '';
    const fmtGT = (d?: Date) => d?.toLocaleDateString('es-GT') ?? '';

    // id único para React keys y para que el frontend pueda filtrar
    const id = `${a.tipoAsamblea}|${a.asamblea}`;

    return {
      // Campos originales
      tipoAsamblea:          a.tipoAsamblea,
      tipoAsambleaDesc:      TIPO[a.tipoAsamblea] ?? a.tipoAsamblea,
      asamblea:              a.asamblea,
      ordinal:               this.obtenerOrdinal(a.asamblea),
      fechaAsamblea:         fmt(a.fechaAsamblea),
      estadoAsamblea:        a.estadoAsamblea,
      fechaEntregaExpdDesde: fmt(a.fechaEntregaExpdDesde),
      fechaEntregaExpdHasta: fmt(a.fechaEntregaExpdHasta),
      fechaEntregaCredDesde: fmt(a.fechaEntregaCredDesde),
      fechaEntregaCredHasta: fmt(a.fechaEntregaCredHasta),
      enPeriodoEntrega,
      enPeriodoCredencial,
      indConflictoInteres:   a.indConflictoInteres === 'S',

      // Aliases para el frontend (G-05)
      id,
      num:                   a.asamblea,
      tipo:                  a.tipoAsamblea,
      descripcion:           TIPO[a.tipoAsamblea] ?? a.tipoAsamblea,
      fecha:                 fmtGT(a.fechaAsamblea),
      estado:                a.estadoAsamblea,
      fecha_entrega_desde:   fmt(a.fechaEntregaExpdDesde),
      fecha_entrega_hasta:   fmt(a.fechaEntregaExpdHasta),
      fecha_cred_desde:      fmt(a.fechaEntregaCredDesde),
      fecha_cred_hasta:      fmt(a.fechaEntregaCredHasta),
    };
  }

  private obtenerOrdinal(asamblea: string): string {
    const match = asamblea.match(/(\d+)/);
    if (!match) return asamblea;
    const n = parseInt(match[1], 10);
    const O: Record<number, string> = {
      1:'Primera',2:'Segunda',3:'Tercera',4:'Cuarta',5:'Quinta',6:'Sexta',
      7:'Séptima',8:'Octava',9:'Novena',10:'Décima',11:'Décimo Primera',
      12:'Décimo Segunda',20:'Vigésima',21:'Vigésima Primera',22:'Vigésima Segunda',
      25:'Vigésima Quinta',30:'Trigésima',
    };
    return O[n] ?? `${n}ª`;
  }
}
