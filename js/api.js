// Camada de dados — todas as APIs públicas, sem chave. Farol · byGui
// Cada chamada: timeout, cache curto em sessionStorage, erros traduzidos para PT-BR.

export class ErroAPI extends Error {
  constructor(mensagem, { status = 0, vazio = false } = {}) {
    super(mensagem);
    this.mensagem = mensagem;
    this.status = status;
    this.vazio = vazio;
  }
}

const TTL_PADRAO = 10 * 60 * 1000; // 10 min

function lerCache(url) {
  try {
    const raw = sessionStorage.getItem('farol:cache:' + url);
    if (!raw) return null;
    const { t, ttl, d } = JSON.parse(raw);
    if (Date.now() - t > ttl) { sessionStorage.removeItem('farol:cache:' + url); return null; }
    return d;
  } catch { return null; }
}
function gravarCache(url, d, ttl) {
  try { sessionStorage.setItem('farol:cache:' + url, JSON.stringify({ t: Date.now(), ttl, d })); }
  catch {
    // sessionStorage cheio: limpa cache antigo e segue sem cachear
    try { Object.keys(sessionStorage).filter((k) => k.startsWith('farol:cache:')).forEach((k) => sessionStorage.removeItem(k)); } catch {}
  }
}

/**
 * Busca JSON (ou texto) com cache e mensagens amigáveis.
 * @param {string} url
 * @param {{fonte?:string, ttl?:number, signal?:AbortSignal, timeout?:number, texto?:boolean, metodo?:string, corpo?:string, semCache?:boolean, chave?:string}} op
 */
export async function buscar(url, op = {}) {
  const { fonte = 'o serviço', ttl = TTL_PADRAO, signal, timeout = 15000, texto = false, metodo = 'GET', corpo = null, semCache = false } = op;
  const chave = op.chave || url;
  if (!semCache) {
    const cache = lerCache(chave);
    if (cache !== null) return cache;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), timeout);
  const aoAbortar = () => ctrl.abort(signal.reason);
  if (signal) { if (signal.aborted) ctrl.abort(signal.reason); else signal.addEventListener('abort', aoAbortar, { once: true }); }

  let resp;
  try {
    const init = { signal: ctrl.signal, method: metodo, headers: texto ? {} : { Accept: 'application/json' } };
    if (corpo != null) { init.body = corpo; init.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'; }
    if (semCache) init.cache = 'no-store';
    resp = await fetch(url, init);
  } catch (e) {
    clearTimeout(timer);
    if (signal && signal.aborted) throw new ErroAPI('Operação cancelada.', { status: -1 });
    if (e && (e.name === 'TimeoutError' || (ctrl.signal.reason && ctrl.signal.reason.name === 'TimeoutError'))) {
      throw new ErroAPI(`${fonte} demorou demais para responder. Tente de novo em instantes.`, { status: -2 });
    }
    if (!navigator.onLine) throw new ErroAPI('Você parece estar sem internet. Confira a conexão e tente de novo.');
    throw new ErroAPI(`Não foi possível falar com ${fonte} agora. Tente de novo em instantes.`);
  } finally {
    if (signal) signal.removeEventListener('abort', aoAbortar);
  }
  clearTimeout(timer);

  if (resp.status === 204) throw new ErroAPI(`${fonte} não tem dados para este pedido.`, { status: 204, vazio: true });
  if (resp.status === 404) throw new ErroAPI(`${fonte} não encontrou informações para este pedido.`, { status: 404, vazio: true });
  if (resp.status === 429) {
    const ra = Number(resp.headers.get('Retry-After'));
    const e = new ErroAPI(`${fonte} recebeu pedidos demais e pediu uma pausa${ra ? ` de cerca de ${ra < 90 ? ra + ' segundos' : Math.ceil(ra / 60) + ' minutos'}` : ''}. Tente de novo depois.`, { status: 429 });
    e.retryAfter = ra || 60;
    throw e;
  }
  if (!resp.ok) throw new ErroAPI(`${fonte} está com instabilidade no momento (erro ${resp.status}). Tente de novo mais tarde.`, { status: resp.status });

  let dados;
  try { dados = texto ? await resp.text() : await resp.json(); }
  catch { throw new ErroAPI(`${fonte} devolveu uma resposta que não conseguimos ler.`); }
  if (!semCache) gravarCache(chave, dados, ttl);
  return dados;
}

