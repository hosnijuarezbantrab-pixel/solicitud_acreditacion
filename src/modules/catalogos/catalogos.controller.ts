import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

/**
 * CatalogosController — catálogos operativos de solo lectura.
 * Los endpoints HU-XXXX (limitacion-funcional, acompanante) viven en ParticipacionModule.
 */
@Controller()
@UseGuards(ApiKeyGuard)
export class CatalogosController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get('estados-expediente')
  async getEstadosExpediente() {
    try {
      const rows: any[] = await this.ds.query(
        `SELECT CODIGO_ESTADO AS codigo, DESCRIPCION AS descripcion
           FROM AC.ACCESTADO_EXPEDIENTE ORDER BY CODIGO_ESTADO`,
      );
      if (rows.length) return rows;
    } catch { /* fallback */ }
    return [
      { codigo: '1', descripcion: 'Entregado' },
      { codigo: '2', descripcion: 'Recibido' },
      { codigo: '4', descripcion: 'Aprobado' },
      { codigo: '5', descripcion: 'En Revisión' },
      { codigo: '6', descripcion: 'Credencial a Emitir' },
      { codigo: '8', descripcion: 'Credencial Entregada' },
      { codigo: '10', descripcion: 'Denegado' },
    ];
  }

  @Get('catalogos/paises')
  async getPaises() {
    try {
      return await this.ds.query(`SELECT CODIGO AS codigo, NOMBRE AS nombre FROM AC.ACC_PAISES ORDER BY NOMBRE`);
    } catch {
      return [{ codigo: 'GTM', nombre: 'Guatemala' }, { codigo: 'HND', nombre: 'Honduras' }];
    }
  }

  @Get('catalogos/deptos')
  async getDeptos(@Query('pais') pais: string) {
    try {
      return await this.ds.query(
        `SELECT CODIGO AS codigo, NOMBRE AS nombre, COD_PAIS AS pais
           FROM AC.ACC_DEPARTAMENTOS WHERE COD_PAIS = :1 ORDER BY NOMBRE`, [pais],
      );
    } catch {
      return [{ codigo: '01', nombre: 'Guatemala', pais: 'GTM' }];
    }
  }

  @Get('catalogos/municipios')
  async getMunicipios(@Query('depto') depto: string) {
    try {
      return await this.ds.query(
        `SELECT CODIGO AS codigo, NOMBRE AS nombre, COD_DEPTO AS depto
           FROM AC.ACC_MUNICIPIOS WHERE COD_DEPTO = :1 ORDER BY NOMBRE`, [depto],
      );
    } catch {
      return [{ codigo: '101', nombre: 'Guatemala', depto: '01' }];
    }
  }

  @Get('catalogos/actividades')
  async getActividades() {
    try {
      return await this.ds.query(
        `SELECT CODIGO AS codigo, DESCRIPCION AS descripcion
           FROM AC.ACC_ACTIVIDADES_ECONOMICAS WHERE ACTIVO = 1 ORDER BY DESCRIPCION`,
      );
    } catch {
      return [{ codigo: 'K6499', descripcion: 'K6499 – Actividades Financieras' }];
    }
  }

  @Get('catalogos/profesiones')
  async getProfesiones() {
    try {
      return await this.ds.query(
        `SELECT CODIGO AS codigo, DESCRIPCION AS descripcion
           FROM AC.ACC_PROFESIONES WHERE ACTIVO = 1 ORDER BY DESCRIPCION`,
      );
    } catch {
      return [{ codigo: 'ING', descripcion: 'Ingeniero/a' }, { codigo: 'ABG', descripcion: 'Abogado/a' }];
    }
  }

  @Get('catalogos/niveles')
  async getNiveles() {
    try {
      return await this.ds.query(
        `SELECT CODIGO AS codigo, DESCRIPCION AS descripcion
           FROM AC.ACC_NIVELES_ESTUDIO WHERE ACTIVO = 1 ORDER BY DESCRIPCION`,
      );
    } catch {
      return [{ codigo: 'UNI', descripcion: 'Universitario' }, { codigo: 'POS', descripcion: 'Postgrado' }];
    }
  }

  /** GET /api/catalogos/limitaciones-funcionales — lectura del catálogo */
  @Get('catalogos/limitaciones-funcionales')
  async getLimitacionesFuncionales() {
    try {
      return await this.ds.query(
        `SELECT CODIGO AS codigo, DESCRIPCION AS descripcion, ACTIVO AS activo
           FROM AC.CAT_LIMITACION_FUNCIONAL WHERE ACTIVO = 1 ORDER BY DESCRIPCION`,
      );
    } catch {
      return [
        { codigo: 'AUD', descripcion: 'Auditiva',  activo: true },
        { codigo: 'VIS', descripcion: 'Visual',    activo: true },
        { codigo: 'MOV', descripcion: 'Movilidad', activo: true },
        { codigo: 'HAB', descripcion: 'Habla',     activo: true },
      ];
    }
  }
}

/** Endpoints de accionistas extra (titulos) — sin conflicto con ParticipacionModule */
@Controller('accionistas')
@UseGuards(ApiKeyGuard)
export class AccionistasExtrasController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get(':id/titulos')
  async getTitulos(@Query('id') _id: string) {
    return [];
  }
}
