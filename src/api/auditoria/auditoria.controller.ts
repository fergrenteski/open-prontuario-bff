import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { EncaminharRequisicaoUseCase } from '../../application/proxy/encaminhar-requisicao/encaminhar-requisicao.use-case';
import { Perfis } from '../auth/decorators';
import { encaminhar, seg } from '../comum/encaminhar';
import { Requisicao } from '../comum/requisicao';
import { Operacao } from '../comum/swagger';

@ApiTags('Auditoria')
@ApiBearerAuth()
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly proxy: EncaminharRequisicaoUseCase) {}

  @Get('prontuarios/:prontuarioId')
  @Perfis('PACIENTE', 'GESTOR')
  @Operacao('listarAuditoriaProntuario', undefined, 'prontuarioId')
  @ApiQuery({ name: 'dataInicio', required: false, type: String })
  @ApiQuery({ name: 'dataFim', required: false, type: String })
  listar(@Param('prontuarioId') id: string, @Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, 'ms-prontuario-mongo', `/auditoria/prontuarios/${seg(id)}`, req, res);
  }
}