/* Cache longo em localStorage (pontos turísticos, visualizações). */
const PREF_LC = 'farol:lc:';
export function lerCacheLocal(k) {
  try {
    const raw = localStorage.getItem(PREF_LC + k);
    if (!raw) return null;
    const { t, ttl, d } = JSON.parse(raw);
    if (Date.now() - t > ttl) { localStorage.removeItem(PREF_LC + k); return null; }
    return d;
  } catch { return null; }
}
export function gravarCacheLocal(k, d, ttl) {
  const v = JSON.stringify({ t: Date.now(), ttl, d });
  try { localStorage.setItem(PREF_LC + k, v); }
  catch {
    try { Object.keys(localStorage).filter((x) => x.startsWith(PREF_LC)).forEach((x) => localStorage.removeItem(x)); localStorage.setItem(PREF_LC + k, v); } catch {}
  }
}

export const msgErro = (e) => (e && e.mensagem) || 'Algo deu errado. Tente de novo.';

/* ---------------- dados.json ---------------- */
let _dados = null;
export async function dados() {
  if (_dados) return _dados;
  const r = await fetch('dados.json', { cache: 'no-cache' }).catch(() => null);
  if (!r || !r.ok) throw new ErroAPI('Não foi possível carregar os dados do Farol. Recarregue a página.');
  _dados = await r.json();
  return _dados;
}

/* ---------------- Open-Meteo ---------------- */
export async function geocodificar(nome, { count = 6, signal } = {}) {
  const u = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nome)}&count=${count}&language=pt&format=json`;
  const d = await buscar(u, { fonte: 'O serviço de busca de lugares', ttl: 60 * 60 * 1000, signal });
  return (d.results || []).map((r) => ({
    nome: r.name,
    lat: r.latitude,
    lon: r.longitude,
    pais: r.country || '',
    cc: (r.country_code || '').toUpperCase(),
    regiao: r.admin1 || '',
    fuso: r.timezone || '',
    populacao: r.population || 0,
  }));
}

const r4 = (n) => Math.round(Number(n) * 1e4) / 1e4;

export function previsao(lat, lon, { dias = 16, signal } = {}) {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${r4(lat)}&longitude=${r4(lon)}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day,precipitation' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max' +
    `&forecast_days=${dias}&timezone=auto`;
  return buscar(u, { fonte: 'O serviço de previsão do tempo', ttl: 15 * 60 * 1000, signal });
}

export function qualidadeAr(lat, lon, { signal } = {}) {
  const u = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${r4(lat)}&longitude=${r4(lon)}&current=european_aqi,us_aqi,pm2_5,pm10,uv_index&timezone=auto`;
  return buscar(u, { fonte: 'O serviço de qualidade do ar', ttl: 30 * 60 * 1000, signal });
}

/** Clima registrado no último ano completo (arquivo histórico Open-Meteo). */
export function climaAnoPassado(lat, lon, { signal } = {}) {
  const ano = new Date().getFullYear() - 1;
  const u = `https://archive-api.open-meteo.com/v1/archive?latitude=${r4(lat)}&longitude=${r4(lon)}&start_date=${ano}-01-01&end_date=${ano}-12-31` +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto';
  return buscar(u, { fonte: 'O arquivo histórico de clima', ttl: 6 * 60 * 60 * 1000, signal, timeout: 25000 }).then((d) => ({ ...d, ano }));
}

