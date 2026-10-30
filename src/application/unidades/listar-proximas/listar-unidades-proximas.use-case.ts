import { mesclarVisoes, UnidadeProxima } from '../../../domain/unidade';
import { Contexto } from '../../ports/contexto';
import { MsFilaPort, VisaoAgregadaPort } from '../../ports/servicos.port';

export interface ListarUnidadesProximasQuery {
  latitude: number;
  longitude: number;
  raioKm?: number;
}

/** RF02: unidades por distância (MS Fila) + indicadores em lote (Function); Function fora → indicadores null. */
export class ListarUnidadesProximasUseCase {
  constructor(
    private readonly msFila: MsFilaPort,
    private readonly visao: VisaoAgregadaPort,
  ) {}

  async executar(q: ListarUnidadesProximasQuery, ctx: Contexto): Promise<UnidadeProxima[]> {
    const unidades = await this.msFila.listarUnidadesProximas(q, ctx);
    if (unidades.length === 0) return [];
    // ponytail: um único lote; a Function aceita até 50 ids e o raio máximo (100 km) não chega perto disso.
    const visoes = await this.visao.consultarVarias(
      unidades.map((u) => u.id),
      ctx,
    ).catch(() => null);
    return mesclarVisoes(unidades, visoes);
  }
}
