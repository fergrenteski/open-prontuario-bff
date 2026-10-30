import { RegistroFila } from '../../src/domain/fila';
import { Unidade, VisaoAgregada } from '../../src/domain/unidade';

export const unidade: Unidade = { id: 'upa-01', nome: 'UPA Boa Vista', tipo: 'UPA', latitude: -25.3866, longitude: -49.2346 };

export const registro = (id: string, pacienteId: string): RegistroFila => ({
  id,
  pacienteId,
  unidadeId: 'upa-01',
  prioridade: 'URGENTE',
  status: 'AGUARDANDO',
  sintomas: ['febre alta'],
  horarioAviso: '2026-10-30T10:00:00-03:00',
});

export const visao = (unidadeId = 'upa-01'): VisaoAgregada => ({
  unidadeId,
  totalPresente: 2,
  totalACaminho: 1,
  tempoMedioEsperaMin: 12,
  nivelCongestionamento: 'BAIXO',
  atualizadoEm: null,
});
