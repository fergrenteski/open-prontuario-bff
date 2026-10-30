import { Contexto } from '../../application/ports/contexto';
import { MsFilaPort, MsProntuarioPort, VisaoAgregadaPort } from '../../application/ports/servicos.port';
import { Prontuario } from '../../domain/agregacao';
import { RegistroFila } from '../../domain/fila';
import { Unidade, UnidadeComDistancia, VisaoAgregada } from '../../domain/unidade';
import { HttpUpstreamClient } from './http-upstream.client';

const seg = encodeURIComponent;

export class MsFilaHttpAdapter implements MsFilaPort {
  constructor(private readonly http: HttpUpstreamClient) {}

  buscarUnidade(unidadeId: string, ctx: Contexto) {
    return this.http.json<Unidade>('ms-fila-sql', { metodo: 'GET', caminho: `/unidades/${seg(unidadeId)}` }, ctx);
  }

  listarFila(unidadeId: string, status: string | undefined, ctx: Contexto) {
    const query = status ? new URLSearchParams({ status }).toString() : undefined;
    return this.http.json<RegistroFila[]>('ms-fila-sql', { metodo: 'GET', caminho: `/fila/${seg(unidadeId)}`, query }, ctx);
  }

  listarUnidadesProximas(c: { latitude: number; longitude: number; raioKm?: number }, ctx: Contexto) {
    const query = new URLSearchParams({ latitude: String(c.latitude), longitude: String(c.longitude) });
    if (c.raioKm !== undefined) query.set('raioKm', String(c.raioKm));
    return this.http.json<UnidadeComDistancia[]>(
      'ms-fila-sql',
      { metodo: 'GET', caminho: '/unidades/proximas', query: query.toString() },
      ctx,
    );
  }

  avisarChegada(unidadeId: string, aviso: { sintomas: string[]; tempoEstimadoChegadaMin?: number }, ctx: Contexto) {
    return this.http.json<RegistroFila>(
      'ms-fila-sql',
      { metodo: 'POST', caminho: `/fila/${seg(unidadeId)}/aviso-chegada`, corpo: aviso },
      ctx,
    );
  }
}

export class MsProntuarioHttpAdapter implements MsProntuarioPort {
  constructor(private readonly http: HttpUpstreamClient) {}

  async listarPacientesComConsentimentoValido(unidadeId: string, ctx: Contexto) {
    const r = await this.http.json<{ pacienteIds: string[] }>(
      'ms-prontuario-mongo',
      { metodo: 'GET', caminho: '/internal/consentimentos/validos', query: new URLSearchParams({ unidadeId }).toString() },
      ctx,
    );
    return r.pacienteIds;
  }

  consultarProntuario(pacienteId: string, unidadeId: string, ctx: Contexto) {
    return this.http.json<Prontuario>(
      'ms-prontuario-mongo',
      { metodo: 'GET', caminho: `/prontuarios/${seg(pacienteId)}`, query: new URLSearchParams({ unidadeId }).toString() },
      ctx,
    );
  }

  async concederConsentimento(unidadeId: string, validadeDias: number, ctx: Contexto) {
    await this.http.json(
      'ms-prontuario-mongo',
      { metodo: 'POST', caminho: '/consentimentos', corpo: { unidadeId, validadeDias } },
      ctx,
    );
  }
}

export class VisaoAgregadaHttpAdapter implements VisaoAgregadaPort {
  constructor(private readonly http: HttpUpstreamClient) {}

  consultar(unidadeId: string, ctx: Contexto) {
    return this.http.json<VisaoAgregada>(
      'fn-visao-agregada',
      { metodo: 'GET', caminho: `/api/visao-agregada/${seg(unidadeId)}` },
      ctx,
    );
  }

  consultarVarias(unidadeIds: string[], ctx: Contexto) {
    return this.http.json<VisaoAgregada[]>(
      'fn-visao-agregada',
      { metodo: 'GET', caminho: '/api/visao-agregada', query: new URLSearchParams({ unidadeIds: unidadeIds.join(',') }).toString() },
      ctx,
    );
  }
}
