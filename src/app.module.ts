import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from './database/redis.module';
import { AccionistasModule } from './modules/accionistas/accionistas.module';
import { AsambleasModule } from './modules/asambleas/asambleas.module';
import { AcreditacionModule } from './modules/acreditacion/acreditacion.module';
import { ExpedientesModule } from './modules/expedientes/expedientes.module';
import { FirmaIntegrationModule } from './modules/firma-integration/firma-integration.module';
import { CatalogosModule } from './modules/catalogos/catalogos.module';
import { AuthModule } from './modules/auth/auth.module';
import { ParticipacionModule } from './modules/participacion/participacion.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'oracle',
        host:     cfg.get('DB_HOST', 'localhost'),
        port:     cfg.get<number>('DB_PORT', 1521),
        sid:      cfg.get('DB_SID', 'ORCL'),
        username: cfg.get('DB_USERNAME', 'USR_CORE_ACC'),
        password: cfg.get('DB_PASSWORD', 'secret'),
        schema:   cfg.get('DB_SCHEMA', 'AC'),
        synchronize: false,
        logging: cfg.get('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
        entities: [__dirname + '/modules/**/*.entity{.ts,.js}'],
        extra: { lockTimeout: cfg.get<number>('DB_LOCK_TIMEOUT_MS', 10000) },
      }),
    }),

    RedisModule,
    ScheduleModule.forRoot(),

    AccionistasModule,
    AsambleasModule,
    AcreditacionModule,
    ExpedientesModule,
    FirmaIntegrationModule,
    CatalogosModule,
    AuthModule,
    ParticipacionModule,   // HU-XXXX: Limitación Funcional + Acompañante
  ],
})
export class AppModule {}
