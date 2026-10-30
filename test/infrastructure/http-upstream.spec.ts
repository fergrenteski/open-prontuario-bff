import { DependenciaIndisponivelError, ErroUpstream } from '../../src/application/ports/erros';
import { HttpUpstreamClient } from '../../src/infrastructure/http/http-upstream.client';
import {
  MsFilaHttpAdapter,
  MsProntuarioHttpAdapter,
  VisaoAgregadaHttpAdapter,
} from '../../src/infrastructure/http/servicos.adapter';
import { ServidorFalso } from '../support/servidor-falso';

const ctx = {
  usuario: { id: 'pac-101', nome: 'João Pereira', roles: ['PACIENTE' as const] },
  correlationId: 'corr-123',
};

describe('HttpUpstreamClient e adapters', () => {
  let srv: ServidorFalso;
  let http: HttpUpstreamClient;

  beforeAll(async () => {
    srv = await new ServidorFalso().iniciar();
    http = new HttpUpstreamClient({
      urls: { 'ms-fila-sql': srv.url, 'ms-prontuario-mongo': srv.url, 'fn-visao-agregada': srv.url },
      internalApiKey: 'chave-interna',
      timeoutMs: 200,
    });
  });
  afterEach(() => srv.limpar());
  afterAll(() => srv.parar());

  it('propaga X-Internal-Key, X-User-*, X-Correlation-Id e o corpo JSON', async () => {
    srv.rotas['POST /fila/upa-01/aviso-chegada'] = { status: 201, body: { id: 'r1' } };
    const r = await new MsFilaHttpAdapter(http).avisarChegada('upa-01', { sintomas: ['febre'] }, ctx);
    expect(r).toEqual({ id: 'r1' });
    const req = srv.recebidas[0];
    expect(req.headers).toMatchObject({
      'x-internal-key': 'chave-interna',
      'x-user-id': 'pac-101',
      'x-user-roles': 'PACIENTE',
      'x-correlation-id': 'corr-123',
      'content-type': 'application/json',
    });
    expect(Buffer.from(req.headers['x-user-name'] as string, 'latin1').toString('latin1')).toBe('João Pereira');
    expect(JSON.parse(req.body)).toEqual({ sintomas: ['febre'] });
  });

  it('substitui caracteres fora do Latin-1 no X-User-Name', async () => {
    srv.rotas['GET /unidades/upa-01'] = { body: { id: 'upa-01' } };
    await new MsFilaHttpAdapter(http).buscarUnidade('upa-01', { ...ctx, usuario: { ...ctx.usuario, nome: 'Ana 😀\n' } });
    expect(srv.recebidas[0].headers['x-user-name']).toBe('Ana ??');
  });

  it('erro HTTP vira ErroUpstream com status e corpo originais', async () => {
    const problema = { title: 'Conflito', status: 409, codigo: 'REGISTRO_ATIVO_DUPLICADO' };
    srv.rotas['POST /fila/upa-01/aviso-chegada'] = { status: 409, body: problema, contentType: 'application/problem+json' };
    const erro = await new MsFilaHttpAdapter(http).avisarChegada('upa-01', { sintomas: ['x'] }, ctx).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroUpstream);
    expect(erro.status).toBe(409);
    expect(JSON.parse(erro.corpo)).toEqual(problema);
    expect(erro.contentType).toBe('application/problem+json');
  });

  it('timeout → DependenciaIndisponivelError(timeout)', async () => {
    srv.rotas['GET /api/visao-agregada/upa-01'] = { body: {}, atrasoMs: 1000 };
    const erro = await new VisaoAgregadaHttpAdapter(http).consultar('upa-01', ctx).catch((e) => e);
    expect(erro).toBeInstanceOf(DependenciaIndisponivelError);
    expect(erro).toMatchObject({ motivo: 'timeout', codigo: 'DEPENDENCIA_INDISPONIVEL' });
  });

  it('conexão recusada → DependenciaIndisponivelError(indisponivel)', async () => {
    const fora = new HttpUpstreamClient({
      urls: { 'ms-fila-sql': 'http://127.0.0.1:1', 'ms-prontuario-mongo': '', 'fn-visao-agregada': '' },
      internalApiKey: 'k',
      timeoutMs: 500,
    });
    await expect(fora.enviar('ms-fila-sql', { metodo: 'GET', caminho: '/unidades' }, ctx)).rejects.toMatchObject({
      motivo: 'indisponivel',
    });
  });

  it('resposta 2xx com JSON inválido → ErroUpstream 502', async () => {
    srv.rotas['GET /unidades/upa-01'] = { body: 'não é json', contentType: 'text/plain' };
    await expect(new MsFilaHttpAdapter(http).buscarUnidade('upa-01', ctx)).rejects.toMatchObject({ status: 502 });
  });

  it('adapters montam caminhos e queries dos contratos', async () => {
    srv.rotas['GET /fila/upa%2001'] = { body: [] };
    srv.rotas['GET /unidades/proximas'] = { body: [] };
    srv.rotas['GET /internal/consentimentos/validos'] = { body: { unidadeId: 'upa-01', pacienteIds: ['pac-101'] } };
    srv.rotas['GET /prontuarios/pac-101'] = { body: { id: 'pront-001' } };
    srv.rotas['POST /consentimentos'] = { status: 201, body: { id: 'c1' } };
    srv.rotas['GET /api/visao-agregada'] = { body: [] };

    const fila = new MsFilaHttpAdapter(http);
    const pront = new MsProntuarioHttpAdapter(http);
    await fila.listarFila('upa 01', 'AGUARDANDO', ctx);
    await fila.listarFila('upa 01', undefined, ctx);
    await fila.listarUnidadesProximas({ latitude: -25.4, longitude: -49.2, raioKm: 10 }, ctx);
    await fila.listarUnidadesProximas({ latitude: -25.4, longitude: -49.2 }, ctx);
    expect(await pront.listarPacientesComConsentimentoValido('upa-01', ctx)).toEqual(['pac-101']);
    await pront.consultarProntuario('pac-101', 'upa-01', ctx);
    await pront.concederConsentimento('upa-01', 3, ctx);
    await new VisaoAgregadaHttpAdapter(http).consultarVarias(['upa-01', 'upa-02'], ctx);

    expect(srv.recebidas.map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET /fila/upa%2001?status=AGUARDANDO',
      'GET /fila/upa%2001',
      'GET /unidades/proximas?latitude=-25.4&longitude=-49.2&raioKm=10',
      'GET /unidades/proximas?latitude=-25.4&longitude=-49.2',
      'GET /internal/consentimentos/validos?unidadeId=upa-01',
      'GET /prontuarios/pac-101?unidadeId=upa-01',
      'POST /consentimentos',
      'GET /api/visao-agregada?unidadeIds=upa-01%2Cupa-02',
    ]);
    expect(JSON.parse(srv.recebidas[6].body)).toEqual({ unidadeId: 'upa-01', validadeDias: 3 });
  });

  it('2xx sem corpo (204) devolve undefined', async () => {
    srv.rotas['POST /consentimentos'] = { status: 204 };
    await expect(new MsProntuarioHttpAdapter(http).concederConsentimento('upa-01', 3, ctx)).resolves.toBeUndefined();
  });
});
