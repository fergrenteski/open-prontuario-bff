import { Usuario } from '../../domain/usuario';

export interface TokenVerifierPort {
  /** Valida o JWT e extrai o usuário; lança `ErroNegocio('NAO_AUTENTICADO')` se inválido. */
  verificar(token: string): Promise<Usuario>;
}

export interface TokenIssuerPort {
  emitir(usuario: Usuario): Promise<{ accessToken: string; expiresIn: number }>;
}

/** Token de injeção (composition root → guards da API). */
export const TOKEN_VERIFIER = Symbol('TokenVerifierPort');
