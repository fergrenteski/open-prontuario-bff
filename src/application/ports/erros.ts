import { ErroNegocio } from '../../domain/erros';

/** O serviço a jusante respondeu com status de erro (4xx/5xx). O corpo é repassado como veio. */
export class ErroUpstream extends Error {
  constructor(
    readonly status: number,
    readonly corpo: string,
    readonly contentType?: string,
  ) {
    super(`Serviço a jusante respondeu HTTP ${status}`);
    this.name = 'ErroUpstream';
  }

  /** Campos do problem+json, quando o corpo for JSON. */
  get problema(): { title?: string; detail?: string; codigo?: string } {
    try {
      const p: unknown = JSON.parse(this.corpo);
      return p && typeof p === 'object' ? p : {};
    } catch {
      return {};
    }
  }
}

/** Timeout ou conexão recusada → 503 DEPENDENCIA_INDISPONIVEL. */
export class DependenciaIndisponivelError extends ErroNegocio {
  constructor(
    readonly servico: string,
    readonly motivo: 'timeout' | 'indisponivel',
  ) {
    super('DEPENDENCIA_INDISPONIVEL', `Serviço ${servico} indisponível (${motivo})`);
  }
}
