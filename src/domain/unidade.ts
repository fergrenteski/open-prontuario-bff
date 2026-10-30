export interface Unidade {
  id: string;
  nome: string;
  tipo: 'UBS' | 'UPA';
  latitude: number;
  longitude: number;
}

export interface VisaoAgregada {
  unidadeId: string;
  totalPresente: number;
  totalACaminho: number;
  tempoMedioEsperaMin: number;
  nivelCongestionamento: 'BAIXO' | 'MEDIO' | 'ALTO';
  atualizadoEm?: string | null;
}

export type UnidadeComDistancia = Unidade & { distanciaKm: number };
export type UnidadeProxima = UnidadeComDistancia & { visaoAgregada: VisaoAgregada | null };

/** Junta as unidades próximas (MS Fila) com os indicadores da Function; sem indicador → `null`. */
export function mesclarVisoes(
  unidades: UnidadeComDistancia[],
  visoes: readonly VisaoAgregada[] | null,
): UnidadeProxima[] {
  const porUnidade = new Map((visoes ?? []).map((v) => [v.unidadeId, v]));
  return unidades.map((u) => ({ ...u, visaoAgregada: porUnidade.get(u.id) ?? null }));
}
