import { EncaminharRequisicaoUseCase } from '../../src/application/proxy/encaminhar-requisicao/encaminhar-requisicao.use-case';
import { UpstreamPort } from '../../src/application/ports/servicos.port';
import { ctx } from './fakes';

describe('EncaminharRequisicaoUseCase', () => {
  type Enviar = UpstreamPort['enviar'];
  const upstream = { enviar: jest.fn<ReturnType<Enviar>, Parameters<Enviar>>(async () => ({ status: 204, corpo: '' })) };
  const uc = new EncaminharRequisicaoUseCase(upstream);

  it('repassa a requisição e devolve a resposta como veio', async () => {
    const req = { metodo: 'DELETE', caminho: '/fila/r1', query: 'motivo=ATENDIDO' };
    await expect(uc.executar('ms-fila-sql', req, ctx)).resolves.toEqual({ status: 204, corpo: '' });
    expect(upstream.enviar).toHaveBeenCalledWith('ms-fila-sql', req, ctx);
  });

  it.each(['/internal/fila/upa-01/snapshot', '/api/internal/x', '/fila/..', '/fila/%2E%2E', '/fila/a%2Fb', 'fila/x', '/fila/%E0%A4%A'])(
    'bloqueia caminho %s',
    (caminho) => {
      expect(() => uc.executar('ms-fila-sql', { metodo: 'GET', caminho }, ctx)).toThrow(/Caminho inválido/);
    },
  );
});
