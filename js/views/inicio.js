// Tela: Início — Farol · byGui
import { geocodificar, todasNoticias, emAlta, msgErro, fotosWiki, creditosCommons } from '../api.js';
import { esc, icone, bandeira, skCards, erroHTML, vazioHTML, carregandoHTML, numero, dataBR, faixa } from '../ui.js';
import { estimarRapido } from '../inspiracao.js';
import { ligarCarrossel, ligarRevelar, creditoHTML } from '../midia.js';
import { listarCadernos, listarViagens, diasAte } from '../store.js';
import { hrefDestino, cardDestaque, cardNoticia, carregarFotosCartoes } from './comum.js';

function proximaViagem() {
  const itens = [];
  listarViagens().forEach((v) => { if (v.inicio) itens.push({ nome: v.nome, inicio: v.inicio, fim: v.fim, href: `#/gastos/${v.id}`, cadernoId: v.cadernoId }); });
  listarCadernos().forEach((c) => {
    if (c.datas && c.datas.inicio && !itens.some((x) => x.cadernoId === c.plan.id)) itens.push({ nome: c.plan.title, inicio: c.datas.inicio, fim: c.datas.fim, href: `#/caderno/${c.plan.id}` });
  });
  return itens.map((x) => ({ ...x, faltam: diasAte(x.inicio), fimEm: diasAte(x.fim || x.inicio) }))
    .filter((x) => x.fimEm >= 0)
    .sort((a, b) => a.faltam - b.faltam)[0] || null;
}

