import { marcarProntuarioAutorizado } from '../../src/domain/fila';
import { registro } from './fixtures';

describe('marcarProntuarioAutorizado', () => {
  const fila = [registro('r1', 'pac-101'), registro('r2', 'pac-102')];

  it('marca true apenas para pacientes com consentimento válido', () => {
    expect(marcarProntuarioAutorizado(fila, ['pac-102']).map((r) => r.prontuarioAutorizado)).toEqual([false, true]);
  });

  it('marca null quando a lista de consentimentos é desconhecida', () => {
    expect(marcarProntuarioAutorizado(fila, null).map((r) => r.prontuarioAutorizado)).toEqual([null, null]);
  });

  it('não altera os registros originais', () => {
    marcarProntuarioAutorizado(fila, ['pac-101']);
    expect(fila[0]).not.toHaveProperty('prontuarioAutorizado');
  });
});
