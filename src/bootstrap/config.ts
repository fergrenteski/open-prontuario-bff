/**
 * Leitura e validação das variáveis de ambiente (CONVENCOES.md §7).
 * Falha cedo, com mensagem clara, quando a configuração é inválida ou insegura.
 */
export type AuthMode = 'dev' | 'entra';

export interface Config {
  port: number;
  nodeEnv: string;
  authMode: AuthMode;
  jwtSecret?: string;
  entraTenantId?: string;
  entraAudience?: string;
  msFilaUrl: string;
  msProntuarioUrl: string;
  fnVisaoUrl: string;
  internalApiKey: string;
  corsOrigins: string[];
  upstreamTimeoutMs: number;
}

export class ConfigInvalidaError extends Error {}

function obrigatoria(env: NodeJS.ProcessEnv, nome: string): string {
  const valor = env[nome]?.trim();
  if (!valor) throw new ConfigInvalidaError(`Variável de ambiente obrigatória ausente: ${nome}`);
  return valor;
}

function url(env: NodeJS.ProcessEnv, nome: string): string {
  const valor = obrigatoria(env, nome);
  try {
    new URL(valor);
  } catch {
    throw new ConfigInvalidaError(`${nome} não é uma URL válida: ${valor}`);
  }
  return valor.replace(/\/+$/, '');
}

function inteiroPositivo(env: NodeJS.ProcessEnv, nome: string, padrao: number): number {
  const bruto = env[nome]?.trim();
  if (!bruto) return padrao;
  const n = Number(bruto);
  if (!Number.isInteger(n) || n <= 0) throw new ConfigInvalidaError(`${nome} deve ser um inteiro positivo`);
  return n;
}

export function carregarConfig(env: NodeJS.ProcessEnv): Config {
  const nodeEnv = env.NODE_ENV?.trim() || 'development';
  const authMode = (env.AUTH_MODE?.trim() || 'dev') as AuthMode;
  if (authMode !== 'dev' && authMode !== 'entra') {
    throw new ConfigInvalidaError(`AUTH_MODE inválido: "${authMode}" (use dev ou entra)`);
  }

  if (nodeEnv === 'production' && authMode === 'dev' && env.ALLOW_DEV_AUTH_IN_PRODUCTION !== 'true') {
    throw new ConfigInvalidaError(
      'AUTH_MODE=dev não é permitido com NODE_ENV=production. Use AUTH_MODE=entra ' +
        'ou defina ALLOW_DEV_AUTH_IN_PRODUCTION=true conscientemente (apenas demonstração).',
    );
  }

  const config: Config = {
    port: inteiroPositivo(env, 'PORT', 3000),
    nodeEnv,
    authMode,
    msFilaUrl: url(env, 'MS_FILA_URL'),
    msProntuarioUrl: url(env, 'MS_PRONTUARIO_URL'),
    fnVisaoUrl: url(env, 'FN_VISAO_URL'),
    internalApiKey: obrigatoria(env, 'INTERNAL_API_KEY'),
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    upstreamTimeoutMs: inteiroPositivo(env, 'UPSTREAM_TIMEOUT_MS', 3000),
  };

  if (authMode === 'dev') {
    config.jwtSecret = obrigatoria(env, 'JWT_SECRET');
    if (config.jwtSecret.length < 32) throw new ConfigInvalidaError('JWT_SECRET deve ter ao menos 32 caracteres');
  } else {
    config.entraTenantId = obrigatoria(env, 'ENTRA_TENANT_ID');
    config.entraAudience = obrigatoria(env, 'ENTRA_AUDIENCE');
  }
  return config;
}