export function render(ctx) {
  const { el, dados, signal } = ctx;
  ctx.titulo('');
  const qtd = listarCadernos().length;
  const nViagens = listarViagens().length;
  const prox = proximaViagem();
  el.innerHTML = `
  <div class="shell">
    <section class="hero" aria-labelledby="titulo-inicio">
      <p class="kicker">Seu hub de viagem</p>
      <h1 id="titulo-inicio">Para onde o farol aponta <em>agora</em>?</h1>
      <p class="lead">Clima ao vivo, câmbio em reais, feriados, pontos turísticos e preços estimados — e um planejador com controle de gastos que fica salvo no seu aparelho.</p>
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

    <section class="secao revela" aria-labelledby="titulo-insp" style="margin-top:var(--sp-6)">
      <div class="secao__cab"><h2 id="titulo-insp">Inspire-se por tipo de viagem</h2><span class="faint">Fotos reais da Wikipédia · toque para abrir o painel ao vivo</span></div>
      <div class="insp-abas" role="tablist" aria-label="Tipo de viagem">
        ${(dados.inspiracoes || []).map((t, i) => `<button type="button" class="chip" role="tab" id="insp-aba-${esc(t.id)}" data-insp="${esc(t.id)}" aria-selected="${i === 0}" aria-controls="insp-painel" tabindex="${i === 0 ? 0 : -1}">${esc(t.rotulo)}</button>`).join('')}
      </div>
      <p class="muted" id="insp-texto" style="margin-top:0"></p>
      <div id="insp-painel" role="tabpanel" aria-labelledby="insp-aba-${esc(((dados.inspiracoes || [])[0] || {}).id || '')}">
        <div class="carrossel" data-carrossel>
          <div class="carrossel__pista cartoes" id="insp-pista" tabindex="0" role="region" aria-label="Destinos deste tipo de viagem — role para o lado ou use as setas do teclado"></div>
          <div class="carrossel__ctl"><button type="button" class="btn-icone" data-c-prev aria-label="Destinos anteriores">${icone('i-esq')}</button><button type="button" class="btn-icone" data-c-next aria-label="Próximos destinos">${icone('i-dir')}</button></div>
        </div>
      </div>
      <p class="faint" style="margin-top:var(--sp-2)">O custo em cada cartão é uma estimativa do Farol para 7 dias e 2 pessoas, saindo do Brasil (Econômico a Equilibrado); muda com sua data e seu orçamento.</p>
    </section>

    ${prox ? `<section class="secao" aria-labelledby="titulo-prox" style="margin-top:var(--sp-6)">
      <div class="card contagem">
        <div><p class="card__rotulo" id="titulo-prox">Próxima viagem</p><h2 style="margin:0">${esc(prox.nome)}</h2><p class="card__detalhe">${esc(dataBR(prox.inicio))}${prox.fim ? ' a ' + esc(dataBR(prox.fim)) : ''}</p></div>
        <div class="texto-direita"><p class="contagem__n">${prox.faltam > 0 ? numero(prox.faltam) : prox.faltam === 0 ? 'Hoje!' : 'Em viagem'}</p><p class="card__detalhe">${prox.faltam > 1 ? 'dias para a partida' : prox.faltam === 1 ? 'dia para a partida' : 'boa viagem!'}</p></div>
        <a class="btn btn--secundario btn--pequeno" href="${esc(prox.href)}">Abrir ${icone('i-seta')}</a>
      </div>
    </section>` : ''}

    <section class="secao" aria-labelledby="titulo-atalhos" style="margin-top:var(--sp-6)">
      <h2 id="titulo-atalhos" class="sr-only">Atalhos</h2>
      <div class="grid grid--4">
        <a class="card card--link card--tight" href="#/planejar"><p class="card__rotulo">Planejar</p><p class="card__valor" style="font-size:1.1rem">Roteiro sugerido</p><p class="card__detalhe">Briefing → 3 opções com custos</p></a>
        <a class="card card--link card--tight" href="#/gastos"><p class="card__rotulo">Gastos</p><p class="card__valor num" style="font-size:1.1rem">${nViagens} viage${nViagens === 1 ? 'm' : 'ns'}</p><p class="card__detalhe">Orçamento × gasto real</p></a>
        <a class="card card--link card--tight" href="#/precos"><p class="card__rotulo">Preços</p><p class="card__valor" style="font-size:1.1rem">Passagem a seguro</p><p class="card__detalhe">Faixas e buscas prontas</p></a>
        <a class="card card--link card--tight" href="#/cadernos"><p class="card__rotulo">Cadernos</p><p class="card__valor num" style="font-size:1.1rem">${qtd} salvo${qtd === 1 ? '' : 's'}</p><p class="card__detalhe">Neste aparelho</p></a>
      </div>
    </section>

    <section class="secao" aria-labelledby="titulo-alta">
      <div class="secao__cab"><h2 id="titulo-alta">Em alta</h2><span class="faint">Baseado em buscas na Wikipédia em português</span></div>
      <div id="box-alta">${carregandoHTML('Calculando os destinos em alta', 3)}</div>
    </section>

    <section class="secao" aria-labelledby="titulo-destaques">
      <div class="secao__cab"><h2 id="titulo-destaques">Destinos em destaque</h2><span class="faint">${dados.destaques.length} destinos · toque para abrir o painel ao vivo</span></div>
      <div class="filtros" role="group" aria-label="Filtrar destinos">
        <button type="button" class="chip" data-filtro="todos" aria-pressed="true">Todos</button>
        <button type="button" class="chip" data-filtro="br" aria-pressed="false">Brasil</button>
        <button type="button" class="chip" data-filtro="ex" aria-pressed="false">Exterior</button>
      </div>
      <div class="grid grid--3" id="grade-destaques">${dados.destaques.map((d) => cardDestaque(d, dados.paises)).join('')}</div>
      <details class="fotos-creditos" id="fotos-creditos">
        <summary>Créditos das fotos (autor e licença)</summary>
        <div id="box-creditos" aria-live="polite"><p class="faint">Abra para carregar os créditos de cada foto, direto do Wikimedia Commons.</p></div>
      </details>
    </section>

    <section class="secao" aria-labelledby="titulo-news">
      <div class="secao__cab"><h2 id="titulo-news">Últimas de viagem</h2><a class="btn btn--fantasma btn--pequeno" href="#/noticias">Ver todas ${icone('i-seta')}</a></div>
      <div id="news-preview">${skCards(4, 'noticias')}</div>
    </section>
  </div>`;

  carregarFotosCartoes(el.querySelector('#grade-destaques'), { signal });
  el.querySelectorAll('[data-filtro]').forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.filtro;
    el.querySelectorAll('[data-filtro]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    el.querySelectorAll('#grade-destaques > a').forEach((a) => { a.hidden = f === 'br' ? a.dataset.pais !== 'BR' : f === 'ex' ? a.dataset.pais === 'BR' : false; });
  }));

  // ---- inspirações por tipo de viagem ----
  {
    const tipos = dados.inspiracoes || [];
    const pista = el.querySelector('#insp-pista'), texto = el.querySelector('#insp-texto'), painel = el.querySelector('#insp-painel');
    const abas = [...el.querySelectorAll('[data-insp]')];
    const porSlug = new Map(dados.destaques.map((d) => [d.slug, d]));
    const cartaoInsp = (d) => {
      const e = estimarRapido(dados, { cc: d.pais, dias: 7, pessoas: 2 });
      const html = cardDestaque(d, dados.paises);
      return html.replace('<span class="destaque__ir">', `<span class="destaque__custo num">≈ ${esc(faixa(e.economico.min, e.equilibrado.max))} <small>estimativa · 7 dias, 2 pessoas</small></span><span class="destaque__ir">`);
    };
    function mostrar(id, focar) {
      const t = tipos.find((x) => x.id === id) || tipos[0];
      if (!t) return;
      abas.forEach((b) => { const on = b.dataset.insp === t.id; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
      painel.setAttribute('aria-labelledby', 'insp-aba-' + t.id);
      texto.textContent = t.texto;
      pista.innerHTML = t.slugs.map((sl) => porSlug.get(sl)).filter(Boolean).map(cartaoInsp).join('');
      pista.scrollLeft = 0;
      carregarFotosCartoes(pista, { signal });
      if (focar) el.querySelector(`[data-insp="${t.id}"]`).focus();
    }
    abas.forEach((b, i) => {
      b.addEventListener('click', () => mostrar(b.dataset.insp));
      b.addEventListener('keydown', (ev) => {
        let j = null;
        if (ev.key === 'ArrowRight') j = (i + 1) % abas.length;
        if (ev.key === 'ArrowLeft') j = (i - 1 + abas.length) % abas.length;
        if (ev.key === 'Home') j = 0;
        if (ev.key === 'End') j = abas.length - 1;
        if (j !== null) { ev.preventDefault(); mostrar(abas[j].dataset.insp, true); }
      });
    });
    if (tipos.length) mostrar(tipos[0].id);
    ligarCarrossel(el, { signal });
  }

  // ---- créditos das fotos (carrega só ao abrir) ----
  {
    const det = el.querySelector('#fotos-creditos'), box = el.querySelector('#box-creditos');
    let feito = false;
    async function carregarCreditos() {
      box.innerHTML = carregandoHTML('Buscando créditos no Wikimedia Commons', 2);
      try {
        const m = await fotosWiki(dados.destaques.map((d) => d.wiki), { tamanho: 500, signal });
        const arqs = Object.values(m).map((x) => x.arquivo).filter(Boolean);
        const cr = await creditosCommons(arqs, { signal });
        if (signal.aborted) return;
        const itens = dados.destaques.map((d) => { const f = m[d.wiki]; const c = f && cr[(f.arquivo || '').replace(/_/g, ' ')]; return c ? `<li><strong>${esc(d.nome)}:</strong> ${creditoHTML(c).replace(/^Foto: /, '')}</li>` : ''; }).filter(Boolean);
        const sem = dados.destaques.length - itens.length;
        box.innerHTML = itens.length ? `<ul>${itens.join('')}</ul>${sem ? `<p class="faint">${sem} foto(s) sem crédito carregado agora (limite de pedidos do Commons ou foto sem registro). Tente de novo em instantes.</p>` : ''}` : erroHTML('Os créditos não carregaram agora (o Wikimedia Commons pode ter pedido uma pausa).');
        box.querySelector('[data-acao="tentar"]')?.addEventListener('click', carregarCreditos);
        feito = itens.length > 0;
      } catch (e) {
        if (e.status === -1) return;
        box.innerHTML = erroHTML(msgErro(e));
        box.querySelector('[data-acao="tentar"]')?.addEventListener('click', carregarCreditos);
      }
    }
    det.addEventListener('toggle', () => { if (det.open && !feito) carregarCreditos(); });
  }
  ligarRevelar(el, { signal });

  // ---- em alta (Wikimedia Pageviews) ----
  const boxAlta = el.querySelector('#box-alta');
  async function carregarAlta() {
    boxAlta.innerHTML = carregandoHTML('Calculando os destinos em alta', 3);
    try {
      const r = await emAlta(dados.destaques, { signal, onProgresso: (n, t) => { const s = boxAlta.querySelector('.sr-only'); if (s) s.textContent = `Consultando a Wikimedia: ${n} de ${t}`; } });
      if (signal.aborted) return;
      if (!r.lista.length) {
        boxAlta.innerHTML = erroHTML(r.limitado ? msgErro(r.limitado) : 'A Wikimedia não respondeu agora. O ranking volta quando o serviço responder.');
        boxAlta.querySelector('[data-acao="tentar"]')?.addEventListener('click', carregarAlta);
        return;
      }
      const MIN = 1000; // evita que páginas com pouquíssimo acesso dominem o ranking por variação
      const relevantes = r.lista.filter((x) => x.ultimos >= MIN);
      const top = (relevantes.length >= 3 ? relevantes : r.lista).slice(0, 6);
      const pct = (v) => `${v >= 0 ? '+' : '−'}${numero(Math.abs(v * 100), 0)}%`;
      boxAlta.innerHTML = `<ol class="alta">${top.map((x, i) => `<li class="card card--tight alta__item">
          <span class="alta__pos" aria-hidden="true">${i + 1}</span>
          <div style="min-width:0"><h3><a href="#/destino/${esc(x.destaque.slug)}"><span class="sr-only">${i + 1}º: </span>${esc(x.destaque.nome)}</a></h3><p class="faint num" style="margin:0">${numero(x.ultimos)} visualizações em 30 dias</p></div>
          <span class="alta__var ${x.variacao >= 0 ? 'sobe' : 'desce'}" title="Variação contra os 30 dias anteriores">${pct(x.variacao)}<span class="sr-only"> em relação aos 30 dias anteriores</span></span>
        </li>`).join('')}</ol>
        <p class="faint" style="margin-top:var(--sp-3)">Crescimento das visualizações das páginas destes ${r.total} destinos na Wikipédia em português (usuários, últimos 30 dias contra os 30 anteriores, mínimo de 1.000 visualizações; Wikimedia Pageviews). Indica interesse, não preço nem lotação.${r.limitado ? ` A Wikimedia limitou as consultas: ranking com ${r.lista.length} de ${r.total} destinos; os demais entram na próxima visita.` : ''}${r.falhas ? ` ${r.falhas} destino(s) sem dados agora.` : ''}</p>`;
    } catch (e) {
      if (e.status === -1) return;
      boxAlta.innerHTML = erroHTML(msgErro(e));
      boxAlta.querySelector('[data-acao="tentar"]')?.addEventListener('click', carregarAlta);
    }
  }
  carregarAlta();

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
