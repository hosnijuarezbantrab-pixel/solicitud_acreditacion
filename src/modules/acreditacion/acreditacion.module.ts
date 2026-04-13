import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Accasamblea } from './entities/accasamblea.entity';
import { AccasambleaHis } from './entities/accasamblea-his.entity';
import { AccDetinversionAsamblea } from './entities/acc-detinversion.entity';
import { ExpedienteSecuencia } from './entities/expediente-secuencia.entity';
import { AsambleaActual } from '../asambleas/entities/asamblea-actual.entity';
import { Accionista } from '../accionistas/entities/accionista.entity';
import { CorrelativoService } from './services/correlativo.service';
import { AcreditacionService } from './acreditacion.service';
import { AcreditacionController } from './acreditacion.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Accasamblea,
      AccasambleaHis,
      AccDetinversionAsamblea,
      ExpedienteSecuencia,
      AsambleaActual,
      Accionista,
    ]),
  ],
  providers: [CorrelativoService, AcreditacionService],
  controllers: [AcreditacionController],
  exports: [AcreditacionService, CorrelativoService],
})
export class AcreditacionModule {}
