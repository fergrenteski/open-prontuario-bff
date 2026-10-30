import { EmitirDevTokenUseCase } from '../../src/application/auth/emitir-dev-token/emitir-dev-token.use-case';
import { ListarPersonasUseCase } from '../../src/application/auth/listar-personas/listar-personas.use-case';
import { TokenIssuerPort } from '../../src/application/ports/token.port';

const issuer: TokenIssuerPort = { emitir: jest.fn(async (u) => ({ accessToken: `jwt-${u.id}`, expiresIn: 3600 })) };

describe('EmitirDevTokenUseCase', () => {
  it('emite token para persona existente', async () => {
    const r = await new EmitirDevTokenUseCase(issuer).executar('usr-atendente-07');
    expect(r).toEqual({
      accessToken: 'jwt-usr-atendente-07',
      expiresIn: 3600,
      usuario: { id: 'usr-atendente-07', nome: 'Carla Mendes', roles: ['ATENDENTE'] },
    });
  });

  it('persona inexistente → RECURSO_NAO_ENCONTRADO', async () => {
    await expect(new EmitirDevTokenUseCase(issuer).executar('hacker')).rejects.toMatchObject({ codigo: 'RECURSO_NAO_ENCONTRADO' });
  });

  it('desligado fora do modo dev', async () => {
    await expect(new EmitirDevTokenUseCase(null).executar('pac-101')).rejects.toMatchObject({ codigo: 'RECURSO_NAO_ENCONTRADO' });
  });
});

describe('ListarPersonasUseCase', () => {
  it('lista as 5 personas no modo dev', () => {
    expect(new ListarPersonasUseCase(true).executar()).toHaveLength(5);
  });

  it('404 fora do modo dev', () => {
    expect(() => new ListarPersonasUseCase(false).executar()).toThrow(/AUTH_MODE=dev/);
  });
});
