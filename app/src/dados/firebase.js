// Repositório no Firebase (Firestore) e login com Google.
// AINDA NÃO TESTADO: falta criar o projeto Firebase da escola. Quando existir,
// preencher app/src/config.js com a configuração e trocar `modo` para 'firebase'.
//
// As permissões valem também no servidor: ver app/firebase/firestore.rules.

const VERSAO = '10.12.2';
const URL = `https://www.gstatic.com/firebasejs/${VERSAO}`;

export async function iniciarFirebase(config) {
  const [{ initializeApp }, fs, auth] = await Promise.all([
    import(`${URL}/firebase-app.js`),
    import(`${URL}/firebase-firestore.js`),
    import(`${URL}/firebase-auth.js`),
  ]);
  const app = initializeApp(config);
  const db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() }); // funciona sem internet
  return { repo: new RepositorioFirestore(db, fs), login: loginGoogle(auth.getAuth(app), auth) };
}

export class RepositorioFirestore {
  constructor(db, fs) { this.db = db; this.fs = fs; }

  async obter(colecao, id) {
    const s = await this.fs.getDoc(this.fs.doc(this.db, colecao, id));
    return s.exists() ? { ...s.data(), id: s.id } : null;
  }

  async listar(colecao, filtro = {}) {
    const { collection, query, where, getDocs } = this.fs;
    const conds = Object.entries(filtro).map(([k, v]) => where(k, '==', v));
    const s = await getDocs(query(collection(this.db, colecao), ...conds));
    return s.docs.map(d => ({ ...d.data(), id: d.id }));
  }

  salvar(colecao, id, dados) { return this.lote([{ op: 'salvar', colecao, id, dados }]); }
  atualizar(colecao, id, dados) { return this.lote([{ op: 'atualizar', colecao, id, dados }]); }
  remover(colecao, id) { return this.lote([{ op: 'remover', colecao, id }]); }

  async lote(operacoes) {
    // O Firestore aceita até 500 gravações por lote.
    for (let i = 0; i < operacoes.length; i += 450) {
      const b = this.fs.writeBatch(this.db);
      for (const { op, colecao, id, dados } of operacoes.slice(i, i + 450)) {
        const ref = this.fs.doc(this.db, colecao, id);
        if (op === 'salvar') b.set(ref, { ...dados, id });
        else if (op === 'atualizar') b.set(ref, { ...dados, id }, { merge: true });
        else if (op === 'remover') b.delete(ref);
      }
      await b.commit();
    }
  }

  observar(colecao, aoMudar) {
    return this.fs.onSnapshot(this.fs.collection(this.db, colecao), () => aoMudar());
  }
}

function loginGoogle(auth, a) {
  return {
    async entrar(dominio) {
      const p = new a.GoogleAuthProvider();
      p.setCustomParameters({ hd: dominio, prompt: 'select_account' });
      const r = await a.signInWithPopup(auth, p);
      return r.user.email;
    },
    sair: () => a.signOut(auth),
    aoMudar: cb => a.onAuthStateChanged(auth, u => cb(u ? u.email : null)),
  };
}
