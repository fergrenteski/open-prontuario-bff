import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { DevJwt, EntraJwtVerifier, usuarioDasClaims } from '../../src/infrastructure/auth/jwt';

const SEGREDO = 'segredo-de-teste-com-pelo-menos-32-caracteres';
const persona = { id: 'usr-prof-03', nome: 'Dr. Paulo Lima', roles: ['PROFISSIONAL' as const] };

describe('DevJwt (HS256)', () => {
  const dev = new DevJwt(SEGREDO);

  it('emite JWT válido de 1 h que o próprio verificador aceita', async () => {
    const { accessToken, expiresIn } = await dev.emitir(persona);
    expect(expiresIn).toBe(3600);
    expect(accessToken.split('.')).toHaveLength(3);
    await expect(dev.verificar(accessToken)).resolves.toEqual(persona);
  });

  it('rejeita token assinado com outro segredo', async () => {
    const { accessToken } = await new DevJwt('outro-segredo-com-pelo-menos-32-caracteres!').emitir(persona);
    await expect(dev.verificar(accessToken)).rejects.toMatchObject({ codigo: 'NAO_AUTENTICADO' });
  });

  it('rejeita lixo', async () => {
    await expect(dev.verificar('abc.def.ghi')).rejects.toMatchObject({ codigo: 'NAO_AUTENTICADO' });
  });
});

describe('EntraJwtVerifier (RS256 via JWKS)', () => {
  const tenant = 'tenant-123';
  const audience = 'api://open-prontuario-bff';
  const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
  let assinar: (claims: object, opts?: { iss?: string; aud?: string }) => Promise<string>;
  let verifier: EntraJwtVerifier;

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    verifier = new EntraJwtVerifier(tenant, audience, createLocalJWKSet({ keys: [jwk] }));
    assinar = (claims, opts = {}) =>
      new SignJWT({ ...claims })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer(opts.iss ?? issuer)
        .setAudience(opts.aud ?? audience)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);
  });

  it('aceita token do tenant com oid, name e app roles', async () => {
    const token = await assinar({ oid: 'oid-1', name: 'Fulana', roles: ['ATENDENTE', 'Desconhecido'] });
    await expect(verifier.verificar(token)).resolves.toEqual({ id: 'oid-1', nome: 'Fulana', roles: ['ATENDENTE'] });
  });

  it('rejeita token HS256 (ex.: um dev-token) no modo entra', async () => {
    const { accessToken } = await new DevJwt(SEGREDO).emitir(persona);
    await expect(verifier.verificar(accessToken)).rejects.toMatchObject({ codigo: 'NAO_AUTENTICADO' });
  });

  it('rejeita issuer ou audience diferentes', async () => {
    await expect(verifier.verificar(await assinar({ oid: 'x' }, { iss: 'https://evil/v2.0' }))).rejects.toMatchObject({
      codigo: 'NAO_AUTENTICADO',
    });
    await expect(verifier.verificar(await assinar({ oid: 'x' }, { aud: 'outra-api' }))).rejects.toMatchObject({
      codigo: 'NAO_AUTENTICADO',
    });
  });

  it('rejeita token sem oid', async () => {
    await expect(verifier.verificar(await assinar({ name: 'Sem oid' }))).rejects.toThrow(/oid/);
  });
});

describe('usuarioDasClaims', () => {
  it('usa preferred_username e depois oid como nome; roles ausentes → []', () => {
    expect(usuarioDasClaims({ oid: 'a', preferred_username: 'a@x' })).toEqual({ id: 'a', nome: 'a@x', roles: [] });
    expect(usuarioDasClaims({ oid: 'a' })).toEqual({ id: 'a', nome: 'a', roles: [] });
  });
});
