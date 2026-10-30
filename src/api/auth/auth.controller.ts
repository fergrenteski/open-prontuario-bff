import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { EmitirDevTokenUseCase } from '../../application/auth/emitir-dev-token/emitir-dev-token.use-case';
import { ListarPersonasUseCase } from '../../application/auth/listar-personas/listar-personas.use-case';
import { contexto, Requisicao } from '../comum/requisicao';
import { Operacao } from '../comum/swagger';
import { Perfis, Publico } from './decorators';

export class DevTokenRequest {
  @ApiProperty({ example: 'usr-atendente-07' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  usuarioId!: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly listarPersonas: ListarPersonasUseCase,
    private readonly emitirDevToken: EmitirDevTokenUseCase,
  ) {}

  @Get('personas')
  @Publico()
  @Operacao('listarPersonas', 'Personas disponíveis no modo dev (404 quando AUTH_MODE=entra)')
  personas() {
    return this.listarPersonas.executar();
  }

  @Post('dev-token')
  @HttpCode(200)
  @Publico()
  @Operacao('emitirDevToken', 'Emite JWT HS256 (1 h) para uma persona do seed (somente AUTH_MODE=dev)')
  devToken(@Body() body: DevTokenRequest) {
    return this.emitirDevToken.executar(body.usuarioId);
  }

  @Get('me')
  @ApiBearerAuth()
  @Perfis('PACIENTE', 'ATENDENTE', 'PROFISSIONAL', 'GESTOR')
  @Operacao('usuarioAtual')
  me(@Req() req: Requisicao) {
    return contexto(req).usuario;
  }
}
