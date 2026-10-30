import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { carregarConfig, Config } from './config';
import { configurarApp } from './configurar-app';

async function main() {
  let config: Config;
  try {
    config = carregarConfig(process.env);
  } catch (erro) {
    console.error(`[open-prontuario-bff] Configuração inválida: ${(erro as Error).message}`);
    process.exit(1);
  }
  const app = configurarApp(await NestFactory.create(AppModule.forRoot(config)), config);
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  new Logger('Bootstrap').log(`BFF ouvindo na porta ${config.port} (AUTH_MODE=${config.authMode})`);
}

void main();
