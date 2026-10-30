import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/bootstrap/app.module';
import { carregarConfig } from '../../src/bootstrap/config';
import { configurarApp } from '../../src/bootstrap/configurar-app';

/** Sobe o BFF real (sem porta) com a mesma configuração do main.ts. */
export async function criarApp(env: NodeJS.ProcessEnv): Promise<INestApplication> {
  const config = carregarConfig(env);
  const modulo = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] }).compile();
  const app = configurarApp(modulo.createNestApplication({ logger: false }), config);
  await app.init();
  return app;
}

export const JWT_SECRET_TESTE = 'segredo-e2e-com-pelo-menos-32-caracteres';
