import { Controller, Delete, Get, Param, Post, Put, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { EncaminharRequisicaoUseCase } from '../../application/proxy/encaminhar-requisicao/encaminhar-requisicao.use-case';
import { Perfis } from '../auth/decorators';
import { encaminhar, seg } from '../comum/encaminhar';
import { Requisicao } from '../comum/requisicao';
import { CorpoRepassado, Operacao } from '../comum/swagger';

const SERVICO = 'ms-prontuario-mongo';

@ApiTags('Consentimento')
@ApiBearerAuth()
@Perfis('PACIENTE')
@Controller('consentimentos')
export class ConsentimentosController {
  constructor(private readonly proxy: EncaminharRequisicaoUseCase) {}

  @Get()
  @Operacao('listarConsentimentos')
  @ApiQuery({ name: 'apenasAtivos', required: false, type: Boolean })
  listar(@Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, SERVICO, '/consentimentos', req, res);
  }

  @Post()
  @Operacao('concederConsentimento')
  @CorpoRepassado()
  conceder(@Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, SERVICO, '/consentimentos', req, res);
  }

  @Put(':consentimentoId')
  @Operacao('renovarConsentimento', undefined, 'consentimentoId')
  @CorpoRepassado()
  renovar(@Param('consentimentoId') id: string, @Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, SERVICO, `/consentimentos/${seg(id)}`, req, res);
  }

  @Delete(':consentimentoId')
  @Operacao('revogarConsentimento', undefined, 'consentimentoId')
  revogar(@Param('consentimentoId') id: string, @Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, SERVICO, `/consentimentos/${seg(id)}`, req, res);
  }
}
