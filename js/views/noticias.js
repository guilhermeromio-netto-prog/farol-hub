// Tela: Notícias (RSS) — Farol · byGui
import { todasNoticias, msgErro } from '../api.js';
import { esc, skCards, erroHTML, vazioHTML } from '../ui.js';
import { cardNoticia } from './comum.js';

export function render(ctx) {
  const { el, dados, signal } = ctx;
  ctx.titulo('Notícias de viagem');
  let filtro = 'todas';
  let itens = [], falhas = [];

  el.innerHTML = `
  <div class="shell">
    <p class="kicker">Notícias</p>
    <h1>O que está acontecendo no mundo das viagens</h1>
    <p class="lead">Manchetes recentes de ${dados.feeds.length} fontes em português, lidas direto dos feeds RSS. Toque para ler no site original.</p>
    <div class="chips" role="group" aria-label="Filtrar por fonte" id="filtros" style="margin-top:var(--sp-5)">
      <button type="button" class="chip" data-f="todas" aria-pressed="true">Todas</button>
      ${dados.feeds.map((f) => `<button type="button" class="chip" data-f="${esc(f.id)}" aria-pressed="false">${esc(f.nome)}</button>`).join('')}
    </div>
    <p class="faint" id="status-news" aria-live="polite" style="margin-top:var(--sp-3)"></p>
    <div id="lista-news" style="margin-top:var(--sp-3)">${skCards(6, 'noticias noticias--3')}</div>
    <p class="faint" style="margin-top:var(--sp-5)">Fontes: ${dados.feeds.map((f) => `<a href="${esc(f.site)}" target="_blank" rel="noopener noreferrer">${esc(f.nome)}</a>`).join(' · ')}. Conteúdo e direitos dos respectivos veículos. Leitura via rss2json.com quando o feed não permite acesso direto pelo navegador.</p>
  </div>`;

  const lista = el.querySelector('#lista-news');
  const status = el.querySelector('#status-news');

  const desenhar = () => {
    const vis = filtro === 'todas' ? itens : itens.filter((i) => i.feedId === filtro);
    const falhou = falhas.find((f) => f.feed.id === filtro);
    if (falhou) { lista.innerHTML = erroHTML(`${falhou.feed.nome}: ${falhou.erro}`); lista.querySelector('[data-acao="tentar"]')?.addEventListener('click', carregar); status.textContent = ''; return; }
    if (!vis.length) { lista.innerHTML = vazioHTML('Nenhuma notícia desta fonte agora.'); status.textContent = ''; return; }
    lista.innerHTML = `<div class="noticias noticias--3">${vis.slice(0, 30).map(cardNoticia).join('')}</div>`;
    status.textContent = `${vis.length} notícia${vis.length > 1 ? 's' : ''}` + (filtro === 'todas' && falhas.length ? ` · sem resposta agora: ${falhas.map((f) => f.feed.nome).join(', ')}` : '');
  };

  async function carregar() {
    lista.innerHTML = skCards(6, 'noticias noticias--3');
    status.textContent = 'Carregando notícias…';
    try {
      ({ itens, falhas } = await todasNoticias(dados.feeds, { signal }));
      if (signal.aborted) return;
      if (!itens.length) {
        lista.innerHTML = erroHTML('Nenhum feed de notícias respondeu agora. Pode ser instabilidade das fontes ou do conversor de RSS.');
        lista.querySelector('[data-acao="tentar"]')?.addEventListener('click', carregar);
        status.textContent = '';
        return;
      }
      desenhar();
    } catch (e) {
      if (e.status === -1) return;
      lista.innerHTML = erroHTML(msgErro(e));
      lista.querySelector('[data-acao="tentar"]')?.addEventListener('click', carregar);
    }
  }

  el.querySelector('#filtros').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-f]');
    if (!b) return;
    filtro = b.dataset.f;
    el.querySelectorAll('#filtros [data-f]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    if (itens.length || falhas.length) desenhar();
  });
  carregar();
}
