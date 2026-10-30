import { ErroNegocio } from '../../../domain/erros';
import { buscarPersona, Usuario } from '../../../domain/usuario';
import { TokenIssuerPort } from '../../ports/token.port';

export interface DevToken {
  accessToken: string;
  expiresIn: number;
  usuario: Usuario;
}

/** Emite JWT para uma persona do seed. `issuer = null` quando AUTH_MODE=entra → 404. */
export class EmitirDevTokenUseCase {
  constructor(private readonly issuer: TokenIssuerPort | null) {}

  async executar(usuarioId: string): Promise<DevToken> {
    if (!this.issuer) throw new ErroNegocio('RECURSO_NAO_ENCONTRADO', 'Disponível apenas com AUTH_MODE=dev');
    const usuario = buscarPersona(usuarioId);
    if (!usuario) throw new ErroNegocio('RECURSO_NAO_ENCONTRADO', `Persona ${usuarioId} não existe`);
    return { ...(await this.issuer.emitir(usuario)), usuario };
  }
}
