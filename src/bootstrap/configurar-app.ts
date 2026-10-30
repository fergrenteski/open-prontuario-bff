import { INestApplication, ValidationPipe } from '@nestjs/common';
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
  return app;
}
