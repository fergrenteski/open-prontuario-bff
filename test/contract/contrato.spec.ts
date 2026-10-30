import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { load } from 'js-yaml';
import request from 'supertest';
import { criarApp, JWT_SECRET_TESTE } from '../support/app';

const METODOS = ['get', 'post', 'put', 'patch', 'delete'];
const IGNORADAS = /^\/api\/docs/;

/** `{MÉTODO caminho}` com parâmetros normalizados para `{}` (CONVENCOES §11). */
function operacoes(paths: Record<string, Record<string, unknown>>, prefixo = ''): Set<string> {
  const r = new Set<string>();
  for (const [caminho, item] of Object.entries(paths)) {
    const semPrefixo = caminho.startsWith(prefixo) ? caminho.slice(prefixo.length) || '/' : caminho;
    if (IGNORADAS.test(caminho)) continue;
    for (const m of Object.keys(item).filter((k) => METODOS.includes(k))) {
      r.add(`${m.toUpperCase()} ${semPrefixo.replace(/\{[^}]+\}/g, '{}')}`);
    }
  }
  return r;
}

describe('Contrato bff.openapi.yaml × rotas implementadas (Swagger gerado)', () => {
  let app: INestApplication;
  let gerado: { paths: Record<string, Record<string, { operationId?: string }>> };
  const contrato = load(readFileSync(join(__dirname, '../../contract/bff.openapi.yaml'), 'utf8')) as {
    paths: Record<string, Record<string, { operationId?: string }>>;
  };

  beforeAll(async () => {
    app = await criarApp({
      JWT_SECRET: JWT_SECRET_TESTE,
      MS_FILA_URL: 'http://127.0.0.1:1',
      MS_PRONTUARIO_URL: 'http://127.0.0.1:1',
      FN_VISAO_URL: 'http://127.0.0.1:1',
      INTERNAL_API_KEY: 'k',
    });
    gerado = (await request(app.getHttpServer()).get('/api/docs-json').expect(200)).body;
  });
  afterAll(() => app.close());

  it('Swagger UI é servido em /api/docs sem autenticação', async () => {
    await request(app.getHttpServer()).get('/api/docs/').expect(200).expect('Content-Type', /html/);
  });

  it('nenhuma rota faltando e nenhuma rota não documentada', () => {
    const esperado = operacoes(contrato.paths);
    const implementado = operacoes(gerado.paths, '/api');
    expect({
      faltando: [...esperado].filter((o) => !implementado.has(o)).sort(),
      naoDocumentadas: [...implementado].filter((o) => !esperado.has(o)).sort(),
    }).toEqual({ faltando: [], naoDocumentadas: [] });
    expect(esperado.size).toBe(33); // sanidade: o YAML foi lido por inteiro
  });

  it('operationId de cada rota igual ao do contrato', () => {
    const ids = (paths: typeof gerado.paths, prefixo = '') =>
      Object.entries(paths)
        .filter(([c]) => !IGNORADAS.test(c))
        .flatMap(([c, item]) =>
          Object.entries(item)
            .filter(([m]) => METODOS.includes(m))
            .map(([m, op]) => `${m.toUpperCase()} ${c.slice(prefixo.length).replace(/\{[^}]+\}/g, '{}')} ${op.operationId}`),
        )
        .sort();
    expect(ids(gerado.paths, '/api')).toEqual(ids(contrato.paths));
  });
});
