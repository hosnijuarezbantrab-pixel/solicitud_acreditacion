import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ExpedienteSecuencia } from '../entities/expediente-secuencia.entity';

/**
 * CorrelativoService
 *
 * Reemplaza completamente al procedimiento Oracle ACC_EXPEDIENTE_NUEVO.
 *
 * PROBLEMA ORIGINAL EN ORACLE:
 *   - V1.0: SELECT MAX()+1 → UPDATE → COMMIT propio.
 *     Riesgo: el COMMIT liberaba el lock antes de que ACCASAMBLEA fuera insertada.
 *     Si el proceso padre hacía ROLLBACK, el correlativo quedaba "quemado" (hueco).
 *   - V2.0: Se eliminó el COMMIT propio para evitar huecos, pero el MAX()+1 sin
 *     bloqueo previo creaba race conditions bajo concurrencia.
 *   - PRC_INSERTA_ASAMBLEA_C: Usaba FOR UPDATE NOWAIT para serializar, pero el
 *     manejo de errores era complejo y la lógica estaba dispersa en la forma.
 *
 * SOLUCIÓN NestJS:
 *   1. SELECT FOR UPDATE ("pessimistic_write") bloquea la fila exclusivamente.
 *      Transacciones concurrentes que necesiten el mismo correlativo esperan
 *      (no fallan inmediatamente como NOWAIT) hasta que la tx actual haga COMMIT.
 *   2. UPDATE correlativo = correlativo + 1 en la misma transacción.
 *   3. INSERT en ACCASAMBLEA con ese correlativo en la misma transacción.
 *   4. Al hacer COMMIT todos los cambios se confirman juntos.
 *      Si hay ROLLBACK (cualquier causa), tanto el UPDATE del correlativo
 *      como el INSERT de ACCASAMBLEA se revierten — NUNCA quedan huecos.
 *
 * GARANTÍA: Este método NUNCA debe llamarse fuera de una transacción activa.
 *           El manager que recibe es el EntityManager de la transacción padre.
 */
@Injectable()
export class CorrelativoService {
  private readonly logger = new Logger(CorrelativoService.name);

  /**
   * Reserva atómicamente el siguiente número de correlativo de expediente.
   *
   * @param tipoAsamblea   'O' (Ordinaria) | 'E' (Extraordinaria)
   * @param asamblea       Identificador de la asamblea (ej: 'ASM-2025-01')
   * @param tipoDocemitido Tipo de documento (1=Comunes, 2=Pref.A, 3=Pref.B...)
   * @param manager        EntityManager de la transacción activa (REQUERIDO)
   * @returns              Número de correlativo reservado (≥ 1), único y sin huecos
   */
  async reservar(
    tipoAsamblea: string,
    asamblea: string,
    tipoDocemitido: number,
    manager: EntityManager,
  ): Promise<number> {
    // ── Paso 1: SELECT FOR UPDATE ─────────────────────────────────────────
    // Bloqueo exclusivo de la fila de control.
    // Si otra transacción tiene la fila bloqueada, esta espera hasta que libere.
    // Esto serializa completamente la asignación de correlativos para esta
    // combinación (tipoAsamblea, asamblea, tipoDocemitido).
    let secuencia: ExpedienteSecuencia | null = null;

    try {
      secuencia = await manager
        .createQueryBuilder(ExpedienteSecuencia, 'seq')
        .setLock('pessimistic_write')
        .where('seq.tipoAsamblea = :ta', { ta: tipoAsamblea })
        .andWhere('seq.asamblea = :a', { a: asamblea })
        .andWhere('seq.tipoDocemitido = :td', { td: tipoDocemitido })
        .getOne();
    } catch (err) {
      // ORA-00054 (resource busy) u otro error de lock
      this.logger.error(
        `Error al bloquear fila de correlativo [${tipoAsamblea}-${asamblea}-${tipoDocemitido}]: ${err.message}`,
      );
      throw new InternalServerErrorException(
        'No se pudo reservar el correlativo. Intente nuevamente en unos segundos.',
      );
    }

    // ── Paso 2: Determinar el siguiente número ────────────────────────────
    let siguiente: number;

    if (!secuencia) {
      // Primera acreditación para esta combinación → iniciar la secuencia en 1.
      siguiente = 1;

      // INSERT de la fila de control con correlativo = 1.
      // Si hay un INSERT concurrente en la misma combinación (improbable pero posible
      // en la primera acreditación de una asamblea nueva), la violación de PK
      // se propagará como error y el ROLLBACK del llamador manejará el conflicto.
      await manager
        .createQueryBuilder()
        .insert()
        .into(ExpedienteSecuencia)
        .values({ tipoAsamblea, asamblea, tipoDocemitido, correlativo: 1 })
        .execute();

      this.logger.log(
        `Correlativo inicializado → [${tipoAsamblea}-${asamblea}-${tipoDocemitido}]: 1`,
      );
    } else {
      // Fila existente: incrementar atómicamente.
      siguiente = (secuencia.correlativo ?? 0) + 1;

      await manager
        .createQueryBuilder()
        .update(ExpedienteSecuencia)
        .set({ correlativo: siguiente })
        .where('tipoAsamblea = :ta', { ta: tipoAsamblea })
        .andWhere('asamblea = :a', { a: asamblea })
        .andWhere('tipoDocemitido = :td', { td: tipoDocemitido })
        .execute();

      this.logger.debug(
        `Correlativo reservado → [${tipoAsamblea}-${asamblea}-${tipoDocemitido}]: ${siguiente}`,
      );
    }

    // El correlativo queda "reservado" dentro de esta transacción.
    // El INSERT en ACCASAMBLEA que siga en la misma transacción usará este número.
    // Si algo falla antes del COMMIT → ROLLBACK → el correlativo regresa al valor anterior.
    return siguiente;
  }
}
