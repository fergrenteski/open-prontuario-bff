import { marcarProntuarioAutorizado, RegistroFila } from '../../../domain/fila';
import { Contexto } from '../../ports/contexto';
import { MsFilaPort, MsProntuarioPort } from '../../ports/servicos.port';

/** RF08/RF09: fila do MS Fila enriquecida com `prontuarioAutorizado` (null se o MS Prontuário falhar). */
export class ListarFilaUseCase {
  constructor(
    private readonly msFila: MsFilaPort,
    private readonly msProntuario: MsProntuarioPort,
  ) {}

  async executar(q: { unidadeId: string; status?: string }, ctx: Contexto): Promise<RegistroFila[]> {
    const [fila, autorizados] = await Promise.allSettled([
      this.msFila.listarFila(q.unidadeId, q.status, ctx),
      this.msProntuario.listarPacientesComConsentimentoValido(q.unidadeId, ctx),
    ]);
    if (fila.status === 'rejected') throw fila.reason;
    return marcarProntuarioAutorizado(fila.value, autorizados.status === 'fulfilled' ? autorizados.value : null);
  }
}
