import { AggregatedData, montarDadosAgregados, NomeFonte, Resultado } from '../../../domain/agregacao';
import { Contexto } from '../../ports/contexto';
import { DependenciaIndisponivelError, ErroUpstream } from '../../ports/erros';
import { MsFilaPort, MsProntuarioPort, VisaoAgregadaPort } from '../../ports/servicos.port';

export interface ObterDadosAgregadosQuery {
  unidadeId: string;
  pacienteId?: string;
}

/** Status que indicam problema de infraestrutura mesmo sendo 4xx (chave interna errada, timeout, rate-limit). */
const STATUS_FALHA_4XX = new Set([401, 408, 429]);

/** Converte o desfecho de uma chamada em ok / aviso (regra de negócio) / falha (infra). */
export function classificar<T>(r: PromiseSettledResult<T>): Resultado<T> {
  if (r.status === 'fulfilled') return { tipo: 'ok', valor: r.value };
  const erro: unknown = r.reason;
  if (erro instanceof ErroUpstream) {
    if (erro.status >= 400 && erro.status < 500 && !STATUS_FALHA_4XX.has(erro.status)) {
      const p = erro.problema;
      const texto = p.detail ?? p.title ?? `HTTP ${erro.status}`;
      return { tipo: 'aviso', mensagem: p.codigo ? `${texto} (${p.codigo})` : texto };
    }
    return { tipo: 'falha', motivo: `HTTP ${erro.status}` };
  }
  if (erro instanceof DependenciaIndisponivelError) return { tipo: 'falha', motivo: erro.motivo };
  return { tipo: 'falha', motivo: 'erro inesperado' };
}

async function cronometrar(chamadas: (() => Promise<unknown>)[]) {
  const inicio = performance.now();
  const resultados = (await Promise.allSettled(chamadas.map((c) => c()))).map(classificar);
  return { resultados, duracaoMs: performance.now() - inicio };
}

/** `GET /aggregated-data`: MS Fila + MS Prontuário + Function em paralelo, com degradação graciosa. */
export class ObterDadosAgregadosUseCase {
  constructor(
    private readonly msFila: MsFilaPort,
    private readonly msProntuario: MsProntuarioPort,
    private readonly visao: VisaoAgregadaPort,
  ) {}

  async executar(q: ObterDadosAgregadosQuery, ctx: Contexto): Promise<AggregatedData> {
    const { unidadeId, pacienteId } = q;
    const [fila, prontuario, fn] = await Promise.all([
      cronometrar([
        () => this.msFila.buscarUnidade(unidadeId, ctx),
        () => this.msFila.listarFila(unidadeId, undefined, ctx),
      ]),
      cronometrar([
        () => this.msProntuario.listarPacientesComConsentimentoValido(unidadeId, ctx),
        ...(pacienteId ? [() => this.msProntuario.consultarProntuario(pacienteId, unidadeId, ctx)] : []),
      ]),
      cronometrar([() => this.visao.consultar(unidadeId, ctx)]),
    ]);

    const duracoesMs: Record<NomeFonte, number> = {
      'ms-fila-sql': fila.duracaoMs,
      'ms-prontuario-mongo': prontuario.duracaoMs,
      'fn-visao-agregada': fn.duracaoMs,
    };
    /* eslint-disable @typescript-eslint/no-explicit-any -- resultados heterogêneos, tipados na entrada do domínio */
    return montarDadosAgregados({
      correlationId: ctx.correlationId,
      geradoEm: new Date(),
      duracoesMs,
      unidade: fila.resultados[0] as Resultado<any>,
      fila: fila.resultados[1] as Resultado<any>,
      pacientesAutorizados: prontuario.resultados[0] as Resultado<any>,
      prontuario: prontuario.resultados[1] as Resultado<any> | undefined,
      visaoAgregada: fn.resultados[0] as Resultado<any>,
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
}
