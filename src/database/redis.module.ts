import { Module, Global, Logger } from '@nestjs/common';
import Redis from 'ioredis';

const logger = new Logger('RedisModule');

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (): Redis => {
        const client = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB || '0', 10),
          keyPrefix: 'bantrab:acc:',
          retryStrategy: (times) => {
            const delay = Math.min(times * 200, 5000);
            logger.warn(`Redis reconectando... intento ${times}, esperando ${delay}ms`);
            return delay;
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
        });

        client.on('connect', () => logger.log('Redis conectado'));
        client.on('ready',   () => logger.log('Redis listo'));
        client.on('error',   (err) => logger.error(`Redis error: ${err.message}`));
        client.on('close',   () => logger.warn('Redis conexión cerrada'));

        return client;
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
