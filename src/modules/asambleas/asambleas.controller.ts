import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AsambleasService } from './asambleas.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

@Controller('asambleas')
@UseGuards(ApiKeyGuard)
export class AsambleasController {
  constructor(
    private readonly svc: AsambleasService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  /** GET /api/asambleas/activas */
  @Get('activas')
  getActivas() { return this.svc.getAsambleasActivas(); }

  /**
   * G-10 FIX: GET /api/asambleas/:asmId/valida-accionista/:accId
   * Frontend llama: call(`/asambleas/${asmId}/valida-accionista/${accId}`)
   * asmId en el frontend es el campo `id` ('O|ASM-2025-01')
   */
  @Get(':asmId/valida-accionista/:accId')
  async validarAccionista(
    @Param('asmId') asmId: string,
    @Param('accId') accId: string,
  ) {
    const [tipo, asamblea] = this.parseAsmId(asmId);
    const rows: any[] = await this.ds.query(
      `SELECT COUNT(1) AS cnt FROM AC.ACCASAMBLEA
        WHERE TIPO_ASAMBLEA = :1 AND ASAMBLEA = :2 AND ACCIONISTA = :3`,
      [tipo, asamblea, accId],
    );
    const existe = (Number(rows[0]?.cnt ?? rows[0]?.CNT ?? 0)) > 0;
    return { existe, expediente: existe ? 'DUPLICADO' : null };
  }

  /**
   * G-10 FIX: GET /api/asambleas/:asmId/expediente/:accId
   * Frontend llama: call(`/asambleas/${asmId}/expediente/${accId}`)
   */
  @Get(':asmId/expediente/:accId')
  async getExpediente(
    @Param('asmId') asmId: string,
    @Param('accId') accId: string,
  ) {
    const [tipo, asamblea] = this.parseAsmId(asmId);
    const rows: any[] = await this.ds.query(
      `SELECT * FROM AC.ACCASAMBLEA
        WHERE TIPO_ASAMBLEA = :1 AND ASAMBLEA = :2 AND ACCIONISTA = :3
          AND ROWNUM = 1`,
      [tipo, asamblea, accId],
    );
    return rows[0] ?? null;
  }

  /**
   * G-10 FIX: GET /api/asambleas/:asmId/detalle-inversion/:accId
   * Frontend llama: call(`/asambleas/${asmId}/detalle-inversion/${accId}`)
   */
  @Get(':asmId/detalle-inversion/:accId')
  async getDetalleInversion(
    @Param('asmId') asmId: string,
    @Param('accId') accId: string,
  ) {
    const [tipo, asamblea] = this.parseAsmId(asmId);
    try {
      return await this.ds.query(
        `SELECT TIPO_DOCUMEN AS tipo_doc, DESCRIPCION_TIPO AS descripcion,
                CANTIDAD_ACCIONES AS cantidad
           FROM AC.ACC_DETINVERSION_ASAMBLEA
          WHERE TIPO_ASAMBLEA = :1 AND ASAMBLEA = :2 AND ACCIONISTA = :3`,
        [tipo, asamblea, accId],
      );
    } catch {
      return [];
    }
  }

  /** Parsea el id de asamblea del frontend: 'O|ASM-2025-01' → ['O', 'ASM-2025-01'] */
  private parseAsmId(asmId: string): [string, string] {
    if (asmId.includes('|')) {
      const [tipo, asamblea] = asmId.split('|');
      return [tipo, asamblea];
    }
    // Fallback: si viene solo el número de asamblea
    return ['O', asmId];
  }
}
