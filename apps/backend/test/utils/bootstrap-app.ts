import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../../src/app.module';

/**
 * Boots a full Nest application (real PostgreSQL, real modules) with the
 * exact same global ValidationPipe configuration and Swagger setup as
 * src/main.ts, so e2e tests exercise validation/whitelisting behavior and
 * the actual API documentation identically to production.
 */
export async function bootstrapTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('WhatsApp Operations API')
    .setVersion('0.2.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.init();
  return app;
}

export function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export function testPhone(): string {
  return `+91${Math.floor(1_000_000_000 + Math.random() * 8_999_999_999)}`;
}
