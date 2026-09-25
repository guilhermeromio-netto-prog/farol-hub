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
 * Busca JSON com cache e mensagens amigáveis.
 * @param {string} url
 * @param {{fonte?:string, ttl?:number, signal?:AbortSignal, timeout?:number, texto?:boolean}} op
 */
export async function buscar(url, op = {}) {
  const { fonte = 'o serviço', ttl = TTL_PADRAO, signal, timeout = 15000, texto = false } = op;
  const cache = lerCache(url);
  if (cache !== null) return cache;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), timeout);
  const aoAbortar = () => ctrl.abort(signal.reason);
  if (signal) { if (signal.aborted) ctrl.abort(signal.reason); else signal.addEventListener('abort', aoAbortar, { once: true }); }

  let resp;
  try {
    resp = await fetch(url, { signal: ctrl.signal, headers: texto ? {} : { Accept: 'application/json' } });
  } catch (e) {
    clearTimeout(timer);
    if (signal && signal.aborted) throw new ErroAPI('Operação cancelada.', { status: -1 });
    if (e && (e.name === 'TimeoutError' || (ctrl.signal.reason && ctrl.signal.reason.name === 'TimeoutError'))) {
      throw new ErroAPI(`${fonte} demorou demais para responder. Tente de novo em instantes.`);
    }
    if (!navigator.onLine) throw new ErroAPI('Você parece estar sem internet. Confira a conexão e tente de novo.');
    throw new ErroAPI(`Não foi possível falar com ${fonte} agora. Tente de novo em instantes.`);
  } finally {
    if (signal) signal.removeEventListener('abort', aoAbortar);
  }
  clearTimeout(timer);

  if (resp.status === 204) throw new ErroAPI(`${fonte} não tem dados para este pedido.`, { status: 204, vazio: true });
  if (resp.status === 404) throw new ErroAPI(`${fonte} não encontrou informações para este pedido.`, { status: 404, vazio: true });
  if (resp.status === 429) throw new ErroAPI(`${fonte} recebeu pedidos demais. Espere um minuto e tente de novo.`, { status: 429 });
  if (!resp.ok) throw new ErroAPI(`${fonte} está com instabilidade no momento. Tente de novo mais tarde.`, { status: resp.status });

  let dados;
  try { dados = texto ? await resp.text() : await resp.json(); }
  catch { throw new ErroAPI(`${fonte} devolveu uma resposta que não conseguimos ler.`); }
  gravarCache(url, dados, ttl);
  return dados;
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
  const hojeIso = hoje.toISOString().slice(0, 10), fimIso = fim.toISOString().slice(0, 10);
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
