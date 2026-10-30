import { ErroNegocio } from '../../../domain/erros';
import { PERSONAS, Usuario } from '../../../domain/usuario';

export class ListarPersonasUseCase {
  constructor(private readonly modoDev: boolean) {}

  executar(): readonly Usuario[] {
    if (!this.modoDev) throw new ErroNegocio('RECURSO_NAO_ENCONTRADO', 'Disponível apenas com AUTH_MODE=dev');
    return PERSONAS;
  }
}
