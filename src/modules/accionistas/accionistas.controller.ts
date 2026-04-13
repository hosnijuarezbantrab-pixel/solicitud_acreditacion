import { Controller, Get, Patch, Put, Query, Param, Body, UseGuards } from '@nestjs/common';
import { AccionistasService } from './accionistas.service';
import { BuscarPorDpiDto, ActualizarDatosEditablesDto } from './dto/accionista.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { UsuarioActual } from '../../common/decorators/usuario.decorator';

@Controller('accionistas')
@UseGuards(ApiKeyGuard)
export class AccionistasController {
  constructor(private readonly svc: AccionistasService) {}

  /**
   * G-06 FIX: GET /api/accionistas/buscar?dpi=...
   * Frontend llama: call(`/accionistas/dpi/${dpi}`) → ahora redirigido
   * también con GET /api/accionistas/dpi/:dpi para backward compat
   */
  @Get('buscar')
  buscarPorDpi(@Query() dto: BuscarPorDpiDto) {
    return this.svc.buscarPorDpi(dto);
  }

  /** Alias para GET /accionistas/dpi/:dpi (compatibilidad con frontend) */
  @Get('dpi/:dpi')
  buscarPorDpiParam(@Param('dpi') dpi: string) {
    return this.svc.buscarPorDpi({ dpi });
  }

  @Get(':id')
  buscarPorCodigo(@Param('id') id: string) {
    return this.svc.buscarPorCodigo(id);
  }

  /**
   * G-17 FIX: acepta tanto PATCH (backend) como PUT (frontend).
   * Frontend llama: PUT /accionistas/:id/datos-personales
   */
  @Patch(':id/datos-editables')
  actualizarDatos(
    @Param('id') id: string,
    @Body() dto: ActualizarDatosEditablesDto,
    @UsuarioActual() usuario: string,
  ) {
    return this.svc.actualizarDatosEditables(id, dto, usuario);
  }

  @Put(':id/datos-personales')
  actualizarDatosPersonales(
    @Param('id') id: string,
    @Body() dto: ActualizarDatosEditablesDto,
    @UsuarioActual() usuario: string,
  ) {
    return this.svc.actualizarDatosEditables(id, dto, usuario);
  }

  /** G-10: GET /api/accionistas/:id/vigencia */
  @Get(':id/vigencia')
  vigencia(@Param('id') id: string) {
    return this.svc.buscarPorCodigo(id).then(acc => ({
      vigente: acc.vigente,
      meses: acc.mesesDesdeActualizacion,
      fecha_actualizacion: acc.fecha_actu_iso,
    }));
  }
}
