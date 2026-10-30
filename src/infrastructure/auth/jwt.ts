import { createRemoteJWKSet, JWTPayload, jwtVerify, JWTVerifyGetKey, SignJWT } from 'jose';
import { TokenIssuerPort, TokenVerifierPort } from '../../application/ports/token.port';
import { ErroNegocio } from '../../domain/erros';
import { ehPerfil, Usuario } from '../../domain/usuario';

const DEV_ISSUER = 'open-prontuario-bff-dev';
const DEV_AUDIENCE = 'open-prontuario-bff';
const DEV_EXPIRA_EM_S = 3600;

/** Claims `oid`, `name` e `roles` (app roles do Entra) → Usuario. Perfis desconhecidos são ignorados. */
export function usuarioDasClaims(p: JWTPayload): Usuario {
  const id = typeof p.oid === 'string' ? p.oid : undefined;
  if (!id) throw new ErroNegocio('NAO_AUTENTICADO', 'Token sem claim oid');
  const nome =
    typeof p.name === 'string' ? p.name : typeof p.preferred_username === 'string' ? p.preferred_username : id;
  const roles = Array.isArray(p.roles) ? p.roles.filter(ehPerfil) : [];
  return { id, nome, roles };
}

async function verificar(fn: () => Promise<{ payload: JWTPayload }>): Promise<Usuario> {
  let payload: JWTPayload;
  try {
    ({ payload } = await fn());
  } catch {
    throw new ErroNegocio('NAO_AUTENTICADO', 'Token inválido ou expirado');
  }
  return usuarioDasClaims(payload);
}

/** Modo dev: HS256 com `JWT_SECRET`, emitido pelo próprio BFF para as personas do seed. */
export class DevJwt implements TokenIssuerPort, TokenVerifierPort {
  private readonly chave: Uint8Array;

  constructor(segredo: string) {
    this.chave = new TextEncoder().encode(segredo);
  }

  async emitir(u: Usuario) {
    const accessToken = await new SignJWT({ oid: u.id, name: u.nome, roles: u.roles })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(u.id)
      .setIssuer(DEV_ISSUER)
      .setAudience(DEV_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${DEV_EXPIRA_EM_S}s`)
      .sign(this.chave);
    return { accessToken, expiresIn: DEV_EXPIRA_EM_S };
  }

  verificar(token: string) {
    return verificar(() =>
      jwtVerify(token, this.chave, { algorithms: ['HS256'], issuer: DEV_ISSUER, audience: DEV_AUDIENCE }),
    );
  }
}

/** Modo entra: RS256 validado pelo JWKS do tenant (issuer v2.0 e audience da API). */
export class EntraJwtVerifier implements TokenVerifierPort {
  private readonly issuer: string;

  constructor(
    tenantId: string,
    private readonly audience: string,
    private readonly jwks: JWTVerifyGetKey = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`),
    ),
  ) {
    this.issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  }

  verificar(token: string) {
    return verificar(() =>
      jwtVerify(token, this.jwks, { algorithms: ['RS256'], issuer: this.issuer, audience: this.audience }),
    );
  }
}
