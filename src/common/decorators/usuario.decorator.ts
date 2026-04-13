import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/** Extrae el usuario del header X-Usuario (inyectado por el sistema Core). */
export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return (req.headers['x-usuario'] as string) ?? 'SISTEMA';
  },
);

export const IpCliente = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.ip || req.socket?.remoteAddress || '0.0.0.0';
  },
);
