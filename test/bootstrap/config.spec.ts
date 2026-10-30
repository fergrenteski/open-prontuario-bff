import { carregarConfig, ConfigInvalidaError } from '../../src/bootstrap/config';

const base = {
  MS_FILA_URL: 'http://fila:8081/',
  MS_PRONTUARIO_URL: 'http://prontuario:8082',
  FN_VISAO_URL: 'http://fn:80',
  INTERNAL_API_KEY: 'chave',
  JWT_SECRET: 'x'.repeat(32),
};

describe('carregarConfig', () => {
  it('aplica padrões e normaliza URLs e CORS', () => {
    const c = carregarConfig({ ...base, CORS_ORIGINS: 'http://a, http://b ,' });
    expect(c).toMatchObject({
      port: 3000,
      authMode: 'dev',
      msFilaUrl: 'http://fila:8081',
      upstreamTimeoutMs: 3000,
      corsOrigins: ['http://a', 'http://b'],
    });
  });

  it('falha ao subir em produção com AUTH_MODE=dev sem a flag explícita', () => {
    expect(() => carregarConfig({ ...base, NODE_ENV: 'production', AUTH_MODE: 'dev' })).toThrow(
      /AUTH_MODE=dev não é permitido com NODE_ENV=production/,
    );
    expect(() =>
      carregarConfig({ ...base, NODE_ENV: 'production', AUTH_MODE: 'dev', ALLOW_DEV_AUTH_IN_PRODUCTION: 'false' }),
    ).toThrow(ConfigInvalidaError);
  });

  it('permite modo dev em produção somente com ALLOW_DEV_AUTH_IN_PRODUCTION=true', () => {
    const c = carregarConfig({ ...base, NODE_ENV: 'production', ALLOW_DEV_AUTH_IN_PRODUCTION: 'true' });
    expect(c.authMode).toBe('dev');
  });

  it('modo entra exige tenant e audience', () => {
    expect(() => carregarConfig({ ...base, AUTH_MODE: 'entra' })).toThrow(/ENTRA_TENANT_ID/);
    const c = carregarConfig({ ...base, AUTH_MODE: 'entra', ENTRA_TENANT_ID: 't', ENTRA_AUDIENCE: 'api://bff' });
    expect(c.entraAudience).toBe('api://bff');
  });

  it.each([
    [{ AUTH_MODE: 'basic' }, /AUTH_MODE inválido/],
    [{ JWT_SECRET: 'curto' }, /32 caracteres/],
    [{ JWT_SECRET: '' }, /JWT_SECRET/],
    [{ MS_FILA_URL: 'nao-e-url' }, /MS_FILA_URL não é uma URL válida/],
    [{ INTERNAL_API_KEY: ' ' }, /INTERNAL_API_KEY/],
    [{ UPSTREAM_TIMEOUT_MS: '-1' }, /UPSTREAM_TIMEOUT_MS/],
    [{ PORT: 'abc' }, /PORT/],
  ])('rejeita configuração inválida %j', (extra, erro) => {
    expect(() => carregarConfig({ ...base, ...extra })).toThrow(erro);
  });
});
