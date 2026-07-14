import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { requestContext } from './common/request-context';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // 로컬 개발: 프론트(Vite)에서의 접근 허용
  app.enableCors({ origin: true, credentials: true });

  // 활동 로그 주체 판별: /mcp 는 Claude(agent), 그 외 REST 는 웹 사용자(user).
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const source = req.path.startsWith('/mcp') ? 'agent' : 'user';
    requestContext.run({ source }, () => next());
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`Issue Board server → http://localhost:${port}`, 'Bootstrap');
  Logger.log(`MCP endpoint      → http://localhost:${port}/mcp`, 'Bootstrap');
}

void bootstrap();
