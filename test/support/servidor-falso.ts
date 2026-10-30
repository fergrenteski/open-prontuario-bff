import { createServer, IncomingHttpHeaders, Server } from 'node:http';
import { AddressInfo } from 'node:net';

export interface RequisicaoRecebida {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: string;
}

export interface RespostaFalsa {
  status?: number;
  body?: unknown;
  contentType?: string;
  atrasoMs?: number;
}

/**
 * Servidor HTTP local que simula um serviço a jusante: registra as requisições
 * e responde conforme as rotas configuradas (`"GET /unidades/upa-01"` → resposta).
 */
export class ServidorFalso {
  readonly recebidas: RequisicaoRecebida[] = [];
  rotas: Record<string, RespostaFalsa> = {};
  private server?: Server;
  url = '';

  async iniciar(): Promise<this> {
    this.server = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const path = req.url ?? '';
        this.recebidas.push({ method: req.method ?? '', url: path, headers: req.headers, body });
        const r = this.rotas[`${req.method} ${path}`] ?? this.rotas[`${req.method} ${path.split('?')[0]}`];
        const responder = () => {
          if (!r) {
            res.writeHead(404, { 'content-type': 'application/problem+json' });
            res.end(JSON.stringify({ title: 'Não encontrado', status: 404, codigo: 'RECURSO_NAO_ENCONTRADO' }));
            return;
          }
          const status = r.status ?? 200;
          if (r.body === undefined) {
            res.writeHead(status);
            res.end();
            return;
          }
          res.writeHead(status, { 'content-type': r.contentType ?? 'application/json' });
          res.end(typeof r.body === 'string' ? r.body : JSON.stringify(r.body));
        };
        if (r?.atrasoMs) setTimeout(responder, r.atrasoMs).unref();
        else responder();
      });
    });
    await new Promise<void>((ok) => this.server!.listen(0, '127.0.0.1', ok));
    this.url = `http://127.0.0.1:${(this.server!.address() as AddressInfo).port}`;
    return this;
  }

  limpar() {
    this.recebidas.length = 0;
    this.rotas = {};
  }

  async parar() {
    this.server?.closeAllConnections();
    await new Promise<void>((ok) => this.server?.close(() => ok()));
  }
}
