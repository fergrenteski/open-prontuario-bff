import { AvisarChegadaUseCase } from '../../src/application/fila/avisar-chegada/avisar-chegada.use-case';
import { ctx, fakeMsFila, fakeMsProntuario, problema, timeout } from './fakes';

const reject = (e: unknown) => jest.fn(async () => Promise.reject(e));

describe('AvisarChegadaUseCase', () => {
  const cmd = { unidadeId: 'upa-01', sintomas: ['febre alta'], tempoEstimadoChegadaMin: 15 };

  it('sem autorização: cria o registro e não chama o MS Prontuário', async () => {
    const fila = fakeMsFila();
    const pront = fakeMsProntuario();
    const r = await new AvisarChegadaUseCase(fila, pront).executar(cmd, ctx);
    expect(fila.avisarChegada).toHaveBeenCalledWith('upa-01', { sintomas: ['febre alta'], tempoEstimadoChegadaMin: 15 }, ctx);
    expect(pront.concederConsentimento).not.toHaveBeenCalled();
    expect(r).toMatchObject({ id: 'r9', status: 'A_CAMINHO', prontuarioAutorizado: false, avisos: [] });
  });

  it('com autorização: concede o consentimento (validade padrão 3 dias)', async () => {
    const pront = fakeMsProntuario();
    const r = await new AvisarChegadaUseCase(fakeMsFila(), pront).executar({ ...cmd, autorizarProntuario: true }, ctx);
    expect(pront.concederConsentimento).toHaveBeenCalledWith('upa-01', 3, ctx);
    expect(r).toMatchObject({ prontuarioAutorizado: true, avisos: [] });
  });

  it('usa a validade informada', async () => {
    const pront = fakeMsProntuario();
    await new AvisarChegadaUseCase(fakeMsFila(), pront).executar(
      { ...cmd, autorizarProntuario: true, validadeConsentimentoDias: 30 },
      ctx,
    );
    expect(pront.concederConsentimento).toHaveBeenCalledWith('upa-01', 30, ctx);
  });

  it('consentimento falha → registro criado com prontuarioAutorizado=false e aviso', async () => {
    const r = await new AvisarChegadaUseCase(
      fakeMsFila(),
      fakeMsProntuario({ concederConsentimento: reject(timeout('ms-prontuario-mongo')) }),
    ).executar({ ...cmd, autorizarProntuario: true }, ctx);
    expect(r.id).toBe('r9');
    expect(r.prontuarioAutorizado).toBe(false);
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0]).toMatch(/autorizar depois/);
  });

  it('409 CONSENTIMENTO_DUPLICADO → tratado como autorizado', async () => {
    const r = await new AvisarChegadaUseCase(
      fakeMsFila(),
      fakeMsProntuario({ concederConsentimento: reject(problema(409, 'CONSENTIMENTO_DUPLICADO')) }),
    ).executar({ ...cmd, autorizarProntuario: true }, ctx);
    expect(r).toMatchObject({ prontuarioAutorizado: true, avisos: [] });
  });

  it('outro 409 no consentimento não é sucesso', async () => {
    const r = await new AvisarChegadaUseCase(
      fakeMsFila(),
      fakeMsProntuario({ concederConsentimento: reject(problema(409, 'OUTRO')) }),
    ).executar({ ...cmd, autorizarProntuario: true }, ctx);
    expect(r.prontuarioAutorizado).toBe(false);
  });

  it('erro do MS Fila (ex.: 409 duplicado) é propagado e não tenta consentimento', async () => {
    const pront = fakeMsProntuario();
    const erro = problema(409, 'REGISTRO_ATIVO_DUPLICADO');
    await expect(
      new AvisarChegadaUseCase(fakeMsFila({ avisarChegada: reject(erro) }), pront).executar(
        { ...cmd, autorizarProntuario: true },
        ctx,
      ),
    ).rejects.toBe(erro);
    expect(pront.concederConsentimento).not.toHaveBeenCalled();
  });
});
