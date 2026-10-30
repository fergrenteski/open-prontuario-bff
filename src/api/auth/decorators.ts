import { SetMetadata } from '@nestjs/common';
import { Perfil } from '../../domain/usuario';

export const PUBLICO = 'publico';
export const PERFIS = 'perfis';

/** Rota sem autenticação (`security: []` no contrato). */
export const Publico = () => SetMetadata(PUBLICO, true);

/** Perfis aceitos — espelha a extensão `x-roles` do contrato. */
export const Perfis = (...perfis: Perfil[]) => SetMetadata(PERFIS, perfis);
