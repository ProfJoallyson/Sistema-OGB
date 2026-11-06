// Repositório em memória, com cópia opcional no navegador (localStorage).
// Usado enquanto o Firebase não existe e nos testes.

import { filtra } from './repositorio.js';

const copia = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export class RepositorioMemoria {
  // armazenamento = { carregar(): estado|null, gravar(estado) } (opcional)
  constructor(estadoInicial = {}, armazenamento = null) {
    this.armazenamento = armazenamento;
    const salvo = armazenamento && armazenamento.carregar();
    this.estado = copia(salvo || estadoInicial);
    this.ouvintes = {};
  }

  _col(c) { return (this.estado[c] ||= {}); }

  _gravou(colecoes) {
    if (this.armazenamento) this.armazenamento.gravar(this.estado);
    for (const c of new Set(colecoes)) for (const f of this.ouvintes[c] || []) f();
  }

  _aplicar({ op, colecao, id, dados }) {
    const col = this._col(colecao);
    if (op === 'salvar') col[id] = { ...copia(dados), id };
    else if (op === 'atualizar') col[id] = { ...(col[id] || {}), ...copia(dados), id };
    else if (op === 'remover') delete col[id];
    else throw new Error('Operação inválida: ' + op);
  }

  async obter(colecao, id) { return copia(this._col(colecao)[id] ?? null); }
  async listar(colecao, filtro) { return copia(filtra(Object.values(this._col(colecao)), filtro)); }
  async salvar(colecao, id, dados) { return this.lote([{ op: 'salvar', colecao, id, dados }]); }
  async atualizar(colecao, id, dados) { return this.lote([{ op: 'atualizar', colecao, id, dados }]); }
  async remover(colecao, id) { return this.lote([{ op: 'remover', colecao, id }]); }

  async lote(operacoes) {
    const antes = copia(this.estado);
    try { operacoes.forEach(o => this._aplicar(o)); } catch (e) { this.estado = antes; throw e; }
    this._gravou(operacoes.map(o => o.colecao));
  }

  observar(colecao, aoMudar) {
    (this.ouvintes[colecao] ||= []).push(aoMudar);
    return () => { this.ouvintes[colecao] = this.ouvintes[colecao].filter(f => f !== aoMudar); };
  }

  exportar() { return copia(this.estado); }
}

export function armazenamentoNavegador(chave = 'sistema-ogb') {
  return {
    carregar() { try { return JSON.parse(localStorage.getItem(chave)); } catch { return null; } },
    gravar(estado) { try { localStorage.setItem(chave, JSON.stringify(estado)); } catch { /* sem espaço ou bloqueado */ } },
    limpar() { try { localStorage.removeItem(chave); } catch { /* ignora */ } },
  };
}
