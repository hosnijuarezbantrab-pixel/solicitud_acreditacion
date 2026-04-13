import { Module } from '@nestjs/common';
import { FirmaIntegrationService } from './firma-integration.service';
import { FirmaIntegrationController, AccionistasOtpController } from './firma-integration.controller';

@Module({
  providers: [FirmaIntegrationService],
  controllers: [FirmaIntegrationController, AccionistasOtpController],
  exports: [FirmaIntegrationService],
})
export class FirmaIntegrationModule {}
