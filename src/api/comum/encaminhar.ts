import { Response } from 'express';
import { Servico } from '../../application/ports/servicos.port';
import { EncaminharRequisicaoUseCase } from '../../application/proxy/encaminhar-requisicao/encaminhar-requisicao.use-case';
import { contexto, Requisicao } from './requisicao';

/** Codifica um parâmetro de rota para compor o caminho a jusante. */
export const seg = encodeURIComponent;

/** Proxy CRUD: repassa método, query e corpo; devolve status, content-type e corpo do serviço. */
export async function encaminhar(
  uc: EncaminharRequisicaoUseCase,
  servico: Servico,
  caminho: string,
  req: Requisicao,
  res: Response,
): Promise<void> {
  const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?') + 1) : undefined;
  const r = await uc.executar(servico, { metodo: req.method, caminho, query, corpo: req.body }, contexto(req));
  res.status(r.status);
  if (r.contentType) res.type(r.contentType);
  res.send(r.corpo);
}
