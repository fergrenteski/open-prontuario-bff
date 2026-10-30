import { mesclarVisoes } from '../../src/domain/unidade';
import { unidade, visao } from './fixtures';

describe('mesclarVisoes', () => {
  const unidades = [
    { ...unidade, distanciaKm: 1.2 },
    { ...unidade, id: 'upa-02', distanciaKm: 7.5 },
  ];

  it('associa a visão agregada pela unidade, mantendo a ordem por distância', () => {
    const r = mesclarVisoes(unidades, [visao('upa-02')]);
    expect(r.map((u) => [u.id, u.visaoAgregada?.unidadeId ?? null])).toEqual([
      ['upa-01', null],
      ['upa-02', 'upa-02'],
    ]);
  });

  it('indicadores null quando a Function falhou', () => {
    expect(mesclarVisoes(unidades, null).every((u) => u.visaoAgregada === null)).toBe(true);
  });
});
