// Farol — hub de viagem. Roteador SPA por hash. Feito por byGui.
import { dados } from './api.js';
import { esc, prefereMenosMovimento, toast } from './ui.js';
import * as inicio from './views/inicio.js';
import * as destino from './views/destino.js';
import * as planejar from './views/planejar.js';
import * as caderno from './views/caderno.js';
import * as precos from './views/precos.js';
import * as cadernos from './views/cadernos.js';
import * as noticias from './views/noticias.js';

const ROTAS = [
  { re: /^\/?$/, view: inicio, nav: 'inicio' },
  { re: /^\/destino\/([^/]+)$/, view: destino, nav: 'inicio' },
  { re: /^\/planejar$/, view: planejar, nav: 'planejar' },
  { re: /^\/caderno\/([^/]+)$/, view: caderno, nav: 'cadernos' },
  { re: /^\/precos$/, view: precos, nav: 'precos' },
  { re: /^\/cadernos$/, view: cadernos, nav: 'cadernos' },
  { re: /^\/noticias$/, view: noticias, nav: 'noticias' },
];

const vista = document.getElementById('vista');
let ctrlAtual = null;
let primeira = true;

function lerHash() {
  const h = decodeURI(location.hash.replace(/^#/, '')) || '/';
  const [caminho, qs = ''] = h.split('?');
  return { caminho: caminho || '/', query: new URLSearchParams(qs) };
}

function naoEncontrado(ctx) {
  ctx.titulo('Página não encontrada');
  ctx.el.innerHTML = `<section class="shell"><p class="kicker">Erro 404</p><h1 tabindex="-1">Essa rota não existe.</h1><p class="lead">O endereço pode estar incompleto. Volte ao início ou comece um novo planejamento.</p><div class="acoes"><a class="btn btn--primario" href="#/">Ir para o início</a><a class="btn btn--fantasma" href="#/planejar">Planejar viagem</a></div></section>`;
}

async function navegar() {
  const { caminho, query } = lerHash();
  let rota = null, params = [];
  for (const r of ROTAS) {
    const m = caminho.match(r.re);
    if (m) { rota = r; params = m.slice(1).map((p) => decodeURIComponent(p)); break; }
  }
  if (ctrlAtual) ctrlAtual.abort();
  ctrlAtual = new AbortController();
  const signal = ctrlAtual.signal;

  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (rota && a.dataset.nav === rota.nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  let base;
  try { base = await dados(); }
  catch (e) {
    vista.innerHTML = `<section class="shell"><div class="erro" role="alert"><strong>Não deu para abrir o Farol</strong>${esc(e.mensagem || 'Recarregue a página.')}</div></section>`;
    return;
  }

  const ctx = {
    el: vista, params, query, signal, dados: base,
    titulo: (t) => { document.title = t ? `${t} · Farol` : 'Farol — hub de viagem'; },
  };

  const trocar = () => {
    vista.setAttribute('aria-busy', 'true');
    try { (rota ? rota.view.render : naoEncontrado)(ctx); }
    catch (e) {
      console.error(e);
      vista.innerHTML = `<section class="shell"><div class="erro" role="alert"><strong>Algo deu errado nesta tela</strong>Tente recarregar a página.</div></section>`;
    }
    vista.setAttribute('aria-busy', 'false');
  };

  const podeTransicao = !primeira && document.startViewTransition && !prefereMenosMovimento();
  if (podeTransicao) {
    await document.startViewTransition(trocar).updateCallbackDone.catch(() => {});
  } else {
    trocar();
    if (!primeira && !prefereMenosMovimento()) {
      vista.classList.remove('fade-in'); void vista.offsetWidth; vista.classList.add('fade-in');
    }
  }

  if (!primeira) {
    window.scrollTo(0, 0);
    const h1 = vista.querySelector('h1');
    if (h1) { if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
  }
  primeira = false;
}

window.addEventListener('hashchange', navegar);
window.addEventListener('offline', () => toast('Você ficou sem internet. Dados ao vivo podem falhar.', 'erro'));
navegar();
