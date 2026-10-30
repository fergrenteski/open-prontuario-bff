import { Controller, Delete, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { EncaminharRequisicaoUseCase } from '../../application/proxy/encaminhar-requisicao/encaminhar-requisicao.use-case';
import { Perfis } from '../auth/decorators';
import { encaminhar, seg } from '../comum/encaminhar';
import { Requisicao } from '../comum/requisicao';
import { CorpoRepassado, Operacao } from '../comum/swagger';

@ApiTags('Lotacoes')
@ApiBearerAuth()
@Perfis('GESTOR')
@Controller('lotacoes')
export class LotacoesController {
  constructor(private readonly proxy: EncaminharRequisicaoUseCase) {}

  @Get()
  @Operacao('listarLotacoes')
  @ApiQuery({ name: 'unidadeId', required: true, type: String })
  listar(@Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, 'ms-fila-sql', '/lotacoes', req, res);
  }

  @Post()
  @Operacao('criarLotacao')
  @CorpoRepassado()
  criar(@Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, 'ms-fila-sql', '/lotacoes', req, res);
  }

  @Delete(':lotacaoId')
  @Operacao('removerLotacao', undefined, 'lotacaoId')
  remover(@Param('lotacaoId') id: string, @Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, 'ms-fila-sql', `/lotacoes/${seg(id)}`, req, res);
  }
}
