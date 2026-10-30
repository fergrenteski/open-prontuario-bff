import {
  classificar,
  ObterDadosAgregadosUseCase,
} from '../../src/application/aggregated-data/obter-dados-agregados/obter-dados-agregados.use-case';
import { ErroUpstream } from '../../src/application/ports/erros';
import { ErroNegocio } from '../../src/domain/erros';
import { ctx, fakeMsFila, fakeMsProntuario, fakeVisao, problema, timeout } from './fakes';

const falhaCom = (erro: unknown) => jest.fn(async () => Promise.reject(erro));

describe('ObterDadosAgregadosUseCase', () => {
  it('todas as fontes ok → JSON único, sem degradação', async () => {
    const fila = fakeMsFila();
    const pront = fakeMsProntuario();
    const fn = fakeVisao();
    const r = await new ObterDadosAgregadosUseCase(fila, pront, fn).executar(
      { unidadeId: 'upa-01', pacienteId: 'pac-101' },
      ctx,
    );

    expect(r.meta.degraded).toBe(false);
    expect(r.meta.correlationId).toBe('corr-teste');
    expect(r.meta.fontes.map((f) => f.nome)).toEqual(['ms-fila-sql', 'ms-prontuario-mongo', 'fn-visao-agregada']);
    expect(r.unidade?.id).toBe('upa-01');
    expect(r.prontuario?.id).toBe('pront-001');
    expect(r.visaoAgregada?.unidadeId).toBe('upa-01');
    expect(r.fila?.map((x) => x.prontuarioAutorizado)).toEqual([true, false]);
    expect(pront.consultarProntuario).toHaveBeenCalledWith('pac-101', 'upa-01', ctx);
    expect(fila.listarFila).toHaveBeenCalledWith('upa-01', undefined, ctx);
  });

  it('não consulta prontuário sem pacienteId', async () => {
    const pront = fakeMsProntuario();
    const r = await new ObterDadosAgregadosUseCase(fakeMsFila(), pront, fakeVisao()).executar({ unidadeId: 'upa-01' }, ctx);
    expect(pront.consultarProntuario).not.toHaveBeenCalled();
    expect(r.prontuario).toBeNull();
  });

  it('uma fonte falha (timeout) → 200 degradado com a fonte em falhas', async () => {
    const r = await new ObterDadosAgregadosUseCase(
      fakeMsFila(),
      fakeMsProntuario(),
      fakeVisao({ consultar: falhaCom(timeout('fn-visao-agregada')) }),
    ).executar({ unidadeId: 'upa-01' }, ctx);
    expect(r.meta.degraded).toBe(true);
    expect(r.meta.falhas).toEqual([{ fonte: 'fn-visao-agregada', motivo: 'timeout' }]);
    expect(r.visaoAgregada).toBeNull();
    expect(r.fila).toHaveLength(2);
  });

  it('403 do prontuário (sem consentimento) → aviso, não falha', async () => {
    const r = await new ObterDadosAgregadosUseCase(
      fakeMsFila(),
      fakeMsProntuario({ consultarProntuario: falhaCom(problema(403, 'CONSENTIMENTO_AUSENTE', 'Sem consentimento')) }),
      fakeVisao(),
    ).executar({ unidadeId: 'upa-01', pacienteId: 'pac-102' }, ctx);
    expect(r.meta.degraded).toBe(false);
    expect(r.meta.falhas).toEqual([]);
    expect(r.meta.avisos).toEqual(['ms-prontuario-mongo: Sem consentimento (CONSENTIMENTO_AUSENTE)']);
    expect(r.prontuario).toBeNull();
  });

  it('5xx de uma fonte → falha com motivo HTTP', async () => {
    const r = await new ObterDadosAgregadosUseCase(
      fakeMsFila({ listarFila: falhaCom(problema(500, 'ERRO')) }),
      fakeMsProntuario(),
      fakeVisao(),
    ).executar({ unidadeId: 'upa-01' }, ctx);
    expect(r.meta.falhas).toEqual([{ fonte: 'ms-fila-sql', motivo: 'HTTP 500' }]);
    expect(r.unidade?.id).toBe('upa-01');
  });

  it('todas as fontes falham → AGREGACAO_FALHOU', async () => {
    const uc = new ObterDadosAgregadosUseCase(
      fakeMsFila({ buscarUnidade: falhaCom(timeout()), listarFila: falhaCom(timeout()) }),
      fakeMsProntuario({ listarPacientesComConsentimentoValido: falhaCom(problema(503, 'DEPENDENCIA_INDISPONIVEL')) }),
      fakeVisao({ consultar: falhaCom(new Error('boom')) }),
    );
    const erro = await uc.executar({ unidadeId: 'upa-01' }, ctx).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroNegocio);
    expect((erro as ErroNegocio).codigo).toBe('AGREGACAO_FALHOU');
  });
});

describe('classificar', () => {
  const rejeitado = (reason: unknown): PromiseSettledResult<unknown> => ({ status: 'rejected', reason });

  it.each([401, 408, 429])('HTTP %i é falha de infraestrutura', (status) => {
    expect(classificar(rejeitado(problema(status, 'X')))).toEqual({ tipo: 'falha', motivo: `HTTP ${status}` });
  });

  it('4xx sem problem+json usa o status como texto do aviso', () => {
    expect(classificar(rejeitado(new ErroUpstream(404, 'not found')))).toEqual({ tipo: 'aviso', mensagem: 'HTTP 404' });
  });

  it('4xx com title e sem codigo', () => {
    const e = new ErroUpstream(404, JSON.stringify({ title: 'Não encontrado' }));
    expect(classificar(rejeitado(e))).toEqual({ tipo: 'aviso', mensagem: 'Não encontrado' });
  });

  it('erro desconhecido é falha inesperada', () => {
    expect(classificar(rejeitado(new Error('x')))).toEqual({ tipo: 'falha', motivo: 'erro inesperado' });
  });
});
