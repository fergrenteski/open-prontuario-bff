import { Controller, Delete, Get, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Response } from 'express';
import { EncaminharRequisicaoUseCase } from '../../application/proxy/encaminhar-requisicao/encaminhar-requisicao.use-case';
import { ListarUnidadesProximasUseCase } from '../../application/unidades/listar-proximas/listar-unidades-proximas.use-case';
import { Perfis } from '../auth/decorators';
import { encaminhar, seg } from '../comum/encaminhar';
import { contexto, Requisicao } from '../comum/requisicao';
import { CorpoRepassado, Operacao } from '../comum/swagger';

export class UnidadesProximasQuery {
  @ApiProperty({ example: -25.4372 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: -49.27 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  raioKm?: number;
}

const TODOS = ['PACIENTE', 'ATENDENTE', 'PROFISSIONAL', 'GESTOR'] as const;

@ApiTags('Unidades')
@ApiBearerAuth()
@Controller('unidades')
export class UnidadesController {
  constructor(
    private readonly proxy: EncaminharRequisicaoUseCase,
    private readonly proximas: ListarUnidadesProximasUseCase,
  ) {}

  @Get()
  @Perfis(...TODOS)
  @Operacao('listarUnidades')
  listar(@Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, 'ms-fila-sql', '/unidades', req, res);
  }

  @Post()
  @Perfis('GESTOR')
  @Operacao('criarUnidade')
  @CorpoRepassado()
  criar(@Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, 'ms-fila-sql', '/unidades', req, res);
  }

  // Rotas fixas antes de `:unidadeId` (ordem de registro do Express).
  @Get('proximas')
  @Perfis('PACIENTE')
  @Operacao('listarUnidadesProximas', 'RF02 — MS Fila (distância) + Function (indicadores) agregados')
  listarProximas(@Query() q: UnidadesProximasQuery, @Req() req: Requisicao) {
    return this.proximas.executar(q, contexto(req));
  }

  @Get('minhas')
  @Perfis('ATENDENTE', 'PROFISSIONAL', 'GESTOR')
  @Operacao('listarMinhasUnidades')
  minhas(@Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, 'ms-fila-sql', '/unidades/minhas', req, res);
  }

  @Get(':unidadeId')
  @Perfis(...TODOS)
  @Operacao('buscarUnidade', undefined, 'unidadeId')
  buscar(@Param('unidadeId') id: string, @Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, 'ms-fila-sql', `/unidades/${seg(id)}`, req, res);
  }

  @Put(':unidadeId')
  @Perfis('GESTOR')
  @Operacao('atualizarUnidade', undefined, 'unidadeId')
  @CorpoRepassado()
  atualizar(@Param('unidadeId') id: string, @Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, 'ms-fila-sql', `/unidades/${seg(id)}`, req, res);
  }

  @Delete(':unidadeId')
  @Perfis('GESTOR')
  @Operacao('removerUnidade', undefined, 'unidadeId')
  remover(@Param('unidadeId') id: string, @Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, 'ms-fila-sql', `/unidades/${seg(id)}`, req, res);
  }

  @Get(':unidadeId/visao-agregada')
  @Perfis(...TODOS)
  @Operacao('consultarVisaoAgregada', 'RF18 — proxy para a Function', 'unidadeId')
  visaoAgregada(@Param('unidadeId') id: string, @Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, 'fn-visao-agregada', `/api/visao-agregada/${seg(id)}`, req, res);
  }
}
