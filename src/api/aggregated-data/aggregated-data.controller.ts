import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ObterDadosAgregadosUseCase } from '../../application/aggregated-data/obter-dados-agregados/obter-dados-agregados.use-case';
import { Perfis } from '../auth/decorators';
import { contexto, Requisicao } from '../comum/requisicao';
import { Operacao } from '../comum/swagger';

export class AggregatedDataQuery {
  @ApiProperty({ example: 'upa-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  unidadeId!: string;

  @ApiPropertyOptional({ example: 'pac-101' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  pacienteId?: string;
}

@ApiTags('Agregacao')
@ApiBearerAuth()
@Controller('aggregated-data')
export class AggregatedDataController {
  constructor(private readonly obter: ObterDadosAgregadosUseCase) {}

  @Get()
  @Perfis('ATENDENTE', 'PROFISSIONAL', 'GESTOR')
  @Operacao(
    'aggregatedData',
    'Endpoint obrigatório do PJBL — agrega MS Fila (SQL) + MS Prontuário (Mongo) + Function em um único JSON',
  )
  aggregatedData(@Query() q: AggregatedDataQuery, @Req() req: Requisicao) {
    return this.obter.executar(q, contexto(req));
  }
}
