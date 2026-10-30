import { EntradaAgregacao, montarDadosAgregados } from '../../src/domain/agregacao';
import { ErroNegocio } from '../../src/domain/erros';
import { registro, unidade, visao } from './fixtures';

const ok = <T>(valor: T) => ({ tipo: 'ok' as const, valor });
const falha = (motivo: string) => ({ tipo: 'falha' as const, motivo });
const aviso = (mensagem: string) => ({ tipo: 'aviso' as const, mensagem });

const entrada = (parcial: Partial<EntradaAgregacao> = {}): EntradaAgregacao => ({
  correlationId: 'corr-1',
  geradoEm: new Date('2026-10-30T13:00:00Z'),
  duracoesMs: { 'ms-fila-sql': 10.4, 'ms-prontuario-mongo': 20, 'fn-visao-agregada': 5 },
  unidade: ok(unidade),
  fila: ok([registro('r1', 'pac-101'), registro('r2', 'pac-102')]),
  pacientesAutorizados: ok(['pac-101']),
  visaoAgregada: ok(visao()),
  ...parcial,
});

describe('montarDadosAgregados', () => {
  it('todas as fontes ok → não degradado, fila marcada', () => {
    const r = montarDadosAgregados(entrada({ prontuario: ok({ id: 'pront-001', pacienteId: 'pac-101' }) }));
    expect(r.meta).toEqual({
      correlationId: 'corr-1',
      geradoEm: '2026-10-30T13:00:00.000Z',
      degraded: false,
      fontes: [
        { nome: 'ms-fila-sql', status: 'ok', duracaoMs: 10 },
        { nome: 'ms-prontuario-mongo', status: 'ok', duracaoMs: 20 },
        { nome: 'fn-visao-agregada', status: 'ok', duracaoMs: 5 },
      ],
      falhas: [],
      avisos: [],
    });
    expect(r.unidade?.id).toBe('upa-01');
    expect(r.visaoAgregada?.unidadeId).toBe('upa-01');
    expect(r.prontuario?.id).toBe('pront-001');
    expect(r.fila?.map((f) => f.prontuarioAutorizado)).toEqual([true, false]);
  });

  it('sem pacienteId o prontuário vem null e não gera aviso', () => {
    const r = montarDadosAgregados(entrada());
    expect(r.prontuario).toBeNull();
    expect(r.meta.avisos).toEqual([]);
  });

  it('Function fora → degraded, visaoAgregada null e fonte em falhas', () => {
    const r = montarDadosAgregados(entrada({ visaoAgregada: falha('timeout') }));
    expect(r.meta.degraded).toBe(true);
    expect(r.visaoAgregada).toBeNull();
    expect(r.meta.falhas).toEqual([{ fonte: 'fn-visao-agregada', motivo: 'timeout' }]);
    expect(r.meta.fontes.find((f) => f.nome === 'fn-visao-agregada')?.status).toBe('falha');
  });

  it('MS Prontuário fora → prontuarioAutorizado null em toda a fila', () => {
    const r = montarDadosAgregados(entrada({ pacientesAutorizados: falha('indisponivel') }));
    expect(r.meta.degraded).toBe(true);
    expect(r.fila?.map((f) => f.prontuarioAutorizado)).toEqual([null, null]);
  });

  it('4xx de regra de negócio vira aviso, não falha', () => {
    const r = montarDadosAgregados(entrada({ prontuario: aviso('Consentimento inválido (CONSENTIMENTO_AUSENTE)') }));
    expect(r.meta.degraded).toBe(false);
    expect(r.prontuario).toBeNull();
    expect(r.meta.avisos).toEqual(['ms-prontuario-mongo: Consentimento inválido (CONSENTIMENTO_AUSENTE)']);
    expect(r.meta.fontes.every((f) => f.status === 'ok')).toBe(true);
  });

  it('falha parcial de uma fonte preserva o que respondeu', () => {
    const r = montarDadosAgregados(entrada({ fila: falha('HTTP 500') }));
    expect(r.unidade?.id).toBe('upa-01');
    expect(r.fila).toBeNull();
    expect(r.meta.falhas).toEqual([{ fonte: 'ms-fila-sql', motivo: 'HTTP 500' }]);
  });

  it('todas as fontes falham → AGREGACAO_FALHOU', () => {
    const tudoFalha = entrada({
      unidade: falha('timeout'),
      fila: falha('timeout'),
      pacientesAutorizados: falha('indisponivel'),
      visaoAgregada: falha('HTTP 503'),
    });
    expect(() => montarDadosAgregados(tudoFalha)).toThrow(ErroNegocio);
    expect(() => montarDadosAgregados(tudoFalha)).toThrow(/Todas as fontes falharam/);
  });
});
