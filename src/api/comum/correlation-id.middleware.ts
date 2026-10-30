import { randomUUID } from 'node:crypto';
import { NextFunction, Response } from 'express';
import { Requisicao } from './requisicao';

const FORMATO_SEGURO = /^[\w.-]{1,128}$/;

/** Lê `X-Correlation-Id` (se for seguro) ou gera um UUID v4; devolve-o na resposta. */
export function correlationIdMiddleware(req: Requisicao, res: Response, next: NextFunction): void {
  const recebido = req.header('x-correlation-id');
  req.correlationId = recebido && FORMATO_SEGURO.test(recebido) ? recebido : randomUUID();
  res.setHeader('X-Correlation-Id', req.correlationId);
  next();
}
