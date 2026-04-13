import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsambleaActual } from './entities/asamblea-actual.entity';
import { AsambleasService } from './asambleas.service';
import { AsambleasController } from './asambleas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AsambleaActual])],
  providers: [AsambleasService],
  controllers: [AsambleasController],
  exports: [AsambleasService],
})
export class AsambleasModule {}
