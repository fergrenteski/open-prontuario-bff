import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ObterDadosAgregadosUseCase } from '../application/aggregated-data/obter-dados-agregados/obter-dados-agregados.use-case';
import { EmitirDevTokenUseCase } from '../application/auth/emitir-dev-token/emitir-dev-token.use-case';
import { ListarPersonasUseCase } from '../application/auth/listar-personas/listar-personas.use-case';
import { AvisarChegadaUseCase } from '../application/fila/avisar-chegada/avisar-chegada.use-case';
import { ListarFilaUseCase } from '../application/fila/listar-fila/listar-fila.use-case';
import { TOKEN_VERIFIER } from '../application/ports/token.port';
import { EncaminharRequisicaoUseCase } from '../application/proxy/encaminhar-requisicao/encaminhar-requisicao.use-case';
import { ListarUnidadesProximasUseCase } from '../application/unidades/listar-proximas/listar-unidades-proximas.use-case';
import { AggregatedDataController } from '../api/aggregated-data/aggregated-data.controller';
import { AuditoriaController } from '../api/auditoria/auditoria.controller';
import { AuthController } from '../api/auth/auth.controller';
import { JwtAuthGuard, RolesGuard } from '../api/auth/guards';
import { ConsentimentosController } from '../api/consentimentos/consentimentos.controller';
import { FilaController } from '../api/fila/fila.controller';
import { HealthController } from '../api/health/health.controller';
import { LotacoesController } from '../api/lotacoes/lotacoes.controller';
import { ProntuariosController } from '../api/prontuarios/prontuarios.controller';
import { UnidadesController } from '../api/unidades/unidades.controller';
import { DevJwt, EntraJwtVerifier } from '../infrastructure/auth/jwt';
import { HttpUpstreamClient } from '../infrastructure/http/http-upstream.client';
import {
  MsFilaHttpAdapter,
  MsProntuarioHttpAdapter,
  VisaoAgregadaHttpAdapter,
} from '../infrastructure/http/servicos.adapter';
import { Config } from './config';

/**
 * Composition root: único lugar que conhece api, application e infrastructure.
 * Os casos de uso são classes puras instanciadas aqui e registradas como providers.
 */
@Module({})
export class AppModule {
  static forRoot(config: Config): DynamicModule {
    const http = new HttpUpstreamClient({
      urls: {
        'ms-fila-sql': config.msFilaUrl,
        'ms-prontuario-mongo': config.msProntuarioUrl,
        'fn-visao-agregada': config.fnVisaoUrl,
      },
      internalApiKey: config.internalApiKey,
      timeoutMs: config.upstreamTimeoutMs,
    });
    const msFila = new MsFilaHttpAdapter(http);
    const msProntuario = new MsProntuarioHttpAdapter(http);
    const visao = new VisaoAgregadaHttpAdapter(http);
    const devJwt = config.authMode === 'dev' ? new DevJwt(config.jwtSecret!) : null;
    const verifier = devJwt ?? new EntraJwtVerifier(config.entraTenantId!, config.entraAudience!);

    return {
      module: AppModule,
      controllers: [
        HealthController,
        AuthController,
        AggregatedDataController,
        UnidadesController,
        LotacoesController,
        FilaController,
        ProntuariosController,
        ConsentimentosController,
        AuditoriaController,
      ],
      providers: [
        { provide: TOKEN_VERIFIER, useValue: verifier },
        { provide: ListarPersonasUseCase, useValue: new ListarPersonasUseCase(devJwt !== null) },
        { provide: EmitirDevTokenUseCase, useValue: new EmitirDevTokenUseCase(devJwt) },
        { provide: ObterDadosAgregadosUseCase, useValue: new ObterDadosAgregadosUseCase(msFila, msProntuario, visao) },
        { provide: ListarFilaUseCase, useValue: new ListarFilaUseCase(msFila, msProntuario) },
        { provide: AvisarChegadaUseCase, useValue: new AvisarChegadaUseCase(msFila, msProntuario) },
        { provide: ListarUnidadesProximasUseCase, useValue: new ListarUnidadesProximasUseCase(msFila, visao) },
        { provide: EncaminharRequisicaoUseCase, useValue: new EncaminharRequisicaoUseCase(http) },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    };
  }
}
