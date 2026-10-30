import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Publico } from '../auth/decorators';
import { Operacao } from '../comum/swagger';

@ApiTags('Auth')
@Controller('health')
export class HealthController {
  @Get()
  @Publico()
  @Operacao('health')
  health() {
    return { status: 'UP' };
  }
}
