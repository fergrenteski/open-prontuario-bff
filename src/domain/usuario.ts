export const PERFIS = ['PACIENTE', 'ATENDENTE', 'PROFISSIONAL', 'GESTOR'] as const;
export type Perfil = (typeof PERFIS)[number];

/** Usuário autenticado (claims `oid`, `name`, `roles` do JWT). */
export interface Usuario {
  id: string;
  nome: string;
  roles: Perfil[];
}

export function ehPerfil(valor: unknown): valor is Perfil {
  return typeof valor === 'string' && (PERFIS as readonly string[]).includes(valor);
}

export function possuiAlgumPerfil(usuario: Usuario, exigidos: readonly Perfil[]): boolean {
  return exigidos.length === 0 || usuario.roles.some((r) => exigidos.includes(r));
}

/** Personas do modo dev — idênticas à CONVENCOES.md §8 (seed compartilhado entre os repos). */
export const PERSONAS: readonly Usuario[] = [
  { id: 'pac-101', nome: 'João Pereira', roles: ['PACIENTE'] },
  { id: 'pac-102', nome: 'Maria Souza', roles: ['PACIENTE'] },
  { id: 'usr-atendente-07', nome: 'Carla Mendes', roles: ['ATENDENTE'] },
  { id: 'usr-prof-03', nome: 'Dr. Paulo Lima', roles: ['PROFISSIONAL'] },
  { id: 'usr-gestor-01', nome: 'Lúcia Andrade', roles: ['GESTOR'] },
];

export function buscarPersona(usuarioId: string): Usuario | undefined {
  return PERSONAS.find((p) => p.id === usuarioId);
}
