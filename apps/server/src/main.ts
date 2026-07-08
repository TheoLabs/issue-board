import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // 로컬 개발: 프론트(Vite)에서의 접근 허용
  app.enableCors({ origin: true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`Issue Board server → http://localhost:${port}`, 'Bootstrap');
  Logger.log(`MCP endpoint      → http://localhost:${port}/mcp`, 'Bootstrap');
}

void bootstrap();
