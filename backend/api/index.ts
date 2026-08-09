import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import express, { Express, Request, Response } from 'express';
import { AppModule } from '../src/app.module';
import { ensureDatabase } from '../src/bootstrap-db';

let cached: Express | null = null;

async function createApp(): Promise<Express> {
  if (cached) return cached;

  await ensureDatabase();

  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn', 'log'],
  });
  app.enableCors({ origin: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.init();
  cached = server;
  return server;
}

export default async function handler(req: Request, res: Response) {
  const server = await createApp();
  return server(req, res);
}
