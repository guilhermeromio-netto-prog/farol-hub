// Tela: Início — Farol · byGui
import { geocodificar, todasNoticias, msgErro } from '../api.js';
import { esc, icone, bandeira, skCards, erroHTML, vazioHTML } from '../ui.js';
import { listarCadernos } from '../store.js';
import { hrefDestino, cardDestaque, cardNoticia } from './comum.js';

export function render(ctx) {
  const { el, dados, signal } = ctx;
  ctx.titulo('');
  const qtd = listarCadernos().length;
  el.innerHTML = `
  <div class="shell">
    <section class="hero" aria-labelledby="titulo-inicio">
      <p class="kicker">Seu hub de viagem</p>
      <h1 id="titulo-inicio">Para onde o farol aponta <em>agora</em>?</h1>
      <p class="lead">Busque um destino para ver clima ao vivo, câmbio em reais, feriados e o essencial do lugar — ou monte um caderno de viagem com três roteiros.</p>
      <form class="busca" role="search" id="form-busca" novalidate>
        <label for="q" class="sr-only">Buscar destino</label>
        <div class="busca__campo">
          ${icone('i-busca')}
          <input id="q" name="q" type="search" autocomplete="off" placeholder="Cidade, parque, região…" minlength="2" maxlength="80" aria-describedby="busca-status" aria-controls="resultados">
          <button class="btn btn--primario" type="submit">Buscar</button>
        </div>
        <p id="busca-status" class="sr-only" aria-live="polite"></p>
        <div id="resultados"></div>
      </form>
      <div class="atalhos" aria-label="Destinos rápidos">
        ${dados.destaques.slice(0, 6).map((d) => `<a class="chip" href="#/destino/${esc(d.slug)}">${esc(d.nome)}</a>`).join('')}
      </div>
    </section>

    <section class="secao" aria-labelledby="titulo-atalhos">
      <h2 id="titulo-atalhos" class="sr-only">Atalhos</h2>
      <div class="grid grid--4">
        <a class="card card--link card--tight" href="#/planejar"><p class="card__rotulo">Planejar</p><p class="card__valor" style="font-size:1.1rem">Montar caderno</p><p class="card__detalhe">Briefing → 3 roteiros</p></a>
        <a class="card card--link card--tight" href="#/precos"><p class="card__rotulo">Preços</p><p class="card__valor" style="font-size:1.1rem">Faixas e buscas</p><p class="card__detalhe">Voos, hotéis e rotas</p></a>
        <a class="card card--link card--tight" href="#/cadernos"><p class="card__rotulo">Cadernos</p><p class="card__valor num" style="font-size:1.1rem">${qtd} salvo${qtd === 1 ? '' : 's'}</p><p class="card__detalhe">Neste aparelho</p></a>
        <a class="card card--link card--tight" href="#/noticias"><p class="card__rotulo">Notícias</p><p class="card__valor" style="font-size:1.1rem">Do mundo das viagens</p><p class="card__detalhe">${dados.feeds.length} fontes em português</p></a>
      </div>
    </section>

    <section class="secao" aria-labelledby="titulo-destaques">
      <div class="secao__cab"><h2 id="titulo-destaques">Destinos em destaque</h2><span class="faint">Toque para abrir o painel ao vivo</span></div>
      <div class="grid grid--3">${dados.destaques.map((d) => cardDestaque(d, dados.paises)).join('')}</div>
    </section>

    <section class="secao" aria-labelledby="titulo-news">
      <div class="secao__cab"><h2 id="titulo-news">Últimas de viagem</h2><a class="btn btn--fantasma btn--pequeno" href="#/noticias">Ver todas ${icone('i-seta')}</a></div>
      <div id="news-preview" aria-live="polite">${skCards(4, 'noticias')}</div>
    </section>
  </div>`;

  // ---- busca ----
  const form = el.querySelector('#form-busca');
  const input = el.querySelector('#q');
  const saida = el.querySelector('#resultados');
  const status = el.querySelector('#busca-status');
  let timer = null, seq = 0;

  async function buscarLugares(termo, explicito) {
    const meu = ++seq;
    if (termo.length < 2) {
      saida.innerHTML = '';
      if (explicito) { status.textContent = 'Digite ao menos 2 letras.'; input.setAttribute('aria-invalid', 'true'); input.focus(); }
      return;
    }
    input.removeAttribute('aria-invalid');
    saida.innerHTML = `<div class="resultados" style="padding:12px" aria-hidden="true"><div class="sk sk--linha"></div><div class="sk sk--linha sk--curta"></div></div>`;
    try {
      const lugares = await geocodificar(termo, { signal });
      if (meu !== seq) return;
      if (!lugares.length) {
        saida.innerHTML = vazioHTML(`Nenhum lugar encontrado para “${termo}”. Tente outro nome ou a cidade mais próxima.`);
        status.textContent = 'Nenhum resultado.';
        return;
      }
      saida.innerHTML = `<ul class="resultados" id="lista-res">${lugares.map((l) => `
        <li><a href="${esc(hrefDestino(l))}">${l.cc ? `<img src="${bandeira(l.cc)}" alt="" width="24" height="17">` : ''}<span><strong>${esc(l.nome)}</strong><small>${esc([l.regiao, l.pais].filter(Boolean).join(' · '))}</small></span></a></li>`).join('')}</ul>`;
      status.textContent = `${lugares.length} resultado${lugares.length > 1 ? 's' : ''}. Use Tab para percorrer.`;
      if (explicito) saida.querySelector('a')?.focus();
    } catch (e) {
      if (meu !== seq || e.status === -1) return;
      saida.innerHTML = erroHTML(msgErro(e));
      saida.querySelector('[data-acao="tentar"]')?.addEventListener('click', () => buscarLugares(input.value.trim(), true));
    }
  }
  form.addEventListener('submit', (ev) => { ev.preventDefault(); clearTimeout(timer); buscarLugares(input.value.trim(), true); });
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const t = input.value.trim();
    if (t.length < 3) { saida.innerHTML = ''; return; }
    timer = setTimeout(() => buscarLugares(t, false), 400);
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') { const a = saida.querySelector('a'); if (a) { ev.preventDefault(); a.focus(); } }
    if (ev.key === 'Escape') { saida.innerHTML = ''; }
  });
  saida.addEventListener('keydown', (ev) => {
    const links = [...saida.querySelectorAll('a')];
    const i = links.indexOf(document.activeElement);
    if (i < 0) return;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); links[Math.min(i + 1, links.length - 1)].focus(); }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); (i === 0 ? input : links[i - 1]).focus(); }
    if (ev.key === 'Escape') { saida.innerHTML = ''; input.focus(); }
  });

  // ---- notícias ----
  const news = el.querySelector('#news-preview');
  async function carregarNews() {
    news.innerHTML = skCards(4, 'noticias');
    try {
      const { itens, falhas } = await todasNoticias(dados.feeds, { signal });
      if (signal.aborted) return;
      if (!itens.length) {
        news.innerHTML = erroHTML(falhas.length ? 'Os feeds de notícias não responderam agora.' : 'Nenhuma notícia disponível no momento.');
        news.querySelector('[data-acao="tentar"]')?.addEventListener('click', carregarNews);
        return;
      }
      news.innerHTML = `<div class="noticias">${itens.slice(0, 4).map(cardNoticia).join('')}</div>`;
    } catch (e) {
      if (e.status === -1) return;
      news.innerHTML = erroHTML(msgErro(e));
      news.querySelector('[data-acao="tentar"]')?.addEventListener('click', carregarNews);
    }
  }
  carregarNews();
}
