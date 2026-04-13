import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * AC.ACCASAMBLEA_HIS
 * Histórico de cambios de estado de expedientes.
 * Equivale a P_INS_ASAMBLEA_HIS del Oracle Forms.
 * Se inserta cada vez que cambia el estado de un expediente.
 */
@Entity({ name: 'ACCASAMBLEA_HIS', schema: 'AC' })
export class AccasambleaHis {
  @PrimaryGeneratedColumn({ name: 'NUMERO_ID' })
  numeroId: number;

  @Column({ name: 'TIPO_ASAMBLEA', type: 'varchar2', length: 1 })
  tipoAsamblea: string;

  @Column({ name: 'ASAMBLEA', type: 'varchar2', length: 10 })
  asamblea: string;

  @Column({ name: 'ACCIONISTA', type: 'varchar2', length: 15 })
  accionista: string;

  @Column({ name: 'EXPEDIENTE', type: 'number', nullable: true })
  expediente: number;

  @Column({ name: 'ESTADO_EXPEDIENTE', type: 'number', nullable: true })
  estadoExpediente: number;

  @Column({ name: 'FECHA_CORTE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaCorte: Date;

  @Column({ name: 'USUARIO_CORTE', type: 'varchar2', length: 80, nullable: true })
  usuarioCorte: string;

  @Column({ name: 'USUARIO_AUTORIZA', type: 'varchar2', length: 80, nullable: true })
  usuarioAutoriza: string;

  @Column({ name: 'VOTOS_PROPIOS', type: 'number', nullable: true, default: 0 })
  votosPropios: number;

  @Column({ name: 'VOTOS_AJENOS', type: 'number', nullable: true, default: 0 })
  votosAjenos: number;

  @Column({ name: 'VOTOS_CONSIGNADOS', type: 'number', nullable: true, default: 0 })
  votosConsignados: number;

  @Column({ name: 'VOTOS_NULOS', type: 'number', nullable: true, default: 0 })
  votosNulos: number;

  @Column({ name: 'DESDE_CARTA', type: 'number', nullable: true, default: 0 })
  desdeCarta: number;

  @Column({ name: 'HASTA_CARTA', type: 'number', nullable: true, default: 0 })
  hastaCarta: number;

  @Column({ name: 'FECHA_ENTREGA', type: 'date', nullable: true })
  fechaEntrega: Date;

  @Column({ name: 'FECHA_RECIBIDO', type: 'date', nullable: true })
  fechaRecibido: Date;

  @Column({ name: 'TIPO_DOCEMITIDO', type: 'number', nullable: true })
  tipoDocemitido: number;
}
