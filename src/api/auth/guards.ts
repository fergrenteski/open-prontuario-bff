import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TOKEN_VERIFIER, TokenVerifierPort } from '../../application/ports/token.port';
import { ErroNegocio } from '../../domain/erros';
import { Perfil, possuiAlgumPerfil } from '../../domain/usuario';
import { Requisicao } from '../comum/requisicao';
import { PERFIS, PUBLICO } from './decorators';

function ehPublica(reflector: Reflector, ctx: ExecutionContext): boolean {
  return reflector.getAllAndOverride<boolean>(PUBLICO, [ctx.getHandler(), ctx.getClass()]) ?? false;
}

/** Valida o `Authorization: Bearer` (dev ou Entra) e coloca o usuário na requisição. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifierPort,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ehPublica(this.reflector, ctx)) return true;
    const req = ctx.switchToHttp().getRequest<Requisicao>();
    const [tipo, token] = (req.header('authorization') ?? '').split(' ');
    if (tipo?.toLowerCase() !== 'bearer' || !token) throw new ErroNegocio('NAO_AUTENTICADO', 'Token ausente');
    req.usuario = await this.verifier.verificar(token);
    return true;
  }
}

/** Perfil insuficiente → 403 SEM_PERMISSAO. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (ehPublica(this.reflector, ctx)) return true;
    const exigidos = this.reflector.getAllAndOverride<Perfil[]>(PERFIS, [ctx.getHandler(), ctx.getClass()]) ?? [];
    const { usuario } = ctx.switchToHttp().getRequest<Requisicao>();
    if (!usuario || !possuiAlgumPerfil(usuario, exigidos)) {
      throw new ErroNegocio('SEM_PERMISSAO', `Operação permitida apenas para: ${exigidos.join(', ')}`);
    }
    return true;
  }
}
