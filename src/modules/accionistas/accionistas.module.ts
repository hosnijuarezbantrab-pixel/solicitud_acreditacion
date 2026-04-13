import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Accionista } from './entities/accionista.entity';
import { AccionistasService } from './accionistas.service';
import { AccionistasController } from './accionistas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Accionista])],
  providers: [AccionistasService],
  controllers: [AccionistasController],
  exports: [AccionistasService],
})
export class AccionistasModule {}