/* ---------------- Reverse geocoding (BigDataCloud, cliente) ---------------- */
export async function lugarPorCoordenada(lat, lon, { signal } = {}) {
  const u = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${r4(lat)}&longitude=${r4(lon)}&localityLanguage=pt`;
  const d = await buscar(u, { fonte: 'O serviço de localização', ttl: 24 * 60 * 60 * 1000, signal });
  return { nome: d.city || d.locality || d.principalSubdivision || '', regiao: d.principalSubdivision || '', cc: (d.countryCode || '').toUpperCase(), pais: d.countryName || '' };
}

/* ---------------- Câmbio (Frankfurter / BCE) ---------------- */
const FRANK = 'https://api.frankfurter.dev/v1';
export async function moedasSuportadas({ signal } = {}) {
  return buscar(`${FRANK}/currencies`, { fonte: 'O serviço de câmbio', ttl: 24 * 60 * 60 * 1000, signal });
}
export async function cotacaoBRL(moeda, { signal } = {}) {
  const lista = await moedasSuportadas({ signal });
  if (!lista[moeda]) throw new ErroAPI('sem-suporte', { vazio: true });
  const d = await buscar(`${FRANK}/latest?from=${moeda}&to=BRL`, { fonte: 'O serviço de câmbio', ttl: 60 * 60 * 1000, signal });
  if (!d.rates || !d.rates.BRL) throw new ErroAPI('O serviço de câmbio não trouxe a cotação em reais.');
  return { taxa: d.rates.BRL, data: d.date };
}

/* ---------------- Feriados (Nager.Date) ---------------- */
export async function feriados(cc, ano, { signal } = {}) {
  try {
    return await buscar(`https://date.nager.at/api/v3/PublicHolidays/${ano}/${cc}`, { fonte: 'O serviço de feriados', ttl: 24 * 60 * 60 * 1000, signal });
  } catch (e) {
    if (e.vazio) return null; // país não coberto
    throw e;
  }
}
export async function proximosFeriados(cc, meses = 6, { signal } = {}) {
  const hoje = new Date();
  const fim = new Date(hoje); fim.setMonth(fim.getMonth() + meses);
  const anos = [...new Set([hoje.getFullYear(), fim.getFullYear()])];
  const listas = await Promise.all(anos.map((a) => feriados(cc, a, { signal })));
  if (listas.every((l) => l === null)) return null;
  const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hojeIso = isoLocal(hoje), fimIso = isoLocal(fim);
  const vistos = new Set();
  return listas.flat().filter(Boolean)
    .filter((f) => f.date >= hojeIso && f.date <= fimIso && f.global !== false)
    .filter((f) => (vistos.has(f.date + f.localName) ? false : vistos.add(f.date + f.localName)));
}

/* ---------------- Wikipédia PT ---------------- */
export async function wikiResumo(titulo, { signal } = {}) {
  const pegar = (t) => buscar(`https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, '_'))}`, { fonte: 'A Wikipédia', ttl: 24 * 60 * 60 * 1000, signal });
  try {
    const d = await pegar(titulo);
    if (d.type === 'disambiguation') throw new ErroAPI('desambiguacao', { vazio: true });
    return d;
  } catch (e) {
    if (!e.vazio) throw e;
    const s = await buscar(`https://pt.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(titulo)}&limit=3`, { fonte: 'A Wikipédia', ttl: 24 * 60 * 60 * 1000, signal });
    const p = (s.pages || [])[0];
    if (!p) throw new ErroAPI('A Wikipédia não tem um artigo para este lugar.', { vazio: true });
    return pegar(p.key);
  }
}

/* ---------------- Notícias (RSS) ---------------- */
function itensDeXML(xml, feed) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) throw new ErroAPI(`O feed ${feed.nome} veio em formato inválido.`);
  return [...doc.querySelectorAll('item')].slice(0, 12).map((it) => {
    const t = (sel) => (it.querySelector(sel)?.textContent || '').trim();
    const media = it.getElementsByTagName('media:content')[0] || it.getElementsByTagName('media:thumbnail')[0] || it.querySelector('enclosure[type^="image"]');
    return { titulo: t('title'), link: t('link'), data: t('pubDate'), resumo: t('description'), imagem: media ? media.getAttribute('url') : '', fonte: feed.nome, feedId: feed.id };
  });
}

export async function noticiasDoFeed(feed, { signal } = {}) {
  // 1) Feeds com CORS aberto: lê o XML direto.
  if (feed.cors) {
    try {
      const xml = await buscar(feed.url, { fonte: feed.nome, ttl: 20 * 60 * 1000, signal, texto: true });
      const itens = itensDeXML(xml, feed);
      if (itens.length) return itens;
    } catch (e) { if (e.status === -1) throw e; /* cai para o conversor */ }
  }
  // 2) Conversor público rss2json (envia Access-Control-Allow-Origin: *).
  const u = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
  const d = await buscar(u, { fonte: `O feed ${feed.nome}`, ttl: 20 * 60 * 1000, signal });
  if (d.status !== 'ok' || !Array.isArray(d.items)) throw new ErroAPI(`O feed ${feed.nome} não respondeu corretamente agora.`);
  return d.items.map((i) => ({
    titulo: i.title, link: i.link,
    data: i.pubDate ? i.pubDate.replace(' ', 'T') + 'Z' : '',
    resumo: i.description || i.content || '',
    imagem: i.thumbnail || (i.enclosure && i.enclosure.link && /image/.test(i.enclosure.type || '') ? i.enclosure.link : ''),
    fonte: feed.nome, feedId: feed.id,
  }));
}

