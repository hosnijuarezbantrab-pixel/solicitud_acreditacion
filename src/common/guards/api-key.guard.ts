import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Guard de API Key simple.
 * Header requerido: X-Api-Key: <API_KEY_FRONTEND>
 * Endpoints marcados con @Public() se omiten.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req     = ctx.switchToHttp().getRequest<Request>();
    const key     = req.headers['x-api-key'] as string;
    const expected = process.env.API_KEY_FRONTEND || '';

    if (!expected || key !== expected) {
      throw new UnauthorizedException('API key inválida o ausente.');
    }
    return true;
  }
}
