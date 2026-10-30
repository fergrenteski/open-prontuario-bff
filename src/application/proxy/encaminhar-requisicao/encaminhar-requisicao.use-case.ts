import { ErroNegocio } from '../../../domain/erros';
import { Contexto } from '../../ports/contexto';
import { RequisicaoUpstream, RespostaUpstream, Servico, UpstreamPort } from '../../ports/servicos.port';

function segmentoInseguro(segmento: string): boolean {
  let s: string;
  try {
    s = decodeURIComponent(segmento);
  } catch {
    return true;
  }
  return s === '.' || s === '..' || s.includes('/') || s.includes('\\');
}

/**
 * Proxy CRUD: repassa a requisição ao serviço e devolve status/corpo como vieram.
 * Nunca alcança rotas `/internal/**` nem permite escapar do caminho com `..`.
 */
export class EncaminharRequisicaoUseCase {
  constructor(private readonly upstream: UpstreamPort) {}

  executar(servico: Servico, req: RequisicaoUpstream, ctx: Contexto): Promise<RespostaUpstream> {
    const segmentos = req.caminho.split('/').slice(1);
    if (!req.caminho.startsWith('/') || segmentos.some(segmentoInseguro) || /^\/(api\/)?internal(\/|$)/.test(req.caminho)) {
      throw new ErroNegocio('REQUISICAO_INVALIDA', 'Caminho inválido');
    }
    return this.upstream.enviar(servico, req, ctx);
  }
}
