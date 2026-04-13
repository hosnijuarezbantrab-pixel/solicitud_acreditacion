import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Accasamblea } from '../acreditacion/entities/accasamblea.entity';
import { AccasambleaHis } from '../acreditacion/entities/accasamblea-his.entity';
import { AsambleaActual } from '../asambleas/entities/asamblea-actual.entity';
import { Accionista } from '../accionistas/entities/accionista.entity';
import { ExpedientesService } from './expedientes.service';
import { ExpedientesController } from './expedientes.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Accasamblea,
      AccasambleaHis,
      AsambleaActual,
      Accionista,
    ]),
  ],
  providers: [ExpedientesService],
  controllers: [ExpedientesController],
  exports: [ExpedientesService],
})
export class ExpedientesModule {}
