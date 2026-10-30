import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Response } from 'express';
import { AvisarChegadaUseCase } from '../../application/fila/avisar-chegada/avisar-chegada.use-case';
import { ListarFilaUseCase } from '../../application/fila/listar-fila/listar-fila.use-case';
import { EncaminharRequisicaoUseCase } from '../../application/proxy/encaminhar-requisicao/encaminhar-requisicao.use-case';
import { Perfis } from '../auth/decorators';
import { encaminhar, seg } from '../comum/encaminhar';
import { contexto, Requisicao } from '../comum/requisicao';
import { CorpoRepassado, Operacao } from '../comum/swagger';

const STATUS_FILA = ['A_CAMINHO', 'AGUARDANDO', 'EM_ATENDIMENTO', 'FINALIZADO'];

export class ListarFilaQuery {
  @ApiPropertyOptional({ enum: STATUS_FILA })
  @IsOptional()
  @IsIn(STATUS_FILA)
  status?: string;
}

export class AvisoChegadaRequest {
  @ApiProperty({ type: [String], minItems: 1, example: ['febre alta', 'dor de cabeça'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(2, 120, { each: true })
  sintomas!: string[];

  @ApiPropertyOptional({ minimum: 0, example: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  tempoEstimadoChegadaMin?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  autorizarProntuario?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 365, default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validadeConsentimentoDias?: number;
}

@ApiTags('Fila')
@ApiBearerAuth()
@Controller('fila')
export class FilaController {
  constructor(
    private readonly proxy: EncaminharRequisicaoUseCase,
    private readonly listarFila: ListarFilaUseCase,
    private readonly avisarChegada: AvisarChegadaUseCase,
  ) {}

  @Get(':id')
  @Perfis('ATENDENTE', 'PROFISSIONAL', 'GESTOR')
  @Operacao('listarFilaPorPrioridade', 'RF08/RF09 — MS Fila + prontuarioAutorizado vindo do MS Prontuário', 'id')
  listar(@Param('id') unidadeId: string, @Query() q: ListarFilaQuery, @Req() req: Requisicao) {
    return this.listarFila.executar({ unidadeId, status: q.status }, contexto(req));
  }

  @Delete(':id')
  @Perfis('ATENDENTE', 'PROFISSIONAL')
  @Operacao('removerDaFila', 'RF14 — encerra o registro', 'id')
  @ApiQuery({ name: 'motivo', required: true, enum: ['ATENDIDO', 'DESISTENCIA', 'ENCAMINHADO'] })
  remover(@Param('id') registroId: string, @Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, 'ms-fila-sql', `/fila/${seg(registroId)}`, req, res);
  }

  @Post(':unidadeId/aviso-chegada')
  @Perfis('PACIENTE')
  @Operacao(
    'avisarChegada',
    'RF03/RF04/RF05 — cria o registro no MS Fila e, se autorizarProntuario, concede o consentimento no MS Prontuário',
    'unidadeId',
  )
  avisar(@Param('unidadeId') unidadeId: string, @Body() body: AvisoChegadaRequest, @Req() req: Requisicao) {
    return this.avisarChegada.executar({ ...body, unidadeId }, contexto(req));
  }

  @Post(':registroId/confirmar-chegada')
  @Perfis('ATENDENTE', 'PROFISSIONAL')
  @Operacao('confirmarChegada', undefined, 'registroId')
  confirmar(@Param('registroId') id: string, @Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, 'ms-fila-sql', `/fila/${seg(id)}/confirmar-chegada`, req, res);
  }

  @Patch(':registroId/prioridade')
  @Perfis('ATENDENTE', 'PROFISSIONAL')
  @Operacao('alterarPrioridade', undefined, 'registroId')
  @CorpoRepassado()
  prioridade(@Param('registroId') id: string, @Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, 'ms-fila-sql', `/fila/${seg(id)}/prioridade`, req, res);
  }

  @Post(':registroId/iniciar-atendimento')
  @Perfis('ATENDENTE', 'PROFISSIONAL')
  @Operacao('iniciarAtendimento', undefined, 'registroId')
  iniciar(@Param('registroId') id: string, @Req() req: Requisicao, @Res() res: Response) {
    return encaminhar(this.proxy, 'ms-fila-sql', `/fila/${seg(id)}/iniciar-atendimento`, req, res);
  }
}
