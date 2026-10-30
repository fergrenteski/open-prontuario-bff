import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { correlationIdMiddleware } from '../api/comum/correlation-id.middleware';
import { ProblemDetailsFilter } from '../api/comum/problem-details.filter';
import { Config } from './config';

/** Configuração HTTP comum ao `main.ts` e aos testes E2E. */
export function configurarApp(app: INestApplication, config: Config): INestApplication {
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.setGlobalPrefix('api');
  app.use(correlationIdMiddleware);
  app.enableCors({ origin: config.corsOrigins, exposedHeaders: ['X-Correlation-Id'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ProblemDetailsFilter());

  // Swagger UI em /api/docs e JSON em /api/docs-json (rotas técnicas, públicas).
  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Open Prontuário — BFF (Backend for Frontend)')
      .setDescription(
        'Único ponto de entrada do frontend: autenticação, autorização por perfil, proxy CRUD, ' +
          'orquestração e agregação (`GET /api/aggregated-data`). Contrato: `contract/bff.openapi.yaml`.',
      )
      .setVersion('1.0.0')
      .setContact('Ana Paula Alves, Artur Bertoni, Bernardo Plottegher, Luiz Fernando Grenteski', '', '')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, documento);
  return app;
}
