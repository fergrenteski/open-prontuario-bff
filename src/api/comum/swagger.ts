import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam } from '@nestjs/swagger';

/** `operationId` igual ao contrato + parâmetros de caminho. */
export const Operacao = (operationId: string, summary?: string, ...params: string[]) =>
  applyDecorators(ApiOperation({ operationId, summary }), ...params.map((name) => ApiParam({ name, type: String })));

/** Corpo repassado sem alteração ao serviço (schema no contrato do serviço). */
export const CorpoRepassado = () =>
  ApiBody({ description: 'Repassado sem alteração ao serviço de destino', schema: { type: 'object' } });
