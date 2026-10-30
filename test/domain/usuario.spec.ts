import { buscarPersona, ehPerfil, PERSONAS, possuiAlgumPerfil } from '../../src/domain/usuario';

describe('Usuario / personas', () => {
  it('tem exatamente as personas da CONVENCOES §8', () => {
    expect(PERSONAS.map((p) => [p.id, p.nome, p.roles.join()])).toEqual([
      ['pac-101', 'João Pereira', 'PACIENTE'],
      ['pac-102', 'Maria Souza', 'PACIENTE'],
      ['usr-atendente-07', 'Carla Mendes', 'ATENDENTE'],
      ['usr-prof-03', 'Dr. Paulo Lima', 'PROFISSIONAL'],
      ['usr-gestor-01', 'Lúcia Andrade', 'GESTOR'],
    ]);
  });

  it('busca persona por id', () => {
    expect(buscarPersona('usr-prof-03')?.nome).toBe('Dr. Paulo Lima');
    expect(buscarPersona('inexistente')).toBeUndefined();
  });

  it('reconhece perfis válidos', () => {
    expect(ehPerfil('GESTOR')).toBe(true);
    expect(ehPerfil('ADMIN')).toBe(false);
    expect(ehPerfil(1)).toBe(false);
  });

  it('verifica se o usuário possui algum dos perfis exigidos', () => {
    const u = { id: 'x', nome: 'X', roles: ['ATENDENTE' as const] };
    expect(possuiAlgumPerfil(u, ['ATENDENTE', 'GESTOR'])).toBe(true);
    expect(possuiAlgumPerfil(u, ['PACIENTE'])).toBe(false);
    expect(possuiAlgumPerfil(u, [])).toBe(true);
  });
});
