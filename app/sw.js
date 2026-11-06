// Guarda o app no aparelho para abrir rápido e funcionar sem internet.
// Ao mudar arquivos do app, aumente a VERSAO para os aparelhos baixarem de novo.
const VERSAO = 'ogb-v1';
const ARQUIVOS = [
  './',
  './css/app.css',
  './css/documentos.css',
  './css/tokens.css',
  './icons/icone-192-maskable.png',
  './icons/icone-192.png',
  './icons/icone-512-maskable.png',
  './icons/icone-512.png',
  './icons/logo-ogb.png',
  './manifest.webmanifest',
  './modelos/modelo-usuarios.xlsx',
  './src/config.js',
  './src/dados/exemplo.js',
  './src/dados/firebase.js',
  './src/dados/memoria.js',
  './src/dados/repositorio.js',
  './src/documentos/boletim.js',
  './src/documentos/emitir.js',
  './src/documentos/modelos.js',
  './src/documentos/pagina.js',
  './src/documentos/texto.js',
  './src/modelo/esquema.js',
  './src/modelo/perfis.js',
  './src/regras/boletim.js',
  './src/regras/curriculo.js',
  './src/regras/simulados.js',
  './src/servicos/catraca.js',
  './src/servicos/importar-usuarios.js',
  './src/servicos/sistema.js',
  './src/servicos/texto.js',
  './src/ui/app.js',
  './src/ui/dom.js',
  './src/ui/telas/alunos.js',
  './src/ui/telas/boletins.js',
  './src/ui/telas/documentos.js',
  './src/ui/telas/escola.js',
  './src/ui/telas/frequencia.js',
  './src/ui/telas/historico.js',
  './src/ui/telas/inicio.js',
  './src/ui/telas/matricula.js',
  './src/ui/telas/notas.js',
  './src/ui/telas/simulados.js',
  './src/ui/telas/turmas.js',
  './src/ui/telas/usuarios.js',
  './vendor/xlsx.full.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Rede primeiro (para pegar a versão nova); sem internet, usa o que está guardado.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    const copia = r.clone();
    caches.open(VERSAO).then(c => c.put(e.request, copia));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
