// Contrato da camada de dados. O app só fala com o banco por aqui, então trocar
// o armazenamento local pelo Firebase é trocar a implementação, sem mexer nas telas.
//
//   obter(colecao, id)            -> documento ou null
//   listar(colecao, filtro?)      -> lista; filtro = { campo: valor } (igualdade)
//   salvar(colecao, id, dados)    -> grava o documento inteiro
//   atualizar(colecao, id, parte) -> mescla campos (cria se não existir)
//   remover(colecao, id)
//   lote(operacoes)               -> várias gravações juntas: [{ op: 'salvar'|'atualizar'|'remover', colecao, id, dados }]
//   observar(colecao, aoMudar)    -> avisa quando algo muda; devolve função para parar
//
// Todo documento guarda o próprio `id`.

export const OPERACOES = ['obter', 'listar', 'salvar', 'atualizar', 'remover', 'lote', 'observar'];

export function confere(repo) {
  for (const op of OPERACOES) if (typeof repo[op] !== 'function') throw new Error(`Repositório sem a operação ${op}`);
  return repo;
}

export const filtra = (docs, filtro) => !filtro ? docs
  : docs.filter(d => Object.entries(filtro).every(([k, v]) => d[k] === v));
