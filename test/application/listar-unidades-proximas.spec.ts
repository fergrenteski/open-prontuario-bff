import { ListarUnidadesProximasUseCase } from '../../src/application/unidades/listar-proximas/listar-unidades-proximas.use-case';
import { ctx, fakeMsFila, fakeVisao, timeout } from './fakes';

describe('ListarUnidadesProximasUseCase', () => {
  const q = { latitude: -25.43, longitude: -49.27, raioKm: 20 };

  it('agrega distância (MS Fila) com indicadores em lote (Function)', async () => {
    const fila = fakeMsFila();
    const fn = fakeVisao();
    const r = await new ListarUnidadesProximasUseCase(fila, fn).executar(q, ctx);
    expect(fila.listarUnidadesProximas).toHaveBeenCalledWith(q, ctx);
    expect(fn.consultarVarias).toHaveBeenCalledWith(['upa-01', 'upa-02'], ctx);
    expect(r.map((u) => [u.id, u.distanciaKm, u.visaoAgregada?.unidadeId])).toEqual([
      ['upa-01', 1, 'upa-01'],
      ['upa-02', 5, 'upa-02'],
    ]);
  });

  it('Function fora → indicadores null, lista mantida', async () => {
    const r = await new ListarUnidadesProximasUseCase(
      fakeMsFila(),
      fakeVisao({ consultarVarias: jest.fn(async () => Promise.reject(timeout())) }),
    ).executar(q, ctx);
    expect(r).toHaveLength(2);
    expect(r.every((u) => u.visaoAgregada === null)).toBe(true);
  });

  it('nenhuma unidade no raio → não chama a Function', async () => {
    const fn = fakeVisao();
    const r = await new ListarUnidadesProximasUseCase(
      fakeMsFila({ listarUnidadesProximas: jest.fn(async () => []) }),
      fn,
    ).executar(q, ctx);
    expect(r).toEqual([]);
    expect(fn.consultarVarias).not.toHaveBeenCalled();
  });
});
