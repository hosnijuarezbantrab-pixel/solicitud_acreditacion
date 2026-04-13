import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

class ValidarSupervisorDto {
  @IsString() @IsNotEmpty() usuario: string;
  @IsString() @IsNotEmpty() clave: string;
}

/**
 * G-12 FIX: POST /api/auth/supervisor
 * Valida credenciales de supervisor (FLAGCOORDINADOR='S' OR FLAGJEFEDEPTO='S').
 * Llamado por AutorizacionModal del frontend.
 */
@Controller('auth')
@UseGuards(ApiKeyGuard)
export class AuthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Post('supervisor')
  async validarSupervisor(@Body() dto: ValidarSupervisorDto) {
    try {
      const rows: any[] = await this.ds.query(
        `SELECT NOMBRE_USUARIO AS nombre,
                FLAGCOORDINADOR, FLAGJEFEDEPTO
           FROM AC.ACCUSUARIO
          WHERE USUARIO_SISTEMA = :1
            AND PASSWORD_SISTEMA = :2
            AND (FLAGCOORDINADOR = 'S' OR FLAGJEFEDEPTO = 'S')
            AND ROWNUM = 1`,
        [dto.usuario.trim(), dto.clave],
      );

      if (!rows.length) {
        throw new BadRequestException(
          'Credenciales incorrectas o usuario sin permisos de supervisor.',
        );
      }

      return {
        autorizado: true,
        nombre: rows[0].nombre ?? rows[0].NOMBRE_USUARIO ?? dto.usuario.toUpperCase(),
      };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;

      // Fallback demo — solo en desarrollo
      if (process.env.NODE_ENV !== 'production') {
        if (dto.usuario === 'supervisor' && dto.clave === '1234') {
          return { autorizado: true, nombre: 'SUPERVISOR BANTRAB' };
        }
      }
      throw new BadRequestException('Credenciales incorrectas o usuario sin permisos de supervisor.');
    }
  }
}
