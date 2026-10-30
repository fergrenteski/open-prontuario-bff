import { Contexto } from '../../application/ports/contexto';
import { DependenciaIndisponivelError, ErroUpstream } from '../../application/ports/erros';
import { RequisicaoUpstream, RespostaUpstream, Servico, UpstreamPort } from '../../application/ports/servicos.port';

export interface HttpUpstreamConfig {
  urls: Record<Servico, string>;
  internalApiKey: string;
  timeoutMs: number;
}

/**
 * Valores de header precisam ser ByteString (Latin-1). Nomes como "João" passam
 * como estão (Tomcat/Spring leem headers em ISO-8859-1); caracteres fora do
 * Latin-1 e de controle viram "?".
 */
function headerSeguro(valor: string): string {
  return valor.replace(/[^\x20-\x7e\xa0-\xff]/gu, '?');
}

/** Cliente HTTP (fetch nativo) que implementa o pass-through e propaga os headers da CONVENCOES §2. */
export class HttpUpstreamClient implements UpstreamPort {
  constructor(private readonly config: HttpUpstreamConfig) {}

  async enviar(servico: Servico, req: RequisicaoUpstream, ctx: Contexto): Promise<RespostaUpstream> {
    const url = `${this.config.urls[servico]}${req.caminho}${req.query ? `?${req.query}` : ''}`;
    const headers: Record<string, string> = {
      Accept: 'application/json, application/problem+json',
      'X-Internal-Key': this.config.internalApiKey,
      'X-User-Id': headerSeguro(ctx.usuario.id),
      'X-User-Roles': ctx.usuario.roles.join(','),
      'X-User-Name': headerSeguro(ctx.usuario.nome),
      'X-Correlation-Id': ctx.correlationId,
    };
    const temCorpo = req.corpo !== undefined && !['GET', 'HEAD', 'DELETE'].includes(req.metodo);
    if (temCorpo) headers['Content-Type'] = 'application/json';

    try {
      const resposta = await fetch(url, {
        method: req.metodo,
        headers,
        body: temCorpo ? JSON.stringify(req.corpo) : undefined,
        signal: AbortSignal.timeout(this.config.timeoutMs),
        redirect: 'manual',
      });
      return {
        status: resposta.status,
        corpo: await resposta.text(),
        contentType: resposta.headers.get('content-type') ?? undefined,
      };
    } catch (erro) {
      // `name` em vez de instanceof: o DOMException do AbortSignal pode vir de outro realm.
      const nome = (erro as { name?: unknown } | null)?.name;
      const timeout = nome === 'TimeoutError' || nome === 'AbortError';
      throw new DependenciaIndisponivelError(servico, timeout ? 'timeout' : 'indisponivel');
    }
  }

  /** Para os adapters tipados: 2xx → JSON; erro → `ErroUpstream` com o corpo original. */
  async json<T>(servico: Servico, req: RequisicaoUpstream, ctx: Contexto): Promise<T> {
    const r = await this.enviar(servico, req, ctx);
    if (r.status < 200 || r.status >= 300) throw new ErroUpstream(r.status, r.corpo, r.contentType);
    if (!r.corpo) return undefined as T;
    try {
      return JSON.parse(r.corpo) as T;
    } catch {
      const problema = { title: 'Resposta inválida do serviço', status: 502, codigo: 'DEPENDENCIA_INDISPONIVEL' };
      throw new ErroUpstream(502, JSON.stringify(problema), 'application/problem+json');
    }
  }
}
