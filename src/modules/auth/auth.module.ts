import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';

/** G-12 FIX: módulo de autenticación — valida supervisor */
@Module({ controllers: [AuthController] })
export class AuthModule {}
