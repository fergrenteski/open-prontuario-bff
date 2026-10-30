import { Contexto } from '../../src/application/ports/contexto';
import { DependenciaIndisponivelError, ErroUpstream } from '../../src/application/ports/erros';
import { MsFilaPort, MsProntuarioPort, VisaoAgregadaPort } from '../../src/application/ports/servicos.port';
import { registro, unidade, visao } from '../domain/fixtures';

export const ctx: Contexto = {
  usuario: { id: 'usr-atendente-07', nome: 'Carla Mendes', roles: ['ATENDENTE'] },
  correlationId: 'corr-teste',
};

export const problema = (status: number, codigo: string, detail = 'detalhe') =>
  new ErroUpstream(status, JSON.stringify({ title: 'Erro', status, detail, codigo }), 'application/problem+json');

export const timeout = (servico = 'x') => new DependenciaIndisponivelError(servico, 'timeout');

/** Fakes das portas: cada método pode ser sobrescrito por teste. */
export function fakeMsFila(over: Partial<MsFilaPort> = {}): jest.Mocked<MsFilaPort> {
  return {
    buscarUnidade: jest.fn(async () => unidade),
    listarFila: jest.fn(async () => [registro('r1', 'pac-101'), registro('r2', 'pac-102')]),
    listarUnidadesProximas: jest.fn(async () => [
      { ...unidade, distanciaKm: 1 },
      { ...unidade, id: 'upa-02', distanciaKm: 5 },
    ]),
    avisarChegada: jest.fn(async (unidadeId) => ({ ...registro('r9', 'pac-101'), unidadeId, status: 'A_CAMINHO' })),
    ...over,
  } as jest.Mocked<MsFilaPort>;
}

export function fakeMsProntuario(over: Partial<MsProntuarioPort> = {}): jest.Mocked<MsProntuarioPort> {
  return {
    listarPacientesComConsentimentoValido: jest.fn(async () => ['pac-101']),
    consultarProntuario: jest.fn(async (pacienteId) => ({ id: 'pront-001', pacienteId })),
    concederConsentimento: jest.fn(async () => undefined),
    ...over,
  } as jest.Mocked<MsProntuarioPort>;
}

export function fakeVisao(over: Partial<VisaoAgregadaPort> = {}): jest.Mocked<VisaoAgregadaPort> {
  return {
    consultar: jest.fn(async (id) => visao(id)),
    consultarVarias: jest.fn(async (ids) => ids.map((id) => visao(id))),
    ...over,
  } as jest.Mocked<VisaoAgregadaPort>;
}
