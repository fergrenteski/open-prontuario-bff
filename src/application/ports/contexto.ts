import { Usuario } from '../../domain/usuario';

/** Quem está chamando e o id de correlação — propagados como headers a jusante. */
export interface Contexto {
  usuario: Usuario;
  correlationId: string;
}
