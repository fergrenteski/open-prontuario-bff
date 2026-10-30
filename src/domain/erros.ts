/** Códigos de erro da CONVENCOES.md §4 que o próprio BFF produz. */
export type CodigoErro =
  | 'REQUISICAO_INVALIDA'
  | 'NAO_AUTENTICADO'
  | 'SEM_PERMISSAO'
  | 'RECURSO_NAO_ENCONTRADO'
  | 'DEPENDENCIA_INDISPONIVEL'
  | 'AGREGACAO_FALHOU';

export class ErroNegocio extends Error {
  constructor(
    readonly codigo: CodigoErro,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroNegocio';
  }
}
