import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarApp, JWT_SECRET_TESTE } from '../support/app';
import { ServidorFalso } from '../support/servidor-falso';

const unidade = { id: 'upa-01', nome: 'UPA Boa Vista', tipo: 'UPA', latitude: -25.3866, longitude: -49.2346 };
const registro = (id: string, pacienteId: string) => ({
  id,
  pacienteId,
  unidadeId: 'upa-01',
  prioridade: 'URGENTE',
  status: 'AGUARDANDO',
  sintomas: ['febre alta'],
  horarioAviso: '2026-10-30T10:00:00-03:00',
});
const visao = (unidadeId: string) => ({
  unidadeId,
  totalPresente: 1,
  totalACaminho: 2,
  tempoMedioEsperaMin: 10,
  nivelCongestionamento: 'BAIXO',
  atualizadoEm: null,
});
const problema = (status: number, codigo: string) => ({
  body: { type: 'about:blank', title: 'Erro do serviço', status, detail: 'detalhe do serviço', codigo },
  status,
  contentType: 'application/problem+json',
});

describe('BFF (E2E contra serviços HTTP falsos)', () => {
  let app: INestApplication;
  const fila = new ServidorFalso();
  const pront = new ServidorFalso();
  const fn = new ServidorFalso();
  const tokens: Record<string, string> = {};

  const api = () => request(app.getHttpServer());
  const como = (persona: string) => ({ Authorization: `Bearer ${tokens[persona]}` });

  beforeAll(async () => {
    await Promise.all([fila.iniciar(), pront.iniciar(), fn.iniciar()]);
    app = await criarApp({
      AUTH_MODE: 'dev',
      JWT_SECRET: JWT_SECRET_TESTE,
      MS_FILA_URL: fila.url,
      MS_PRONTUARIO_URL: pront.url,
      FN_VISAO_URL: fn.url,
      INTERNAL_API_KEY: 'chave-e2e',
      UPSTREAM_TIMEOUT_MS: '300',
      CORS_ORIGINS: 'http://localhost:5173',
    });
    for (const p of ['pac-101', 'usr-atendente-07', 'usr-prof-03', 'usr-gestor-01']) {
      const r = await api().post('/api/auth/dev-token').send({ usuarioId: p }).expect(200);
      tokens[p] = r.body.accessToken;
    }
  });

  afterEach(() => [fila, pront, fn].forEach((s) => s.limpar()));
  afterAll(async () => {
    await app.close();
    await Promise.all([fila.parar(), pront.parar(), fn.parar()]);
  });

  describe('público e autenticação', () => {
    it('GET /api/health é público e devolve X-Correlation-Id', async () => {
      const r = await api().get('/api/health').expect(200, { status: 'UP' });
      expect(r.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('reaproveita o X-Correlation-Id recebido e ignora valores inseguros', async () => {
      await api().get('/api/health').set('X-Correlation-Id', 'abc-123').expect('X-Correlation-Id', 'abc-123');
      const r = await api().get('/api/health').set('X-Correlation-Id', 'a b<script>');
      expect(r.headers['x-correlation-id']).not.toBe('a b<script>');
    });

    it('lista as personas do modo dev', async () => {
      const r = await api().get('/api/auth/personas').expect(200);
      expect(r.body.map((p: { id: string }) => p.id)).toEqual([
        'pac-101',
        'pac-102',
        'usr-atendente-07',
        'usr-prof-03',
        'usr-gestor-01',
      ]);
    });

    it('dev-token: persona inexistente 404, corpo inválido 400, JSON quebrado 400', async () => {
      await api().post('/api/auth/dev-token').send({ usuarioId: 'nao-existe' }).expect(404);
      const r = await api().post('/api/auth/dev-token').send({ outro: 1 }).expect(400);
      expect(r.body).toMatchObject({ status: 400, codigo: 'REQUISICAO_INVALIDA' });
      await api().post('/api/auth/dev-token').set('Content-Type', 'application/json').send('{quebrado').expect(400);
    });

    it('GET /api/auth/me devolve o usuário do token', async () => {
      await api()
        .get('/api/auth/me')
        .set(como('usr-prof-03'))
        .expect(200, { id: 'usr-prof-03', nome: 'Dr. Paulo Lima', roles: ['PROFISSIONAL'] });
    });

    it('sem token → 401 problem+json com correlationId', async () => {
      const r = await api().get('/api/unidades').set('X-Correlation-Id', 'corr-401').expect(401);
      expect(r.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(r.body).toMatchObject({
        status: 401,
        codigo: 'NAO_AUTENTICADO',
        correlationId: 'corr-401',
        instance: '/api/unidades',
      });
      expect(JSON.stringify(r.body)).not.toMatch(/at .*\.ts/);
    });

    it('token inválido → 401', async () => {
      await api().get('/api/unidades').set('Authorization', 'Bearer x.y.z').expect(401);
      await api().get('/api/unidades').set('Authorization', 'Basic abc').expect(401);
    });

    it('perfil errado → 403 SEM_PERMISSAO (sem chamar o serviço)', async () => {
      const r = await api().get('/api/aggregated-data?unidadeId=upa-01').set(como('pac-101')).expect(403);
      expect(r.body.codigo).toBe('SEM_PERMISSAO');
      await api().post('/api/unidades').set(como('usr-atendente-07')).send({}).expect(403);
      expect(fila.recebidas).toHaveLength(0);
    });

    it('rota inexistente → 404 problem+json', async () => {
      const r = await api().get('/api/nada').set(como('usr-gestor-01')).expect(404);
      expect(r.body.codigo).toBe('RECURSO_NAO_ENCONTRADO');
    });

    it('CORS libera apenas as origens configuradas', async () => {
      const ok = await api().get('/api/health').set('Origin', 'http://localhost:5173');
      expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      const nao = await api().get('/api/health').set('Origin', 'http://malicioso.example');
      expect(nao.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('GET /api/aggregated-data', () => {
    const rotasOk = () => {
      fila.rotas['GET /unidades/upa-01'] = { body: unidade };
      fila.rotas['GET /fila/upa-01'] = { body: [registro('r1', 'pac-101'), registro('r2', 'pac-102')] };
      pront.rotas['GET /internal/consentimentos/validos'] = { body: { unidadeId: 'upa-01', pacienteIds: ['pac-101'] } };
      pront.rotas['GET /prontuarios/pac-101'] = { body: { id: 'pront-001', pacienteId: 'pac-101', alergias: ['dipirona'] } };
      fn.rotas['GET /api/visao-agregada/upa-01'] = { body: visao('upa-01') };
    };

    it('agrega as três fontes e propaga os headers a todas elas', async () => {
      rotasOk();
      const r = await api()
        .get('/api/aggregated-data?unidadeId=upa-01&pacienteId=pac-101')
        .set(como('usr-atendente-07'))
        .set('X-Correlation-Id', 'corr-agg')
        .expect(200);

      expect(r.body).toMatchObject({
        unidade,
        visaoAgregada: visao('upa-01'),
        prontuario: { id: 'pront-001' },
        meta: { correlationId: 'corr-agg', degraded: false, falhas: [], avisos: [] },
      });
      expect(r.body.fila.map((x: { prontuarioAutorizado: boolean }) => x.prontuarioAutorizado)).toEqual([true, false]);
      expect(r.body.meta.fontes.map((f: { status: string }) => f.status)).toEqual(['ok', 'ok', 'ok']);

      const todas = [...fila.recebidas, ...pront.recebidas, ...fn.recebidas];
      expect(todas.map((x) => `${x.method} ${x.url}`).sort()).toEqual([
        'GET /api/visao-agregada/upa-01',
        'GET /fila/upa-01',
        'GET /internal/consentimentos/validos?unidadeId=upa-01',
        'GET /prontuarios/pac-101?unidadeId=upa-01',
        'GET /unidades/upa-01',
      ]);
      for (const x of todas) {
        expect(x.headers).toMatchObject({
          'x-internal-key': 'chave-e2e',
          'x-user-id': 'usr-atendente-07',
          'x-user-roles': 'ATENDENTE',
          'x-correlation-id': 'corr-agg',
        });
        expect(x.headers['x-user-name']).toBeDefined();
        expect(x.headers.authorization).toBeUndefined();
      }
    });

    it('Function fora (timeout) → 200 degradado', async () => {
      rotasOk();
      fn.rotas['GET /api/visao-agregada/upa-01'] = { body: visao('upa-01'), atrasoMs: 1000 };
      const r = await api().get('/api/aggregated-data?unidadeId=upa-01').set(como('usr-gestor-01')).expect(200);
      expect(r.body.visaoAgregada).toBeNull();
      expect(r.body.meta).toMatchObject({ degraded: true, falhas: [{ fonte: 'fn-visao-agregada', motivo: 'timeout' }] });
    });

    it('403 do MS Prontuário vira aviso', async () => {
      rotasOk();
      pront.rotas['GET /prontuarios/pac-102'] = problema(403, 'CONSENTIMENTO_AUSENTE');
      const r = await api()
        .get('/api/aggregated-data?unidadeId=upa-01&pacienteId=pac-102')
        .set(como('usr-prof-03'))
        .expect(200);
      expect(r.body.prontuario).toBeNull();
      expect(r.body.meta.degraded).toBe(false);
      expect(r.body.meta.avisos).toEqual(['ms-prontuario-mongo: detalhe do serviço (CONSENTIMENTO_AUSENTE)']);
    });

    it('todas as fontes falham → 502 AGREGACAO_FALHOU', async () => {
      fila.rotas['GET /unidades/upa-01'] = problema(500, 'ERRO');
      fila.rotas['GET /fila/upa-01'] = problema(500, 'ERRO');
      pront.rotas['GET /internal/consentimentos/validos'] = problema(503, 'DEPENDENCIA_INDISPONIVEL');
      fn.rotas['GET /api/visao-agregada/upa-01'] = problema(500, 'ERRO');
      const r = await api().get('/api/aggregated-data?unidadeId=upa-01').set(como('usr-gestor-01')).expect(502);
      expect(r.body).toMatchObject({ status: 502, codigo: 'AGREGACAO_FALHOU' });
    });

    it('sem unidadeId → 400', async () => {
      const r = await api().get('/api/aggregated-data').set(como('usr-gestor-01')).expect(400);
      expect(r.body.codigo).toBe('REQUISICAO_INVALIDA');
    });
  });

  describe('orquestrações', () => {
    it('POST aviso-chegada com autorização concede o consentimento', async () => {
      fila.rotas['POST /fila/upa-01/aviso-chegada'] = { status: 201, body: { ...registro('r1', 'pac-101'), status: 'A_CAMINHO' } };
      pront.rotas['POST /consentimentos'] = problema(409, 'CONSENTIMENTO_DUPLICADO');
      const r = await api()
        .post('/api/fila/upa-01/aviso-chegada')
        .set(como('pac-101'))
        .send({ sintomas: ['febre alta'], tempoEstimadoChegadaMin: 10, autorizarProntuario: true, validadeConsentimentoDias: 7 })
        .expect(201);
      expect(r.body).toMatchObject({ id: 'r1', prontuarioAutorizado: true, avisos: [] });
      expect(JSON.parse(fila.recebidas[0].body)).toEqual({ sintomas: ['febre alta'], tempoEstimadoChegadaMin: 10 });
      expect(fila.recebidas[0].headers).toMatchObject({ 'x-user-id': 'pac-101', 'x-user-roles': 'PACIENTE' });
      expect(JSON.parse(pront.recebidas[0].body)).toEqual({ unidadeId: 'upa-01', validadeDias: 7 });
    });

    it('POST aviso-chegada: 409 do MS Fila é repassado', async () => {
      fila.rotas['POST /fila/upa-01/aviso-chegada'] = problema(409, 'REGISTRO_ATIVO_DUPLICADO');
      const r = await api().post('/api/fila/upa-01/aviso-chegada').set(como('pac-101')).send({ sintomas: ['dor'] }).expect(409);
      expect(r.body.codigo).toBe('REGISTRO_ATIVO_DUPLICADO');
    });

    it('POST aviso-chegada valida o corpo', async () => {
      await api().post('/api/fila/upa-01/aviso-chegada').set(como('pac-101')).send({ sintomas: [] }).expect(400);
      await api()
        .post('/api/fila/upa-01/aviso-chegada')
        .set(como('pac-101'))
        .send({ sintomas: ['febre'], validadeConsentimentoDias: 999 })
        .expect(400);
      await api()
        .post('/api/fila/upa-01/aviso-chegada')
        .set(como('pac-101'))
        .send({ sintomas: ['febre'], pacienteId: 'outro' })
        .expect(400);
      expect(fila.recebidas).toHaveLength(0);
    });

    it('GET /api/fila/:id marca prontuarioAutorizado e repassa o filtro', async () => {
      fila.rotas['GET /fila/upa-01'] = { body: [registro('r1', 'pac-101')] };
      pront.rotas['GET /internal/consentimentos/validos'] = problema(500, 'X');
      const r = await api().get('/api/fila/upa-01?status=AGUARDANDO').set(como('usr-atendente-07')).expect(200);
      expect(r.body[0].prontuarioAutorizado).toBeNull();
      expect(fila.recebidas[0].url).toBe('/fila/upa-01?status=AGUARDANDO');
      await api().get('/api/fila/upa-01?status=INVALIDO').set(como('usr-atendente-07')).expect(400);
    });

    it('GET /api/unidades/proximas agrega a Function e degrada se ela cair', async () => {
      fila.rotas['GET /unidades/proximas'] = { body: [{ ...unidade, distanciaKm: 2.1 }] };
      fn.rotas['GET /api/visao-agregada'] = { body: [visao('upa-01')] };
      const ok = await api()
        .get('/api/unidades/proximas?latitude=-25.43&longitude=-49.27&raioKm=10')
        .set(como('pac-101'))
        .expect(200);
      expect(ok.body[0]).toMatchObject({ id: 'upa-01', distanciaKm: 2.1, visaoAgregada: { totalACaminho: 2 } });
      expect(fn.recebidas[0].url).toBe('/api/visao-agregada?unidadeIds=upa-01');

      fn.rotas['GET /api/visao-agregada'] = problema(500, 'ERRO');
      const degradado = await api().get('/api/unidades/proximas?latitude=-25.43&longitude=-49.27').set(como('pac-101')).expect(200);
      expect(degradado.body[0].visaoAgregada).toBeNull();

      await api().get('/api/unidades/proximas?latitude=200&longitude=0').set(como('pac-101')).expect(400);
    });
  });

  describe('proxy CRUD', () => {
    it('repassa método, caminho, query, corpo e status (204)', async () => {
      fila.rotas['DELETE /fila/r1?motivo=ATENDIDO'] = { status: 204 };
      await api().delete('/api/fila/r1?motivo=ATENDIDO').set(como('usr-prof-03')).expect(204);
      expect(fila.recebidas[0]).toMatchObject({ method: 'DELETE', url: '/fila/r1?motivo=ATENDIDO' });

      fila.rotas['PATCH /fila/r1/prioridade'] = { body: { id: 'r1', prioridade: 'EMERGENCIA' } };
      await api()
        .patch('/api/fila/r1/prioridade')
        .set(como('usr-atendente-07'))
        .send({ prioridade: 'EMERGENCIA', justificativa: 'triagem' })
        .expect(200, { id: 'r1', prioridade: 'EMERGENCIA' });
      expect(JSON.parse(fila.recebidas[1].body)).toEqual({ prioridade: 'EMERGENCIA', justificativa: 'triagem' });
    });

    it('repassa erros do serviço com o mesmo status, content-type e corpo', async () => {
      const p = problema(403, 'CONSENTIMENTO_AUSENTE');
      pront.rotas['GET /prontuarios/pac-102'] = p;
      const r = await api().get('/api/prontuarios/pac-102?unidadeId=upa-01').set(como('usr-prof-03')).expect(403);
      expect(r.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(r.body).toEqual(p.body);
    });

    it('timeout ou serviço fora → 503 DEPENDENCIA_INDISPONIVEL', async () => {
      pront.rotas['GET /consentimentos'] = { body: [], atrasoMs: 1000 };
      const r = await api().get('/api/consentimentos').set(como('pac-101')).expect(503);
      expect(r.body).toMatchObject({ codigo: 'DEPENDENCIA_INDISPONIVEL', status: 503 });
    });

    it('visão agregada de uma unidade é encaminhada à Function', async () => {
      fn.rotas['GET /api/visao-agregada/upa-02'] = { body: visao('upa-02') };
      await api().get('/api/unidades/upa-02/visao-agregada').set(como('pac-101')).expect(200, visao('upa-02'));
      expect(fn.recebidas[0].headers['x-internal-key']).toBe('chave-e2e');
    });

    it.each([
      ['GET', '/api/unidades', 'usr-gestor-01', 'ms-fila-sql', 'GET /unidades'],
      ['POST', '/api/unidades', 'usr-gestor-01', 'ms-fila-sql', 'POST /unidades'],
      ['GET', '/api/unidades/minhas', 'usr-atendente-07', 'ms-fila-sql', 'GET /unidades/minhas'],
      ['PUT', '/api/unidades/upa-01', 'usr-gestor-01', 'ms-fila-sql', 'PUT /unidades/upa-01'],
      ['DELETE', '/api/unidades/upa-01', 'usr-gestor-01', 'ms-fila-sql', 'DELETE /unidades/upa-01'],
      ['GET', '/api/lotacoes?unidadeId=upa-01', 'usr-gestor-01', 'ms-fila-sql', 'GET /lotacoes?unidadeId=upa-01'],
      ['POST', '/api/lotacoes', 'usr-gestor-01', 'ms-fila-sql', 'POST /lotacoes'],
      ['DELETE', '/api/lotacoes/lot-1', 'usr-gestor-01', 'ms-fila-sql', 'DELETE /lotacoes/lot-1'],
      ['POST', '/api/fila/r1/confirmar-chegada', 'usr-atendente-07', 'ms-fila-sql', 'POST /fila/r1/confirmar-chegada'],
      ['POST', '/api/fila/r1/iniciar-atendimento', 'usr-prof-03', 'ms-fila-sql', 'POST /fila/r1/iniciar-atendimento'],
      ['POST', '/api/prontuarios', 'usr-gestor-01', 'ms-prontuario-mongo', 'POST /prontuarios'],
      ['GET', '/api/prontuarios/me', 'pac-101', 'ms-prontuario-mongo', 'GET /prontuarios/me'],
      ['PUT', '/api/prontuarios/pac-101', 'usr-gestor-01', 'ms-prontuario-mongo', 'PUT /prontuarios/pac-101'],
      ['DELETE', '/api/prontuarios/pac-101', 'usr-gestor-01', 'ms-prontuario-mongo', 'DELETE /prontuarios/pac-101'],
      ['POST', '/api/prontuarios/pac-101/atendimentos', 'usr-prof-03', 'ms-prontuario-mongo', 'POST /prontuarios/pac-101/atendimentos'],
      ['POST', '/api/consentimentos', 'pac-101', 'ms-prontuario-mongo', 'POST /consentimentos'],
      ['PUT', '/api/consentimentos/c1', 'pac-101', 'ms-prontuario-mongo', 'PUT /consentimentos/c1'],
      ['DELETE', '/api/consentimentos/c1', 'pac-101', 'ms-prontuario-mongo', 'DELETE /consentimentos/c1'],
      ['GET', '/api/auditoria/prontuarios/pront-001', 'usr-gestor-01', 'ms-prontuario-mongo', 'GET /auditoria/prontuarios/pront-001'],
    ])('%s %s (%s) → %s', async (metodo, caminho, persona, servico, esperado) => {
      const alvo = servico === 'ms-fila-sql' ? fila : pront;
      alvo.rotas[esperado] = { status: 200, body: { ok: true } };
      const req = api()[metodo.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](caminho).set(como(persona));
      await (metodo === 'POST' || metodo === 'PUT' ? req.send({ a: 1 }) : req).expect(200, { ok: true });
      expect(`${alvo.recebidas[0].method} ${alvo.recebidas[0].url}`).toBe(esperado);
    });

    it('nunca expõe /internal/** nem permite escapar do caminho', async () => {
      await api().get('/api/internal/consentimentos/validos?unidadeId=upa-01').set(como('usr-gestor-01')).expect(404);
      await api().get('/api/unidades/..%2Finternal%2Flotacoes').set(como('usr-gestor-01')).expect(400);
      await api().get('/api/unidades/%2E%2E').set(como('usr-gestor-01')).expect(400);
      expect(fila.recebidas).toHaveLength(0);
    });
  });
});

describe('BFF com AUTH_MODE=entra', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarApp({
      AUTH_MODE: 'entra',
      ENTRA_TENANT_ID: 'tenant-teste',
      ENTRA_AUDIENCE: 'api://open-prontuario-bff',
      MS_FILA_URL: 'http://127.0.0.1:1',
      MS_PRONTUARIO_URL: 'http://127.0.0.1:1',
      FN_VISAO_URL: 'http://127.0.0.1:1',
      INTERNAL_API_KEY: 'k',
    });
  });
  afterAll(() => app.close());

  it('personas e dev-token não existem (404)', async () => {
    await request(app.getHttpServer()).get('/api/auth/personas').expect(404);
    await request(app.getHttpServer()).post('/api/auth/dev-token').send({ usuarioId: 'pac-101' }).expect(404);
  });

  it('rejeita token HS256 do modo dev', async () => {
    const dev = await criarApp({
      JWT_SECRET: JWT_SECRET_TESTE,
      MS_FILA_URL: 'http://127.0.0.1:1',
      MS_PRONTUARIO_URL: 'http://127.0.0.1:1',
      FN_VISAO_URL: 'http://127.0.0.1:1',
      INTERNAL_API_KEY: 'k',
    });
    const { body } = await request(dev.getHttpServer()).post('/api/auth/dev-token').send({ usuarioId: 'usr-gestor-01' });
    await dev.close();
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${body.accessToken}`).expect(401);
  });
});
