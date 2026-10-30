import { ErroNegocio } from './erros';
import { marcarProntuarioAutorizado, RegistroFila } from './fila';
import { Unidade, VisaoAgregada } from './unidade';

export type NomeFonte = 'ms-fila-sql' | 'ms-prontuario-mongo' | 'fn-visao-agregada';

/**
 * Resultado de uma chamada a uma fonte:
 * - `ok`: dado disponível;
 * - `aviso`: a fonte respondeu com erro de regra de negócio (4xx) — não é falha;
 * - `falha`: timeout, conexão recusada, 5xx… — degrada a resposta.
 */
export type Resultado<T> =
  | { tipo: 'ok'; valor: T }
  | { tipo: 'aviso'; mensagem: string }
  | { tipo: 'falha'; motivo: string };

export interface Prontuario {
  id: string;
  pacienteId: string;
  [campo: string]: unknown;
}

export interface EntradaAgregacao {
  correlationId: string;
  geradoEm: Date;
  duracoesMs: Record<NomeFonte, number>;
  unidade: Resultado<Unidade>;
  fila: Resultado<RegistroFila[]>;
  pacientesAutorizados: Resultado<string[]>;
  /** Ausente quando `pacienteId` não foi informado. */
  prontuario?: Resultado<Prontuario>;
  visaoAgregada: Resultado<VisaoAgregada>;
}

export interface AggregatedData {
  unidade: Unidade | null;
  fila: RegistroFila[] | null;
  visaoAgregada: VisaoAgregada | null;
  prontuario: Prontuario | null;
  meta: {
    correlationId: string;
    geradoEm: string;
    degraded: boolean;
    fontes: { nome: NomeFonte; status: 'ok' | 'falha'; duracaoMs: number }[];
    falhas: { fonte: NomeFonte; motivo: string }[];
    avisos: string[];
  };
}

function valor<T>(r: Resultado<T> | undefined): T | null {
  return r?.tipo === 'ok' ? r.valor : null;
}

/**
 * Monta o JSON único do `GET /aggregated-data`. Uma fonte é "falha" se qualquer
 * chamada dela falhou; se as três falharem → `AGREGACAO_FALHOU` (502).
 */
export function montarDadosAgregados(e: EntradaAgregacao): AggregatedData {
  const chamadasPorFonte: Record<NomeFonte, (Resultado<unknown> | undefined)[]> = {
    'ms-fila-sql': [e.unidade, e.fila],
    'ms-prontuario-mongo': [e.pacientesAutorizados, e.prontuario],
    'fn-visao-agregada': [e.visaoAgregada],
  };

  const fontes: AggregatedData['meta']['fontes'] = [];
  const falhas: AggregatedData['meta']['falhas'] = [];
  const avisos: string[] = [];

  for (const nome of Object.keys(chamadasPorFonte) as NomeFonte[]) {
    const chamadas = chamadasPorFonte[nome].filter((c): c is Resultado<unknown> => c !== undefined);
    const falha = chamadas.find((c) => c.tipo === 'falha');
    for (const c of chamadas) if (c.tipo === 'aviso') avisos.push(`${nome}: ${c.mensagem}`);
    if (falha) falhas.push({ fonte: nome, motivo: falha.motivo });
    fontes.push({ nome, status: falha ? 'falha' : 'ok', duracaoMs: Math.round(e.duracoesMs[nome]) });
  }

  if (falhas.length === fontes.length) {
    throw new ErroNegocio(
      'AGREGACAO_FALHOU',
      `Todas as fontes falharam: ${falhas.map((f) => `${f.fonte} (${f.motivo})`).join(', ')}`,
    );
  }

  const fila = valor(e.fila);
  return {
    unidade: valor(e.unidade),
    fila: fila && marcarProntuarioAutorizado(fila, valor(e.pacientesAutorizados)),
    visaoAgregada: valor(e.visaoAgregada),
    prontuario: valor(e.prontuario),
    meta: {
      correlationId: e.correlationId,
      geradoEm: e.geradoEm.toISOString(),
      degraded: falhas.length > 0,
      fontes,
      falhas,
      avisos,
    },
  };
}
