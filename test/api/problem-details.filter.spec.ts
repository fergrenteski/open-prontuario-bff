import { ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { ProblemDetailsFilter } from '../../src/api/comum/problem-details.filter';

function host() {
  const res = {
    statusCode: 0,
    corpo: undefined as unknown,
    status(s: number) {
      this.statusCode = s;
      return this;
    },
    type() {
      return this;
    },
    json(c: unknown) {
      this.corpo = c;
      return this;
    },
  };
  const req = { method: 'GET', path: '/api/x', originalUrl: '/api/x?a=1', correlationId: 'c-1' };
  const h = { switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) } as unknown as ArgumentsHost;
  return { h, res };
}

describe('ProblemDetailsFilter', () => {
  const filtro = new ProblemDetailsFilter();
  const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

  it('erro inesperado → 500 ERRO_INTERNO sem stack trace nem mensagem interna', () => {
    const { h, res } = host();
    filtro.catch(new Error('SELECT * FROM segredo'), h);
    expect(res.statusCode).toBe(500);
    expect(res.corpo).toMatchObject({ status: 500, codigo: 'ERRO_INTERNO', correlationId: 'c-1', instance: '/api/x' });
    expect(JSON.stringify(res.corpo)).not.toMatch(/SELECT|at /);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[c-1] GET /api/x'));
  });

  it('HttpException mantém o status e mapeia o código', () => {
    const { h, res } = host();
    filtro.catch(new HttpException('Proibido', 403), h);
    expect(res.corpo).toMatchObject({ status: 403, codigo: 'SEM_PERMISSAO', detail: 'Proibido' });
  });

  it.each([
    [413, 'REQUISICAO_INVALIDA'],
    [502, 'ERRO_INTERNO'],
  ])('HttpException %i sem código próprio → %s', (status, codigo) => {
    const { h, res } = host();
    filtro.catch(new HttpException({ message: ['a', 'b'] }, status), h);
    expect(res.corpo).toMatchObject({ status, codigo });
  });
});
