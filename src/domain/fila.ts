/** Registro da fila como devolvido pelo MS Fila, acrescido de `prontuarioAutorizado` pelo BFF. */
export interface RegistroFila {
  id: string;
  pacienteId: string;
  unidadeId: string;
  prioridade: string;
  status: string;
  sintomas: string[];
  horarioAviso: string;
  prontuarioAutorizado?: boolean | null;
  [campo: string]: unknown;
}

/**
 * Marca em cada registro se o paciente tem consentimento válido para a unidade.
 * `pacientesAutorizados = null` significa que a informação não pôde ser obtida → `null` (desconhecido).
 */
export function marcarProntuarioAutorizado(
  fila: RegistroFila[],
  pacientesAutorizados: readonly string[] | null,
): RegistroFila[] {
  const autorizados = pacientesAutorizados ? new Set(pacientesAutorizados) : null;
  return fila.map((r) => ({ ...r, prontuarioAutorizado: autorizados ? autorizados.has(r.pacienteId) : null }));
}