/** Busca todos os feeds em paralelo; devolve itens ordenados e a lista de falhas. */
export async function todasNoticias(feeds, { signal } = {}) {
  const res = await Promise.allSettled(feeds.map((f) => noticiasDoFeed(f, { signal })));
  const itens = [], falhas = [];
  res.forEach((r, i) => (r.status === 'fulfilled' ? itens.push(...r.value) : falhas.push({ feed: feeds[i], erro: msgErro(r.reason) })));
  const ts = (x) => { const t = Date.parse(x.data); return isNaN(t) ? 0 : t; };
  itens.sort((a, b) => ts(b) - ts(a));
  return { itens, falhas };
}

/* ---------------- Fotos da Wikipédia (lote, até 50 títulos) ---------------- */
/** Devolve { tituloOriginal: {src, largura, altura, titulo} } para os títulos pedidos. */
export async function fotosWiki(titulos, { tamanho = 480, signal } = {}) {
  const lista = [...new Set(titulos.filter(Boolean))].slice(0, 50);
  if (!lista.length) return {};
  const u = 'https://pt.wikipedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: String(tamanho), pilimit: '50',
    titles: lista.join('|'), redirects: '1', format: 'json', formatversion: '2', origin: '*',
  });
  const d = await buscar(u, { fonte: 'A Wikipédia', ttl: 24 * 60 * 60 * 1000, signal });
  const q = d.query || {};
  const mapa = {};
  const volta = {}; // título final → original
  const norm = (t) => t.replace(/_/g, ' ');
  lista.forEach((t) => { volta[norm(t)] = t; });
  (q.normalized || []).forEach((n) => { if (volta[n.from] !== undefined || lista.includes(n.from)) volta[n.to] = volta[n.from] || n.from; });
  (q.redirects || []).forEach((r) => { volta[r.to] = volta[r.from] || r.from; });
  (q.pages || []).forEach((p) => {
    if (!p.thumbnail) return;
    const orig = volta[p.title] || p.title;
    mapa[orig] = { src: p.thumbnail.source, largura: p.thumbnail.width, altura: p.thumbnail.height, titulo: p.title };
  });
  return mapa;
}

/* ---------------- Pontos turísticos (OpenStreetMap / Overpass) ---------------- */
export const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

function consultaOverpass(lat, lon, raio) {
  const a = `(around:${raio},${lat},${lon})`;
  const aN = `(around:${Math.round(raio * 1.6)},${lat},${lon})`;
  return `[out:json][timeout:25];(
nwr["tourism"~"^(attraction|museum|viewpoint|theme_park|zoo)$"]["name"]${a};
nwr["historic"]["name"]["wikipedia"]${a};
nwr["historic"~"^(monument|castle|ruins|archaeological_site|fort)$"]["name"]${a};
nwr["natural"~"^(beach|waterfall|peak)$"]["name"]${aN};
nwr["leisure"="park"]["name"]["wikidata"]${a};
);out center tags qt 300;`;
}

/** Lista de pontos turísticos reais perto de (lat, lon). Tenta o servidor principal e, se falhar, o de reserva. */
export async function pontosTuristicos(lat, lon, raio, { signal, onTentativa = () => {} } = {}) {
  const la = Math.round(lat * 1000) / 1000, lo = Math.round(lon * 1000) / 1000;
  const chave = `osm:${la},${lo},${raio}`;
  const cache = lerCacheLocal(chave);
  if (cache) return { ...cache, doCache: true };
  const corpo = 'data=' + encodeURIComponent(consultaOverpass(la, lo, raio));
  let ultimoErro = null;
  for (let i = 0; i < OVERPASS.length; i++) {
    onTentativa(i);
    try {
      const d = await buscar(OVERPASS[i], { fonte: i ? 'O servidor reserva do OpenStreetMap' : 'O OpenStreetMap (Overpass)', metodo: 'POST', corpo, semCache: true, timeout: 32000, signal });
      if (!d || !Array.isArray(d.elements)) throw new ErroAPI('O OpenStreetMap devolveu uma resposta inesperada.');
      if (d.remark && /timed out|runtime error/i.test(d.remark) && !d.elements.length) throw new ErroAPI('O OpenStreetMap não terminou a consulta a tempo.');
      const r = { elementos: d.elements, servidor: i, quando: new Date().toISOString() };
      gravarCacheLocal(chave, r, 7 * 24 * 60 * 60 * 1000);
      return r;
    } catch (e) {
      if (e.status === -1) throw e;
      ultimoErro = e;
    }
  }
  throw new ErroAPI(`Os dois servidores do OpenStreetMap falharam (${msgErro(ultimoErro)}) Tente de novo em alguns minutos.`, { status: ultimoErro ? ultimoErro.status : 0 });
}

