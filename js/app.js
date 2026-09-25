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
import * as gastos from './views/gastos.js';
import * as status from './views/status.js';
import { lerTema, gravarTema } from './store.js';

const ROTAS = [
  { re: /^\/?$/, view: inicio, nav: 'inicio' },
  { re: /^\/destino\/([^/]+)$/, view: destino, nav: 'inicio' },
  { re: /^\/planejar$/, view: planejar, nav: 'planejar' },
  { re: /^\/caderno\/([^/]+)$/, view: caderno, nav: 'cadernos' },
  { re: /^\/precos$/, view: precos, nav: 'precos' },
  { re: /^\/cadernos$/, view: cadernos, nav: 'cadernos' },
  { re: /^\/noticias$/, view: noticias, nav: 'noticias' },
  { re: /^\/gastos$/, view: gastos, nav: 'gastos' },
  { re: /^\/gastos\/([^/]+)$/, view: gastos, nav: 'gastos' },
  { re: /^\/status$/, view: status, nav: 'status' },
];
const NO_MAIS = new Set(['precos', 'noticias', 'status']);

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
  fecharMais(false);
  btnMais.classList.toggle('is-atual', !!(rota && NO_MAIS.has(rota.nav)));

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
    const vt = document.startViewTransition(trocar);
    vt.ready.catch(() => {}); vt.finished.catch(() => {});
    await vt.updateCallbackDone.catch(() => {});
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

/* ---------- tema claro/escuro ---------- */
const btnTema = document.getElementById('btn-tema');
function aplicarTema(t) {
  const claro = t === 'claro';
  if (claro) document.documentElement.dataset.tema = 'claro'; else delete document.documentElement.dataset.tema;
  document.querySelector('meta[name="theme-color"]').content = claro ? '#F4F6FB' : '#070B14';
  btnTema.setAttribute('aria-pressed', String(claro));
  btnTema.setAttribute('aria-label', claro ? 'Usar tema escuro' : 'Usar tema claro');
  btnTema.title = claro ? 'Tema escuro' : 'Tema claro';
  btnTema.querySelector('use').setAttribute('href', claro ? '#i-lua' : '#i-sol');
}
aplicarTema(lerTema());
btnTema.addEventListener('click', () => {
  const novo = document.documentElement.dataset.tema === 'claro' ? 'escuro' : 'claro';
  gravarTema(novo); aplicarTema(novo);
  toast(novo === 'claro' ? 'Tema claro ativado.' : 'Tema escuro ativado.', 'info', 2200);
});
document.addEventListener('farol:tema', (ev) => aplicarTema(ev.detail));

/* ---------- menu "Mais" (celular) ---------- */
const btnMais = document.getElementById('btn-mais');
const menuMais = document.getElementById('menu-mais');
function fecharMais(devolverFoco = true) {
  if (menuMais.hidden) return;
  menuMais.hidden = true;
  btnMais.setAttribute('aria-expanded', 'false');
  if (devolverFoco) btnMais.focus();
}
btnMais.addEventListener('click', () => {
  const abrir = menuMais.hidden;
  menuMais.hidden = !abrir;
  btnMais.setAttribute('aria-expanded', String(abrir));
  if (abrir) menuMais.querySelector('a').focus();
});
menuMais.addEventListener('keydown', (ev) => {
  const links = [...menuMais.querySelectorAll('a')];
  const i = links.indexOf(document.activeElement);
  if (ev.key === 'Escape') { ev.preventDefault(); fecharMais(); }
  if (ev.key === 'ArrowDown') { ev.preventDefault(); links[(i + 1) % links.length].focus(); }
  if (ev.key === 'ArrowUp') { ev.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
});
document.addEventListener('click', (ev) => {
  if (!menuMais.hidden && !menuMais.contains(ev.target) && !btnMais.contains(ev.target)) fecharMais(false);
});
menuMais.addEventListener('focusout', (ev) => {
  if (ev.relatedTarget && !menuMais.contains(ev.relatedTarget) && ev.relatedTarget !== btnMais) fecharMais(false);
});

window.addEventListener('hashchange', navegar);
window.addEventListener('offline', () => toast('Você ficou sem internet. Dados ao vivo podem falhar.', 'erro'));
navegar();
