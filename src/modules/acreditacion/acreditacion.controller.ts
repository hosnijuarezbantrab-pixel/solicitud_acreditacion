import {
  Controller, Get, Post, Patch, Body, Param,
  Query, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { AcreditacionService } from './acreditacion.service';
import {
  RegistrarAcreditacionDto, ActualizarExpedienteDto, RegistrarMotivoRechazoDto,
} from './dto/acreditacion.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { UsuarioActual } from '../../common/decorators/usuario.decorator';

@Controller('acreditacion')
@UseGuards(ApiKeyGuard)
export class AcreditacionController {
  constructor(private readonly svc: AcreditacionService) {}

  /**
   * G-07 FIX: POST /api/acreditacion
   * Frontend llamaba a POST /asambleas/acreditar → ahora en /acreditacion
   * (El frontend api.js debe actualizarse — ver fixes del frontend)
   */
  @Post()
  registrar(@Body() dto: RegistrarAcreditacionDto, @UsuarioActual() usuario: string) {
    if (!dto.usuarioCrea) dto.usuarioCrea = usuario;
    return this.svc.registrarAcreditacion(dto);
  }

  @Get(':accionista')
  listarPorAccionista(@Param('accionista') accionista: string) {
    return this.svc.listarExpedientesDeAccionista(accionista);
  }

  @Get(':tipoAsamblea/:asamblea/:accionista/:tipoDocemitido')
  obtenerExpediente(
    @Param('tipoAsamblea') tipoAsamblea: string,
    @Param('asamblea') asamblea: string,
    @Param('accionista') accionista: string,
    @Param('tipoDocemitido', ParseIntPipe) tipoDocemitido: number,
  ) {
    return this.svc.obtenerExpediente(tipoAsamblea, asamblea, accionista, tipoDocemitido);
  }

  @Patch(':tipoAsamblea/:asamblea/:expediente/:tipoDocemitido')
  actualizar(
    @Param('tipoAsamblea') tipoAsamblea: string,
    @Param('asamblea') asamblea: string,
    @Param('expediente', ParseIntPipe) expediente: number,
    @Param('tipoDocemitido', ParseIntPipe) tipoDocemitido: number,
    @Body() dto: ActualizarExpedienteDto,
    @UsuarioActual() usuario: string,
  ) {
    if (!dto.usuarioActu) dto.usuarioActu = usuario;
    return this.svc.actualizarExpediente(tipoAsamblea, asamblea, expediente, tipoDocemitido, dto);
  }

  @Get('validar/:tipoAsamblea/:asamblea/:accionista')
  validarDuplicado(
    @Param('tipoAsamblea') tipoAsamblea: string,
    @Param('asamblea') asamblea: string,
    @Param('accionista') accionista: string,
  ) {
    return this.svc.validarAccionistaPorAsamblea(tipoAsamblea, asamblea, accionista);
  }
}
