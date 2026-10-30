import { Request } from 'express';
import { Contexto } from '../../application/ports/contexto';
import { ErroNegocio } from '../../domain/erros';
import { Usuario } from '../../domain/usuario';

export type Requisicao = Request & { usuario?: Usuario; correlationId?: string };

/** Contexto do caso de uso a partir da requisição já autenticada pelo JwtAuthGuard. */
export function contexto(req: Requisicao): Contexto {
  if (!req.usuario) throw new ErroNegocio('NAO_AUTENTICADO', 'Requisição sem usuário autenticado');
  return { usuario: req.usuario, correlationId: req.correlationId ?? '' };
}
