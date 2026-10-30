import { RegistroFila } from '../../../domain/fila';
import { Contexto } from '../../ports/contexto';
import { ErroUpstream } from '../../ports/erros';
import { MsFilaPort, MsProntuarioPort } from '../../ports/servicos.port';

export interface AvisarChegadaCommand {
  unidadeId: string;
  sintomas: string[];
  tempoEstimadoChegadaMin?: number;
  autorizarProntuario?: boolean;
  validadeConsentimentoDias?: number;
}

export type AvisarChegadaResult = RegistroFila & { prontuarioAutorizado: boolean; avisos: string[] };

const VALIDADE_PADRAO_DIAS = 3;

/**
 * RF03/RF04/RF05: cria o registro no MS Fila e, se o paciente autorizou,
 * concede o consentimento no MS Prontuário. Falha no consentimento não
 * desfaz o aviso de chegada: vira aviso na resposta.
 */
export class AvisarChegadaUseCase {
  constructor(
    private readonly msFila: MsFilaPort,
    private readonly msProntuario: MsProntuarioPort,
  ) {}

  async executar(cmd: AvisarChegadaCommand, ctx: Contexto): Promise<AvisarChegadaResult> {
    const registro = await this.msFila.avisarChegada(
      cmd.unidadeId,
      { sintomas: cmd.sintomas, tempoEstimadoChegadaMin: cmd.tempoEstimadoChegadaMin },
      ctx,
    );
    if (!cmd.autorizarProntuario) return { ...registro, prontuarioAutorizado: false, avisos: [] };

    try {
      await this.msProntuario.concederConsentimento(
        cmd.unidadeId,
        cmd.validadeConsentimentoDias ?? VALIDADE_PADRAO_DIAS,
        ctx,
      );
      return { ...registro, prontuarioAutorizado: true, avisos: [] };
    } catch (erro) {
      if (erro instanceof ErroUpstream && erro.status === 409 && erro.problema.codigo === 'CONSENTIMENTO_DUPLICADO') {
        return { ...registro, prontuarioAutorizado: true, avisos: [] };
      }
      return {
        ...registro,
        prontuarioAutorizado: false,
        avisos: [
          'Aviso de chegada registrado, mas não foi possível autorizar o acesso ao prontuário agora. ' +
            'Você pode autorizar depois em Consentimentos.',
        ],
      };
    }
  }
}