/* ---------------- Visualizações na Wikipédia (Wikimedia Pageviews) ---------------- */
const isoDia = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

/** Visualizações diárias (usuários, todos os acessos) dos últimos 60 dias completos de um artigo. */
export async function visualizacoes(titulo, { signal } = {}) {
  const fim = new Date(); fim.setUTCDate(fim.getUTCDate() - 1);
  const ini = new Date(fim); ini.setUTCDate(ini.getUTCDate() - 59);
  const chave = `pv:${titulo}:${isoDia(fim)}`;
  const cache = lerCacheLocal(chave);
  if (cache) return cache;
  const u = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/pt.wikipedia/all-access/user/${encodeURIComponent(titulo.replace(/ /g, '_'))}/daily/${isoDia(ini)}/${isoDia(fim)}`;
  const d = await buscar(u, { fonte: 'A Wikimedia', semCache: true, timeout: 12000, signal });
  const itens = (d.items || []).map((x) => x.views || 0);
  gravarCacheLocal(chave, itens, 12 * 60 * 60 * 1000);
  return itens;
}

/**
 * Ranking "Em alta": crescimento dos últimos 30 dias contra os 30 anteriores.
 * Busca em sequência, com pausa curta, e para ao receber 429 (devolve o que já tem).
 */
export async function emAlta(destaques, { signal, onProgresso = () => {} } = {}) {
  const res = [];
  let limitado = null, falhas = 0;
  for (let i = 0; i < destaques.length; i++) {
    const d = destaques[i];
    try {
      const v = await visualizacoes(d.wiki, { signal });
      if (v.length >= 40) {
        const meio = v.length - 30;
        const ult = v.slice(meio).reduce((a, b) => a + b, 0);
        const ant = v.slice(Math.max(0, meio - 30), meio).reduce((a, b) => a + b, 0);
        res.push({ destaque: d, ultimos: ult, anteriores: ant, variacao: ant ? (ult - ant) / ant : 0 });
      }
    } catch (e) {
      if (e.status === -1) throw e;
      if (e.status === 429) { limitado = e; break; }
      falhas++;
    }
    onProgresso(i + 1, destaques.length);
    if (i < destaques.length - 1 && !lerCacheLocal(`pv:${destaques[i + 1].wiki}:${isoDia(new Date(Date.now() - 864e5))}`)) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  res.sort((a, b) => b.variacao - a.variacao);
  return { lista: res, limitado, falhas, total: destaques.length };
}

/* ---------------- GitHub Actions (verificação automática) ---------------- */
export async function ultimaVerificacao({ signal } = {}) {
  const u = 'https://api.github.com/repos/guilhermeromio-netto-prog/farol-hub/actions/workflows/checks.yml/runs?per_page=1';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  let r;
  try { r = await fetch(u, { signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json' } }); }
  catch { clearTimeout(t); if (signal && signal.aborted) throw new ErroAPI('Operação cancelada.', { status: -1 }); throw new ErroAPI('Não foi possível falar com o GitHub agora.'); }
  clearTimeout(t);
  const resta = r.headers.get('x-ratelimit-remaining');
  if (r.status === 403 || r.status === 429) {
    const reset = Number(r.headers.get('x-ratelimit-reset'));
    const quando = reset ? new Date(reset * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    throw new ErroAPI(`O GitHub limitou consultas sem login deste endereço${quando ? ` até ${quando}` : ''}. Veja direto na página do GitHub.`, { status: r.status });
  }
  if (!r.ok) throw new ErroAPI(`O GitHub respondeu com erro ${r.status}.`, { status: r.status });
  const d = await r.json();
  return { run: (d.workflow_runs || [])[0] || null, restante: resta };
}
