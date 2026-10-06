import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Scoped to the actual frontend dev origin (not a wildcard) — this API
  // has no authentication yet, so an open CORS policy would let any site
  // read/write operational data on behalf of a visitor's browser.
  const config = app.get(ConfigService);
  const frontendOrigin = config.get<string>(
    'FRONTEND_ORIGIN',
    'http://localhost:5173',
  );
  app.enableCors({ origin: frontendOrigin });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const documentConfig = new DocumentBuilder()
    .setTitle('WhatsApp Operations API')
    .setDescription(
      'Groups, Team Members, Group Membership, Keywords, Issues, SLA, EOD, Dashboard, and n8n Event APIs. ' +
        'Event endpoints require the X-N8N-Webhook-Secret header. Frontend/CEO-facing authentication is a later phase.',
    )
    .setVersion('0.2.0')
    .build();
  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup('api-docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
void bootstrap();
