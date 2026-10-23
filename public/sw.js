// Service worker do app do boletim (PWA de cada igreja).
// Objetivo: abrir a última versão baixada do boletim quando não houver internet.
// Rede sempre em primeiro lugar; o cache só entra quando a rede falha.

const VERSAO = 'oikos-v1';
const CACHE_ESTATICO = `${VERSAO}-estatico`;
const CACHE_PAGINAS = `${VERSAO}-paginas`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((nome) => !nome.startsWith(VERSAO)).map((nome) => caches.delete(nome)));
      await self.clients.claim();
    })()
  );
});

// Arquivos de /_next/static têm hash no nome e nunca mudam: cache primeiro.
async function cachePrimeiro(request) {
  const cache = await caches.open(CACHE_ESTATICO);
  const salva = await cache.match(request);
  if (salva) return salva;

  const resposta = await fetch(request);
  if (resposta.ok) cache.put(request, resposta.clone());
  return resposta;
}

async function redePrimeiro(request) {
  const cache = await caches.open(CACHE_PAGINAS);

  try {
    const resposta = await fetch(request);
    // Resposta redirecionada não pode ser reaproveitada numa navegação.
    if (resposta.ok && !resposta.redirected) cache.put(request, resposta.clone());
    return resposta;
  } catch (erro) {
    const salva = await cache.match(request);
    if (salva) return salva;
    throw erro;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cachePrimeiro(request));
    return;
  }

  // Dados do boletim: só a versão pública. A versão de quem está logado tem
  // conteúdo interno e não deve ficar guardada no aparelho.
  if (url.pathname === '/api/boletins-home' && !url.searchParams.has('sessao')) {
    event.respondWith(redePrimeiro(request));
    return;
  }

  // A página do boletim procura a igreja pelo slug antes de tudo; as letras
  // de cânticos já abertas também ficam disponíveis sem internet.
  if (url.pathname.startsWith('/api/igrejas/slug/') || url.pathname === '/api/canticos-publicos') {
    event.respondWith(redePrimeiro(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(redePrimeiro(request));
  }
});
