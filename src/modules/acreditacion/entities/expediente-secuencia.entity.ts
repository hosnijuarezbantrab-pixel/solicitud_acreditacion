import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * AC.ACC_EXPEDIENTES_ASAMBLEA
 * Tabla de control de correlativos — equivale a una secuencia manual por
 * combinación (tipoAsamblea, asamblea, tipoDocemitido).
 * Una sola fila activa por combinación.
 * El campo CORRELATIVO almacena el ÚLTIMO número ya asignado.
 *
 * Acceso SIEMPRE con SELECT FOR UPDATE dentro de la transacción de
 * acreditación para garantizar secuencialidad sin huecos.
 */
@Entity({ name: 'ACC_EXPEDIENTES_ASAMBLEA', schema: 'AC' })
export class ExpedienteSecuencia {
  @PrimaryColumn({ name: 'TIPO_ASAMBLEA', type: 'varchar2', length: 1 })
  tipoAsamblea: string;

  @PrimaryColumn({ name: 'ASAMBLEA', type: 'varchar2', length: 10 })
  asamblea: string;

  @PrimaryColumn({ name: 'TIPO_DOCEMITIDO', type: 'number' })
  tipoDocemitido: number;

  /** Último correlativo asignado. El siguiente disponible es correlativo + 1. */
  @Column({ name: 'CORRELATIVO', type: 'number', nullable: true })
  correlativo: number | null;
}
