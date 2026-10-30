import { Controller, Delete, Get, Param, Post, Put, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { EncaminharRequisicaoUseCase } from '../../application/proxy/encaminhar-requisicao/encaminhar-requisicao.use-case';
import { Perfis } from '../auth/decorators';
import { encaminhar, seg } from '../comum/encaminhar';
import { Requisicao } from '../comum/requisicao';
import { CorpoRepassado, Operacao } from '../comum/swagger';

const SERVICO = 'ms-prontuario-mongo';

@ApiTags('Prontuario')
@ApiBearerAuth()
@Controller('prontuarios')
export class ProntuariosController {
  constructor(private readonly proxy: EncaminharRequisicaoUseCase) {}

  @Post()
  @Perfis('GESTOR')
  @Operacao('criarProntuario')
  @CorpoRepassado()
  criar(@Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, SERVICO, '/prontuarios', req, res);
  }

  @Get('me')
  @Perfis('PACIENTE')
  @Operacao('consultarProprioProntuario')
  meu(@Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, SERVICO, '/prontuarios/me', req, res);
  }

  @Get(':pacienteId')
  @Perfis('ATENDENTE', 'PROFISSIONAL')
  @Operacao('consultarProntuario', 'Prontuário (acesso auditado pelo MS Prontuário)', 'pacienteId')
  @ApiQuery({ name: 'unidadeId', required: true, type: String })
  consultar(@Param('pacienteId') id: string, @Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, SERVICO, `/prontuarios/${seg(id)}`, req, res);
  }

  @Put(':pacienteId')
  @Perfis('GESTOR')
  @Operacao('atualizarProntuario', undefined, 'pacienteId')
  @CorpoRepassado()
  atualizar(@Param('pacienteId') id: string, @Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, SERVICO, `/prontuarios/${seg(id)}`, req, res);
  }

  @Delete(':pacienteId')
  @Perfis('GESTOR')
  @Operacao('removerProntuario', undefined, 'pacienteId')
  remover(@Param('pacienteId') id: string, @Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, SERVICO, `/prontuarios/${seg(id)}`, req, res);
  }

  @Post(':pacienteId/atendimentos')
  @Perfis('PROFISSIONAL')
  @Operacao('registrarAtendimento', undefined, 'pacienteId')
  @CorpoRepassado()
  registrarAtendimento(@Param('pacienteId') id: string, @Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, SERVICO, `/prontuarios/${seg(id)}/atendimentos`, req, res);
  }
}
