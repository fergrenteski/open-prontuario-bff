import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ErroUpstream } from '../../application/ports/erros';
import { CodigoErro, ErroNegocio } from '../../domain/erros';
import { Requisicao } from './requisicao';

const STATUS: Record<CodigoErro, number> = {
  REQUISICAO_INVALIDA: 400,
  NAO_AUTENTICADO: 401,
  SEM_PERMISSAO: 403,
  RECURSO_NAO_ENCONTRADO: 404,
  AGREGACAO_FALHOU: 502,
  DEPENDENCIA_INDISPONIVEL: 503,
};

const TITULO: Record<string, string> = {
  REQUISICAO_INVALIDA: 'Requisição inválida',
  NAO_AUTENTICADO: 'Não autenticado',
  SEM_PERMISSAO: 'Sem permissão',
  RECURSO_NAO_ENCONTRADO: 'Recurso não encontrado',
  AGREGACAO_FALHOU: 'Agregação falhou',
  DEPENDENCIA_INDISPONIVEL: 'Dependência indisponível',
  ERRO_INTERNO: 'Erro interno',
};

const CODIGO_POR_STATUS: Record<number, CodigoErro> = {
  400: 'REQUISICAO_INVALIDA',
  401: 'NAO_AUTENTICADO',
  403: 'SEM_PERMISSAO',
  404: 'RECURSO_NAO_ENCONTRADO',
};

/**
 * Converte qualquer erro em `application/problem+json` (RFC 9457, CONVENCOES §4).
 * Erros dos serviços a jusante são repassados com o mesmo status e corpo.
 * Nunca expõe stack trace.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Erros');

  catch(erro: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Requisicao>();
    const res = http.getResponse<Response>();

    if (erro instanceof ErroUpstream) {
      res.status(erro.status).type(erro.contentType ?? 'application/problem+json').send(erro.corpo);
      return;
    }

    let status = 500;
    let codigo = 'ERRO_INTERNO';
    let detail = 'Erro inesperado. Informe o correlationId ao suporte.';
    if (erro instanceof ErroNegocio) {
      status = STATUS[erro.codigo];
      codigo = erro.codigo;
      detail = erro.message;
    } else if (erro instanceof HttpException) {
      status = erro.getStatus();
      codigo = CODIGO_POR_STATUS[status] ?? (status >= 500 ? 'ERRO_INTERNO' : 'REQUISICAO_INVALIDA');
      const corpo = erro.getResponse();
      const msg = typeof corpo === 'object' && corpo && 'message' in corpo ? corpo.message : erro.message;
      detail = Array.isArray(msg) ? msg.join('; ') : String(msg);
    }
    if (status >= 500) {
      this.logger.error(`[${req.correlationId}] ${req.method} ${req.path}: ${erro instanceof Error ? erro.stack : String(erro)}`);
    }

    res
      .status(status)
      .type('application/problem+json')
      .json({
        type: `https://openprontuario.dev/erros/${codigo.toLowerCase().replace(/_/g, '-')}`,
        title: TITULO[codigo] ?? 'Erro',
        status,
        detail,
        instance: req.originalUrl.split('?')[0],
        codigo,
        correlationId: req.correlationId,
      });
  }
}
