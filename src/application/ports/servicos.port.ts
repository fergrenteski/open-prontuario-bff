import { Prontuario, NomeFonte } from '../../domain/agregacao';
import { RegistroFila } from '../../domain/fila';
import { Unidade, UnidadeComDistancia, VisaoAgregada } from '../../domain/unidade';
import { Contexto } from './contexto';

/*
 * Portas de saída para os serviços a jusante. Os adapters lançam `ErroUpstream`
 * para respostas de erro e `DependenciaIndisponivelError` para timeout/conexão.
 */

export interface MsFilaPort {
  buscarUnidade(unidadeId: string, ctx: Contexto): Promise<Unidade>;
  listarFila(unidadeId: string, status: string | undefined, ctx: Contexto): Promise<RegistroFila[]>;
  listarUnidadesProximas(
    consulta: { latitude: number; longitude: number; raioKm?: number },
    ctx: Contexto,
  ): Promise<UnidadeComDistancia[]>;
  avisarChegada(
    unidadeId: string,
    aviso: { sintomas: string[]; tempoEstimadoChegadaMin?: number },
    ctx: Contexto,
  ): Promise<RegistroFila>;
}

export interface MsProntuarioPort {
  /** `GET /internal/consentimentos/validos` — ids dos pacientes com consentimento válido na unidade. */
  listarPacientesComConsentimentoValido(unidadeId: string, ctx: Contexto): Promise<string[]>;
  consultarProntuario(pacienteId: string, unidadeId: string, ctx: Contexto): Promise<Prontuario>;
  concederConsentimento(unidadeId: string, validadeDias: number, ctx: Contexto): Promise<void>;
}

export interface VisaoAgregadaPort {
  consultar(unidadeId: string, ctx: Contexto): Promise<VisaoAgregada>;
  consultarVarias(unidadeIds: string[], ctx: Contexto): Promise<VisaoAgregada[]>;
}

export type Servico = NomeFonte;

export interface RequisicaoUpstream {
  metodo: string;
  /** Caminho no serviço de destino, já com segmentos codificados (ex.: `/unidades/upa-01`). */
  caminho: string;
  /** Query string bruta, sem `?`. */
  query?: string;
  corpo?: unknown;
}

export interface RespostaUpstream {
  status: number;
  corpo: string;
  contentType?: string;
}

/** Pass-through genérico: devolve qualquer status (inclusive erro) sem interpretar. */
export interface UpstreamPort {
  enviar(servico: Servico, req: RequisicaoUpstream, ctx: Contexto): Promise<RespostaUpstream>;
}
