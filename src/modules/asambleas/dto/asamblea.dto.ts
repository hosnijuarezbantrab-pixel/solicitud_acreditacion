import { IsString, IsOptional, IsIn } from 'class-validator';

/** Filtro de listado de asambleas */
export class ListarAsambleasDto {
  /** Si se omite, retorna todas. 'S' = solo activas */
  @IsOptional()
  @IsString()
  @IsIn(['S', 'N'])
  soloActivas?: string;

  /** 'O' = Ordinaria, 'E' = Extraordinaria */
  @IsOptional()
  @IsString()
  @IsIn(['O', 'E'])
  tipoAsamblea?: string;
}

/** Respuesta de asamblea al frontend */
export class AsambleaResponseDto {
  tipoAsamblea: string;
  asamblea: string;
  descripcion: string;           // 'ORDINARIA' | 'EXTRAORDINARIA'
  ordinal: string;               // Conversión romano → ordinal (P_OBTIENE_ORDINAL)
  fechaAsamblea: string;
  estadoAsamblea: string;
  activa: boolean;

  // Rangos de fechas operativos
  fechaEntregaExpedDesde: string;
  fechaEntregaExpedHasta: string;
  fechaEntregaCredDesde: string;
  fechaEntregaCredHasta: string;
  fechaRecepExpedDesde: string;
  fechaRecepExpedHasta: string;

  // Estados de vigencia calculados (útiles para el frontend)
  entregaExpedienteVigente: boolean;   // ¿hoy está en rango de entrega de expediente?
  entregaCredencialVigente: boolean;   // ¿hoy está en rango de entrega de credencial?

  indConflictoInteres: boolean;
}
