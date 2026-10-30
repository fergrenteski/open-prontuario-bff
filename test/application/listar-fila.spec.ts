import { ListarFilaUseCase } from '../../src/application/fila/listar-fila/listar-fila.use-case';
import { ctx, fakeMsFila, fakeMsProntuario, problema, timeout } from './fakes';

const reject = (e: unknown) => jest.fn(async () => Promise.reject(e));

describe('ListarFilaUseCase', () => {
  it('com MS Prontuário: marca prontuarioAutorizado e repassa o filtro de status', async () => {
    const fila = fakeMsFila();
    const r = await new ListarFilaUseCase(fila, fakeMsProntuario()).executar({ unidadeId: 'upa-01', status: 'AGUARDANDO' }, ctx);
    expect(fila.listarFila).toHaveBeenCalledWith('upa-01', 'AGUARDANDO', ctx);
    expect(r.map((x) => x.prontuarioAutorizado)).toEqual([true, false]);
  });

  it('sem MS Prontuário: prontuarioAutorizado null', async () => {
    const r = await new ListarFilaUseCase(
      fakeMsFila(),
      fakeMsProntuario({ listarPacientesComConsentimentoValido: reject(timeout()) }),
    ).executar({ unidadeId: 'upa-01' }, ctx);
    expect(r.map((x) => x.prontuarioAutorizado)).toEqual([null, null]);
  });

  it('erro do MS Fila (ex.: 403 não lotado) é propagado', async () => {
    const erro = problema(403, 'SEM_PERMISSAO');
    await expect(
      new ListarFilaUseCase(fakeMsFila({ listarFila: reject(erro) }), fakeMsProntuario()).executar({ unidadeId: 'upa-01' }, ctx),
    ).rejects.toBe(erro);
  });
});
