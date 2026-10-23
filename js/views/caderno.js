// Tela: Caderno (resultado do planejador) — Farol · byGui
import { esc, icone, prefereMenosMovimento, faixa, reais, toast, MESES, MESES_CURTOS, confirmar, uid, dataBR } from '../ui.js';
import { cadernoAtual, obterCaderno, salvarCaderno, estaSalvo, lerChecks, gravarChecks, apagarCaderno, limparAtual, MAX_CADERNOS, definirAtual, definirDatasCaderno, viagemDoCaderno, novaViagem, salvarViagem, listarViagens, MAX_VIAGENS, diasAte } from '../store.js';
import { transporteRotulo, mesRotulo, orcamentoRotulo } from '../planner.js';
import { htmlCompartilhar, ligarCompartilhar, urlCompleta, codificarBrief } from '../share.js';
import { ORIGEM_ROTEIRO } from '../gerador.js';
import { montarPrecos } from './precos-hub.js';
import { painelViagem } from './gastos.js';
import { datasPadrao } from '../links.js';
import { wikiResumo, midiaDestino, fotosWiki, creditosCommons, pontosTuristicos, variante } from '../api.js';
import { organizar, raioPara, distanciaKm } from '../pontos.js';
import { creditoHTML, ligarImagens, ligarCarrossel, videoCardHTML, ligarVideos, ytBusca, ligarRevelar, ligarParalaxe } from '../midia.js';
import { ligarBarraAcoes } from './comum.js';

export function render(ctx) {
  const { el, params, dados, signal } = ctx;
  const id = params[0];
  const reg = id === 'atual' ? cadernoAtual() : obterCaderno(id);
  if (!reg) {
    ctx.titulo('Caderno não encontrado');
    el.innerHTML = `<section class="shell"><a class="voltar" href="#/cadernos">${icone('i-voltar')} Cadernos</a><h1>Caderno não encontrado</h1><p class="lead">${id === 'atual' ? 'Não há um caderno em edição nesta sessão.' : 'Ele pode ter sido apagado ou foi salvo em outro aparelho.'}</p><div class="acoes"><a class="btn btn--primario" href="#/planejar">Montar um caderno</a><a class="btn btn--fantasma" href="#/cadernos">Ver cadernos salvos</a></div></section>`;
    return;
  }
  const { brief, plan } = reg;
  let datas = reg.datas || null;
  ctx.titulo(plan.title);
  const kicker = String(plan.kicker || '').replace(/^Caderno de bordo/, ORIGEM_ROTEIRO.rotulo);
  let sel = 1; // opção Equilibrado começa selecionada
  let aba = 'opcoes';
  const checks = lerChecks(plan.id);
  const totalItens = plan.checklist.reduce((s, g) => s + g.items.length, 0);
  const pct = () => (totalItens ? Math.round((checks.size / totalItens) * 100) : 0);
  const salvo = () => estaSalvo(plan.id);
  const c = plan.climate;

  const ABAS = [
    ['opcoes', 'Opções'], ['clima', 'Clima'], ['dinheiro', 'Dinheiro'], ['precos', 'Preços'], ['gastos', 'Gastos'], ['tempo', 'Tempo'], ['checklist', 'Checklist'],
  ];

  const qPreco = new URLSearchParams({ destino: plan.destino ? plan.destino.nome : brief.destination, origem: plan.origem.nome, viajantes: brief.travelers, dias: brief.days, transporte: plan.transporte || brief.transport });
  if (plan.destino && plan.destino.cc) qPreco.set('pais', plan.destino.cc);
  if (plan.destino && plan.destino.iata) qPreco.set('iata', plan.destino.iata);
  if (plan.origem.iata) qPreco.set('iataOrigem', plan.origem.iata);
  if (brief.month !== 'flex') qPreco.set('mes', brief.month);
  const linkDestino = plan.destino ? (plan.destino.slug ? `#/destino/${plan.destino.slug}` : `#/destino/${plan.destino.lat.toFixed(4)},${plan.destino.lon.toFixed(4)}?${new URLSearchParams({ nome: plan.destino.nome, pais: plan.destino.cc })}`) : '';

  const dNome = plan.destino ? plan.destino.nome : brief.destination;
  const videos = (plan.destino && plan.destino.slug && dados.videos && dados.videos.porDestino[plan.destino.slug]) || [];
  el.innerHTML = `
  <section class="hero-full caderno-hero" id="c-hero" aria-labelledby="c-titulo">
    <div class="hero-full__midia foto"><img id="c-hero-img" data-paralaxe alt="" decoding="async" fetchpriority="high"></div>
    <div class="hero-full__veu" aria-hidden="true"></div>
    <div class="shell hero-full__conteudo">
      <a class="voltar voltar--sobre" href="${id === 'atual' ? '#/planejar' : '#/cadernos'}">${icone('i-voltar')} ${id === 'atual' ? 'Briefing' : 'Cadernos'}</a>
      <p class="kicker kicker--sobre">${esc(kicker)}</p>
      <h1 id="c-titulo">${esc(plan.title)}</h1>
      <div class="meta-linha">
        <span class="selo selo--vidro">${esc(transporteRotulo(plan.transporte || brief.transport))}</span>
        <span class="selo selo--vidro">${brief.days} dias</span>
        <span class="selo selo--vidro">${brief.travelers} ${brief.travelers > 1 ? 'viajantes' : 'viajante'}</span>
        <span class="selo selo--vidro">${esc(mesRotulo(brief.month))}</span>
        <span class="selo selo--vidro">${esc(orcamentoRotulo(brief.budget))}</span>
        ${plan.origem.assumida ? '<span class="selo selo--aviso">Origem assumida: ' + esc(plan.origem.nome) + '</span>' : ''}
      </div>
    </div>
    <p class="hero-full__cred" id="c-hero-cred" hidden></p>
  </section>
  <div class="shell com-barra">
    <p class="lead">${esc(plan.summary)}</p>
    <div class="acoes">
      <button type="button" class="btn btn--primario" id="btn-salvar">${salvo() ? 'Salvo neste aparelho' : 'Salvar caderno'}</button>
      <button type="button" class="btn btn--secundario" data-ir-aba="precos">Ver preços</button>
      ${linkDestino ? `<a class="btn btn--fantasma" href="${esc(linkDestino)}">Painel do destino</a>` : ''}
      ${id === 'atual' ? `<a class="btn btn--fantasma" href="#/planejar">Editar briefing</a><button type="button" class="btn btn--fantasma" id="btn-nova">Nova viagem</button>` : `<button type="button" class="btn btn--fantasma" id="btn-apagar" aria-label="Apagar o caderno ${esc(plan.title)}">${icone('i-lixo')} Apagar</button>`}
    </div>

    <div class="linha-acoes" style="margin-top:var(--sp-4)"><span class="faint">Compartilhar roteiro:</span>${htmlCompartilhar()}</div>
    <form class="bloco" id="form-datas" style="margin-top:var(--sp-5)" novalidate>
      <div class="linha-form linha-form--3" style="align-items:end">
        <div class="campo"><label for="d-ida">Ida (opcional)</label><input class="input" type="date" id="d-ida" name="inicio" value="${esc(datas ? datas.inicio || '' : '')}" aria-describedby="d-ajuda"></div>
        <div class="campo"><label for="d-volta">Volta (opcional)</label><input class="input" type="date" id="d-volta" name="fim" value="${esc(datas ? datas.fim || '' : '')}" aria-describedby="d-ajuda"></div>
        <div class="campo"><button class="btn btn--fantasma" type="submit">Salvar datas</button></div>
      </div>
      <p class="ajuda" id="d-ajuda" style="margin-top:var(--sp-2)">Com datas, os links de preço abrem nesses dias e a contagem regressiva aparece no Início.</p>
      <p class="erro-campo" id="d-erro" aria-live="polite"></p>
    </form>

    <div class="grid grid--4" style="margin-top:var(--sp-6)">
      <div class="card card--tight"><p class="card__rotulo">Clima</p><p class="card__valor num">${c.tempMinC != null ? `${c.tempMinC}–${c.tempMaxC}°C` : '—'}</p><p class="card__detalhe">${esc(c.season)}</p></div>
      <div class="card card--tight"><p class="card__rotulo">Estimativa</p><p class="card__valor num" style="font-size:1.15rem">${faixa(plan.money.totalMin, plan.money.totalMax)}</p><p class="card__detalhe">Grupo · opção Equilibrado</p></div>
      <div class="card card--tight"><p class="card__rotulo">Ida</p><p class="card__valor" style="font-size:1rem;line-height:1.35">${esc(plan.time.outbound.split('. ')[0])}</p></div>
      <div class="card card--tight"><p class="card__rotulo">Lotação</p><p class="card__valor" style="font-size:1rem;line-height:1.35">${esc(plan.time.crowding.split(':')[0])}</p><p class="card__detalhe">${esc(plan.time.bookingLead.split('. ')[0])}</p></div>
    </div>

    <section class="secao revela" aria-labelledby="c-t-videos" id="c-videos">
      <div class="secao__cab"><h2 id="c-t-videos">Veja como é ${esc(dNome)}</h2><a class="btn btn--fantasma btn--pequeno" href="${esc(ytBusca(`${dNome} o que fazer roteiro de viagem`))}" target="_blank" rel="noopener noreferrer">Buscar vídeos no YouTube ${icone('i-externo')}<span class="sr-only"> (abre em nova aba)</span></a></div>
      ${videos.length ? `<div class="carrossel" data-carrossel>
        <div class="carrossel__pista videos" tabindex="0" role="region" aria-label="Vídeos sobre ${esc(dNome)} — role para o lado ou use as setas do teclado">${videos.map((v) => videoCardHTML(v)).join('')}</div>
        <div class="carrossel__ctl"><button type="button" class="btn-icone" data-c-prev aria-label="Vídeos anteriores">${icone('i-esq')}</button><button type="button" class="btn-icone" data-c-next aria-label="Próximos vídeos">${icone('i-dir')}</button></div>
      </div>
      <p class="faint" style="margin-top:var(--sp-3)">Vídeos de criadores independentes, conferidos em ${esc(dataBR(dados.videos.verificadoEm))}; o player só carrega (sem cookies) quando você clica. Preços citados podem estar desatualizados.</p>`
      : `<p class="muted">Ainda não temos vídeos conferidos para este lugar. O botão acima abre o YouTube já com a busca pronta.</p>`}
    </section>

    <div class="abas" role="tablist" aria-label="Seções do caderno">
      ${ABAS.map(([k, r]) => `<button type="button" class="aba" role="tab" id="aba-${k}" aria-controls="painel-${k}" aria-selected="${k === aba}" tabindex="${k === aba ? 0 : -1}">${r}${k === 'checklist' ? ` · <span id="pct-aba">${pct()}%</span>` : ''}</button>`).join('')}
    </div>
    ${ABAS.map(([k]) => `<section class="painel" role="tabpanel" id="painel-${k}" aria-labelledby="aba-${k}" tabindex="0" ${k === aba ? '' : 'hidden'}></section>`).join('')}
  </div>`;

  const $ = (s) => el.querySelector(s);

  // ---- paradas reais por dia (OpenStreetMap + Wikipédia/Commons), com links à vista ----
  const ehDiaDeLugar = (d) => !/^(Chegada|Estrada|Volta|Último|Dia livre|Dia de descanso)/i.test(d.title);
  const diasDeLugar = Math.max(...plan.options.map((op) => op.days.filter(ehDiaDeLugar).length), 0);
  const par = { estado: plan.destino ? 'carregando' : 'sem', lista: [], fotos: {}, cred: {} };
  const linkExtra = (id, q) => String(((dados.links.extras || []).find((x) => x.id === id) || {}).modelo || '').replace('{q}', encodeURIComponent(q));
  const chipLink = (href, icon, rotulo, sr) => `<a class="chip-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${icone(icon)} ${esc(rotulo)}<span class="sr-only"> ${esc(sr)} (abre em nova aba)</span></a>`;
  function linksParada(nome, p) {
    const q = `${nome} ${dNome}`;
    const mapa = p ? `https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(6)},${p.lon.toFixed(6)}` : linkExtra('maps-busca', q);
    return [
      chipLink(mapa, 'i-pin', 'Mapa', `de ${nome}`),
      chipLink(ytBusca(`${q} o que fazer`), 'i-play', 'Ver vídeo', `sobre ${nome}`),
      chipLink(linkExtra('gyg-busca', q), 'i-ingresso', 'Passeios e ingressos', `de ${nome} no GetYourGuide`),
      plan.destino && plan.destino.civitatis ? chipLink(`https://www.civitatis.com/br/${plan.destino.civitatis}/`, 'i-ingresso', 'Civitatis', `passeios em ${dNome}`) : '',
      p && p.wikiPt ? chipLink(`https://pt.wikipedia.org/wiki/${encodeURIComponent(p.wikiPt.replace(/ /g, '_'))}`, 'i-externo', 'Wikipédia', `sobre ${nome}`) : '',
    ].join('');
  }
  function linksGenericos() {
    const q = `${dNome} o que fazer`;
    return [
      chipLink(linkExtra('maps-busca', q), 'i-pin', 'Buscar no mapa', `lugares em ${dNome}`),
      chipLink(ytBusca(`${q} roteiro de viagem`), 'i-play', 'Ver vídeos', `sobre ${dNome}`),
      chipLink(linkExtra('gyg-busca', dNome), 'i-ingresso', 'Passeios e ingressos', `em ${dNome} no GetYourGuide`),
      plan.destino && plan.destino.civitatis ? chipLink(`https://www.civitatis.com/br/${plan.destino.civitatis}/`, 'i-ingresso', 'Civitatis', `passeios em ${dNome}`) : '',
    ].join('');
  }
  function paradaConteudo(ord) {
    if (par.estado === 'carregando') return `<div class="parada parada--sk" aria-hidden="true"><div class="sk"></div></div><div class="parada__links parada__links--solta">${linksGenericos()}</div>`;
    const p = par.lista[ord];
    if (!p) {
      const msg = par.estado === 'erro' ? 'Não conseguimos buscar lugares reais agora (OpenStreetMap indisponível). Mesmo assim, estes atalhos abrem a busca pronta:'
        : par.estado === 'sem' ? 'Destino sem coordenadas: não há lugares reais para sugerir. Atalhos de busca:' : 'Não há outro lugar catalogado para este dia. Atalhos de busca:';
      return `<div class="parada parada--vazia"><div class="parada__corpo"><p class="parada__rot">Sugestão para este dia</p><p class="parada__meta">${msg}</p><div class="parada__links">${linksGenericos()}</div></div></div>`;
    }
    const f = p.wikiPt && par.fotos[p.wikiPt.replace(/ /g, '_')];
    const dist = p.dist < 1 ? `${Math.round(p.dist * 1000)} m` : `${p.dist.toFixed(1).replace('.', ',')} km`;
    return `<article class="parada">
      <div class="parada__foto foto">${f ? `<img data-prog src="${esc(f.src)}" alt="Foto de ${esc(p.nome)}" loading="lazy" decoding="async" width="${f.largura}" height="${f.altura}">` : `<span class="parada__sem">Sem foto livre na Wikipédia</span>`}</div>
      <div class="parada__corpo">
        <p class="parada__rot">Lugar real · ${esc(p.tipo)} · ${dist} do centro</p>
        <h4>${esc(p.nome)}</h4>
        <div class="parada__links">${linksParada(p.nome, p)}</div>
        ${f ? `<p class="parada__cred" data-cred="${esc(f.arquivo)}">Foto: Wikipédia</p>` : ''}
      </div></article>`;
  }
  function notaParadas() {
    if (par.estado === 'ok') return 'Os lugares vêm do OpenStreetMap (com preferência para os que têm artigo na Wikipédia) e as fotos, do Wikimedia Commons, com crédito. Eles ilustram o destino: o Farol não monta horários nem reserva por você. Confira funcionamento e preços nos links.';
    if (par.estado === 'carregando') return 'Buscando lugares reais no OpenStreetMap…';
    return 'Sem lugares reais disponíveis agora: mostramos só atalhos de busca, sem imagens genéricas.';
  }
  function preencherParadas() {
    el.querySelectorAll('.parada-host').forEach((h) => { h.innerHTML = paradaConteudo(Number(h.dataset.ord)); });
    const n = el.querySelector('#paradas-nota'); if (n) n.textContent = notaParadas();
    ligarImagens(el); creditarParadas();
  }
  async function creditarParadas() {
    const els = [...el.querySelectorAll('[data-cred]')].filter((e) => e.dataset.cred);
    const falta = els.map((e) => e.dataset.cred).filter((n) => !par.cred[n.replace(/_/g, ' ')]);
    if (falta.length) { try { Object.assign(par.cred, await creditosCommons(falta, { signal })); } catch { /* fica "Foto: Wikipédia" */ } }
    els.forEach((e) => { const f = par.cred[e.dataset.cred.replace(/_/g, ' ')]; if (f) e.innerHTML = creditoHTML(f, { curto: true }); });
  }
  const intercalar = (pool) => {
    const g = new Map(); pool.forEach((p) => { if (!g.has(p.grupo)) g.set(p.grupo, []); g.get(p.grupo).push(p); });
    const filas = [...g.values()]; const out = [];
    while (filas.some((f) => f.length)) filas.forEach((f) => { if (f.length) out.push(f.shift()); });
    return out;
  };
  async function carregarParadas() {
    const d = plan.destino;
    if (!d || d.lat == null || !diasDeLugar) { par.estado = d ? 'ok' : 'sem'; preencherParadas(); return; }
    try {
      if (plan.descobrir && Array.isArray(plan.descobrir.paradas) && plan.descobrir.paradas.length) {
        par.lista = plan.descobrir.paradas; // primeiro lugar curtido de cada dia
      } else {
        const raio = raioPara(d.tipo);
        const r = await pontosTuristicos(d.lat, d.lon, raio, { signal, timeout: 18000 });
        if (signal.aborted) return;
        const lista = organizar(r.elementos, { lat: d.lat, lon: d.lon }, raio);
        par.lista = intercalar(lista.slice(0, diasDeLugar * 2)).slice(0, diasDeLugar);
      }
      par.estado = 'ok';
      preencherParadas();
      const titulos = par.lista.filter((p) => p.wikiPt).map((p) => p.wikiPt.replace(/ /g, '_'));
      if (titulos.length) {
        try {
          const m = await fotosWiki(titulos, { tamanho: 640, signal });
          if (signal.aborted) return;
          par.fotos = m; preencherParadas();
        } catch { /* os cartões seguem úteis sem foto */ }
      }
    } catch (e) {
      if (e.status === -1 || signal.aborted) return;
      par.estado = 'erro'; preencherParadas();
    }
  }

  // ---- foto de capa (Wikipédia/Commons) ----
  async function carregarCapa() {
    const box = $('#c-hero'), img = $('#c-hero-img'), cred = $('#c-hero-cred');
    const vazio = () => { if (!img.getAttribute('src')) box.classList.add('is-vazio'); };
    const d = plan.destino;
    if (!d) { vazio(); return; }
    try {
      let titulo = d.wiki;
      if (!titulo) {
        const w = await wikiResumo(d.nome, { signal });
        const c2 = w.coordinates;
        if (!c2 || d.lat == null || distanciaKm({ lat: d.lat, lon: d.lon }, { lat: c2.lat, lon: c2.lon }) > 40) throw Object.assign(new Error('x'), { vazio: true });
        titulo = w.title;
      } else {
        try { const q = sessionStorage.getItem('farol:thumb:' + titulo); if (q) { img.src = q; img.classList.add('is-lqip', 'is-ok'); box.classList.add('tem-foto'); } } catch { /* sem sessionStorage */ }
      }
      const m = await midiaDestino(titulo, { signal });
      if (signal.aborted) return;
      const f = m.hero.f;
      const srcset = `${variante(f, 960)} 960w, ${variante(f, 1920)} 1920w`;
      const pre = new Image(); pre.sizes = '100vw'; pre.srcset = srcset;
      pre.onload = () => { img.sizes = '100vw'; img.srcset = srcset; img.src = variante(f, 1280); img.alt = `Foto de ${dNome}${f.descricao ? ': ' + f.descricao : ''}`.slice(0, 220); img.classList.remove('is-lqip'); img.classList.add('is-ok'); box.classList.add('tem-foto'); box.classList.remove('is-vazio'); };
      pre.onerror = vazio;
      pre.src = variante(f, 1280);
      cred.hidden = false; cred.innerHTML = creditoHTML(f);
    } catch (e) { if (e.status !== -1) vazio(); }
  }

  // ---- painéis ----
  function pOpcoes() {
    const o = plan.options[sel];
    $('#painel-opcoes').innerHTML = `
      <div class="opcoes" role="group" aria-label="Escolha uma das três opções">
        ${plan.options.map((op, i) => `<button type="button" class="card opcao" data-op="${i}" aria-pressed="${i === sel}">
          <span class="selo ${i === 0 ? 'selo--ok' : i === 1 ? 'selo--info' : ''}">${esc(op.tag)}</span>
          <h3 style="margin-top:var(--sp-3)">${esc(op.name)}</h3>
          <p class="card__valor num">${faixa(op.estimatedMin, op.estimatedMax)}</p>
          <p class="muted" style="font-size:var(--fs-sm)">${esc(op.summary)}</p>
          ${op.highlights.length ? `<ul class="lista-marcada lista-limpa" style="font-size:var(--fs-sm)">${op.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
          <p class="faint" style="margin-top:var(--sp-3)">${esc(op.fit)}</p>
        </button>`).join('')}
      </div>
      <h2 style="margin-top:var(--sp-6)">Dia a dia · ${esc(o.tag)}</h2>
      <ol class="dias">${(() => { let k = 0; return o.days.map((d) => { const ord = ehDiaDeLugar(d) ? k++ : -1; return `<li class="card card--tight dia-item"><span class="dia-item__n" aria-hidden="true">${String(d.day).padStart(2, '0')}</span><div><h3 style="font-size:1rem;margin:0 0 6px"><span class="sr-only">Dia ${d.day}: </span>${esc(d.title)}</h3><ul>${d.activities.map((a) => `<li>${esc(a)}</li>`).join('')}</ul><p class="dia-item__noite">Pernoite · ${esc(d.overnight)}</p>${ord >= 0 ? `<div class="parada-host" data-ord="${ord}">${paradaConteudo(ord)}</div>` : ''}</div></li>`; }).join(''); })()}</ol>
      <p class="faint" id="paradas-nota" style="margin-top:var(--sp-3)">${notaParadas()}</p>
      ${plan.warnings.length ? `<div class="card aviso-card" style="margin-top:var(--sp-5)"><h3>Atenção</h3><ul class="lista-marcada lista-limpa">${plan.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
      ${plan.localTips.length ? `<div class="card" style="margin-top:var(--sp-4)"><h3>Dicas de especialista</h3><ul class="lista-marcada lista-limpa">${plan.localTips.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
      <p class="faint" style="margin-top:var(--sp-4)">${esc(ORIGEM_ROTEIRO.rotulo)}: ${esc(ORIGEM_ROTEIRO.explicacao.charAt(0).toLowerCase() + ORIGEM_ROTEIRO.explicacao.slice(1))} Tipos de lugar são sugestões, não reservas.</p>`;
    ligarImagens($('#painel-opcoes')); creditarParadas();
    $('#painel-opcoes').querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => {
      sel = Number(b.dataset.op); pOpcoes(); pDinheiro(); if (!viagemDoCaderno(plan.id)) pGastos();
      $(`#painel-opcoes [data-op="${sel}"]`).focus();
    }));
  }

  function pClima() {
    const temMeses = c.meses && c.meses.some((m) => m.ok);
    const okM = temMeses ? c.meses.filter((m) => m.ok) : [];
    const maxT = temMeses ? Math.max(...okM.map((m) => m.max)) : 1;
    const minB = temMeses ? Math.min(0, ...okM.map((m) => m.min)) : 0;
    $('#painel-clima').innerHTML = `
      <div class="grid grid--2">
        <div class="card">
          <p class="card__rotulo">${esc(c.season)} · ${esc(MESES[c.mesRef] || '')}</p>
          <p class="card__valor num" style="font-size:2.4rem">${c.tempMinC != null ? `${c.tempMinC}° a ${c.tempMaxC}°C` : 'Sem dados'}</p>
          <p class="card__detalhe">${esc(c.rain)}</p>
          <p style="margin-top:var(--sp-4)">${esc(c.notes)}</p>
          <h3 style="margin-top:var(--sp-4)">Melhor janela</h3><p class="muted">${esc(c.bestWindow)}</p>
        </div>
        <div class="card">
          <h3>Mala para o clima</h3>
          <ul class="lista-marcada lista-limpa">${c.packing.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
          ${temMeses ? `<div class="meses" role="img" aria-label="Máxima média por mês: ${esc(okM.map((m) => `${MESES[m.mes]} ${m.max} graus`).join(', '))}">${c.meses.map((m) => `<div class="mes ${c.melhores.includes(m.mes) ? 'is-melhor' : ''}"><span class="faint num" style="font-size:.66rem">${m.ok ? m.max + '°' : ''}</span><div class="mes__barra" style="height:${m.ok ? Math.max(6, Math.round(((m.max - minB) / ((maxT - minB) || 1)) * 100)) : 4}%;${m.mes === c.mesRef ? 'outline:2px solid var(--text);outline-offset:1px' : ''}"></div><span class="mes__rot">${MESES_CURTOS[m.mes]}</span></div>`).join('')}</div>
          <div class="legenda"><span><i style="background:var(--accent)"></i>Máxima média</span><span><i style="background:var(--ok)"></i>Melhores meses</span><span><i style="background:transparent;outline:2px solid var(--text)"></i>Mês da viagem</span></div>` : ''}
          ${c.fonte ? `<p class="faint" style="margin-top:var(--sp-3)">Fonte: ${esc(c.fonte)}.</p>` : ''}
        </div>
      </div>`;
  }

  function pDinheiro() {
    const o = plan.options[sel];
    $('#painel-dinheiro').innerHTML = `
      <div class="aviso-estimativa" role="note"><strong>Estimativa.</strong> Faixas calculadas com custos médios da região “${esc(plan.regiaoCusto)}” (dados.json). Não é cotação — confira os preços reais antes de reservar.</div>
      <div class="chips" role="group" aria-label="Ver estimativa da opção" style="margin-top:var(--sp-4)">${plan.options.map((op, i) => `<button type="button" class="chip" data-dop="${i}" aria-pressed="${i === sel}">${esc(op.tag)}</button>`).join('')}</div>
      <div class="tabela-wrap" style="margin-top:var(--sp-4)"><table>
        <caption>Estimativa para o grupo · opção ${esc(o.tag)} · em reais</caption>
        <thead><tr><th scope="col">Item</th><th scope="col" class="num">Faixa</th><th scope="col">Observação</th></tr></thead>
        <tbody>${o.breakdown.map((l) => `<tr><th scope="row" style="font-weight:600">${esc(l.item)}</th><td class="num">${faixa(l.amountMin, l.amountMax)}</td><td class="muted">${esc(l.note)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total estimado</td><td class="num">${faixa(o.estimatedMin, o.estimatedMax)}</td><td class="muted">${reais(o.estimatedMin / brief.travelers)} – ${reais(o.estimatedMax / brief.travelers)} por pessoa</td></tr></tfoot>
      </table></div>
      <p class="muted" style="margin-top:var(--sp-3)">${esc(o.fit)}</p>
      <div class="card" style="margin-top:var(--sp-4)"><h3>Como gastar menos</h3><ul class="lista-marcada lista-limpa">${plan.money.savingTips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
    $('#painel-dinheiro').querySelectorAll('[data-dop]').forEach((b) => b.addEventListener('click', () => {
      sel = Number(b.dataset.dop); pDinheiro(); pOpcoes(); if (!viagemDoCaderno(plan.id)) pGastos();
      $(`#painel-dinheiro [data-dop="${sel}"]`).focus();
    }));
  }

  function pTempo() {
    const blocos = [['Ida', plan.time.outbound], ['Volta', plan.time.inbound], ['Ritmo dos dias', plan.time.dailyPace], ['Disponibilidade', plan.time.availability], ['Antecedência', plan.time.bookingLead], ['Lotação', plan.time.crowding]];
    $('#painel-tempo').innerHTML = `<div class="grid grid--3">${blocos.map(([t, v]) => `<div class="card"><p class="card__rotulo">${t}</p><p style="margin:0">${esc(v)}</p></div>`).join('')}</div>
      <p class="faint" style="margin-top:var(--sp-3)">Distâncias estimadas por linha reta (× 1,25 para estrada). Feriados: Nager.Date. Temporada: tendência geral, não medição.</p>`;
  }

  function pChecklist() {
    $('#painel-checklist').innerHTML = `
      <h2>Antes de partir</h2>
      <p class="muted num" id="contagem" aria-live="polite">${checks.size} de ${totalItens} itens · ${pct()}%</p>
      <div class="progresso" role="progressbar" aria-label="Progresso do checklist" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct()}"><span style="width:${pct()}%"></span></div>
      ${plan.checklist.map((g) => `<div class="check-grupo card"><h3>${esc(g.category)}</h3>${g.items.map((i) => `
        <div class="check-item"><input type="checkbox" id="ck-${esc(i.id)}" data-ck="${esc(i.id)}" ${checks.has(i.id) ? 'checked' : ''}><label for="ck-${esc(i.id)}"><span>${esc(i.label)}</span><small>${esc(i.why)} · ${esc(i.timing)}</small></label></div>`).join('')}</div>`).join('')}
      <p class="faint" style="margin-top:var(--sp-4)">Regras de visto e entrada mudam: consulte sempre as fontes oficiais listadas em <a href="#/precos">Preços e condições</a>.</p>`;
    $('#painel-checklist').querySelectorAll('[data-ck]').forEach((cb) => cb.addEventListener('change', () => {
      if (cb.checked) checks.add(cb.dataset.ck); else checks.delete(cb.dataset.ck);
      gravarChecks(plan.id, checks);
      const p = pct();
      $('#contagem').textContent = `${checks.size} de ${totalItens} itens · ${p}%`;
      const bar = $('#painel-checklist .progresso');
      bar.setAttribute('aria-valuenow', p); bar.firstElementChild.style.width = p + '%';
      $('#pct-aba').textContent = p + '%';
      const ct = $('#contagem'); ct.classList.remove('pulsou'); void ct.offsetWidth; ct.classList.add('pulsou');
    }));
  }

  // ---- preços (faixas + links) ----
  let abaPreco = 'passagens';
  function pPrecos() {
    const box = $('#painel-precos');
    const [idaEx, voltaEx] = datasPadrao(brief.month, brief.days);
    const d = plan.destino;
    const temDatas = datas && datas.inicio && datas.fim;
    box.innerHTML = `<p class="muted" style="margin:0">Para ${brief.travelers} adulto(s), saindo de ${esc(plan.origem.nome)}${temDatas ? `, de ${esc(dataBR(datas.inicio))} a ${esc(dataBR(datas.fim))}` : ` — sem datas definidas, os links usam ${esc(dataBR(idaEx))} a ${esc(dataBR(voltaEx))} como exemplo`}.</p><div id="precos-hub"></div>
      <p class="faint" style="margin-top:var(--sp-3)"><a href="#/precos?${qPreco}">Abrir na tela de Preços</a> para mudar origem, datas e aeroportos.</p>`;
    montarPrecos(box.querySelector('#precos-hub'), dados, {
      destino: d ? d.nome : brief.destination, pais: d ? d.cc : '', regiao: plan.regiao, origem: plan.origem.nome, origemUF: plan.origem.uf,
      ida: temDatas ? datas.inicio : idaEx, volta: temDatas ? datas.fim : voltaEx, adultos: brief.travelers, dias: brief.days,
      iataO: plan.origem.iata, iataD: d ? d.iata : '', civitatis: d ? d.civitatis : '', destinoLat: d ? d.lat : null, destinoLon: d ? d.lon : null, transporte: plan.transporte || brief.transport,
    }, { ativa: abaPreco, onTroca: (k) => { abaPreco = k; } });
  }

  // ---- gastos (controle real ligado a este caderno) ----
  function pGastos() {
    const box = $('#painel-gastos');
    const v = viagemDoCaderno(plan.id);
    if (v) {
      box.innerHTML = `<p class="muted" style="margin-top:0">Controle ligado a este caderno. <a href="#/gastos/${esc(v.id)}">Abrir em tela cheia</a>.</p><div id="gastos-embed"></div>`;
      painelViagem(box.querySelector('#gastos-embed'), v.id, { embed: true, signal });
      return;
    }
    const o = plan.options[sel];
    const cats = {};
    o.breakdown.forEach((l) => { const k = l.cat || 'outros'; cats[k] = (cats[k] || 0) + Math.round((l.amountMin + l.amountMax) / 2); });
    box.innerHTML = `<div class="card">
      <h2 style="font-size:1.2rem">Controle de gastos desta viagem</h2>
      <p class="muted">Crie um orçamento por categoria a partir da estimativa da opção <strong>${esc(o.tag)}</strong> (ponto médio de cada faixa, total ${reais(Object.values(cats).reduce((a, b) => a + b, 0))}) e registre os gastos reais durante o planejamento e a viagem.</p>
      <p class="faint">${salvo() ? '' : 'O caderno será salvo neste aparelho para ficar ligado ao controle. '}Você pode ajustar cada categoria depois.</p>
      <div class="acoes"><button type="button" class="btn btn--primario" id="btn-criar-gastos">Criar controle de gastos</button><a class="btn btn--fantasma" href="#/gastos">Minhas viagens</a></div>
    </div>`;
    box.querySelector('#btn-criar-gastos').addEventListener('click', () => {
      if (listarViagens().length >= MAX_VIAGENS) { toast(`Limite de ${MAX_VIAGENS} viagens atingido. Apague uma em Gastos.`, 'erro'); return; }
      if (!salvo()) {
        const r = salvarCaderno(brief, plan, { datas });
        if (!r.ok) { toast('Não foi possível salvar o caderno: armazenamento cheio ou bloqueado.', 'erro'); return; }
        $('#btn-salvar').textContent = 'Salvo neste aparelho';
      }
      const nv = novaViagem({ id: uid(), nome: plan.title, destino: plan.destino ? plan.destino.nome : brief.destination, inicio: datas ? datas.inicio || '' : '', fim: datas ? datas.fim || '' : '', pessoas: brief.travelers, dias: brief.days, cadernoId: plan.id, orcamento: cats });
      if (!salvarViagem(nv)) { toast('Não foi possível criar o controle: armazenamento cheio ou bloqueado.', 'erro'); return; }
      toast('Controle de gastos criado com o orçamento estimado.', 'ok');
      pGastos();
      box.querySelector('h2, .kpis')?.setAttribute('tabindex', '-1');
    });
  }

  pOpcoes(); pClima(); pDinheiro(); pPrecos(); pGastos(); pTempo(); pChecklist();
  carregarCapa(); carregarParadas();
  ligarVideos(el); ligarCarrossel(el, { signal }); ligarParalaxe($('#c-hero'), { signal }); ligarRevelar(el, { signal });

  // ---- barra de ações no celular ----
  {
    const barra = document.createElement('div');
    barra.className = 'barra-acoes'; barra.setAttribute('data-compartilhar', ''); barra.setAttribute('role', 'region'); barra.setAttribute('aria-label', 'Ações rápidas do caderno');
    barra.innerHTML = `<a class="btn btn--whats" data-whats href="https://wa.me/" target="_blank" rel="noopener noreferrer">${icone('i-whats')} WhatsApp<span class="sr-only"> (abre em nova aba)</span></a>
      <button type="button" class="btn btn--primario" data-b-salvar>${salvo() ? 'Salvo' : 'Salvar'}</button>
      <button type="button" class="btn btn--secundario" data-b-reservar>Reservar</button>`;
    el.appendChild(barra);
    ligarBarraAcoes(barra, $('#c-hero'), signal);
    barra.querySelector('[data-b-salvar]').addEventListener('click', () => { $('#btn-salvar').click(); barra.querySelector('[data-b-salvar]').textContent = 'Salvo'; });
    barra.querySelector('[data-b-reservar]').addEventListener('click', () => { const a = $('#aba-precos'); a.click(); a.scrollIntoView({ behavior: prefereMenosMovimento() ? 'auto' : 'smooth', block: 'center' }); });
  }

  // ---- compartilhar (link reconstrói o mesmo caderno) ----
  ligarCompartilhar(el, () => {
    const o = plan.options[sel];
    const url = urlCompleta(`#/planejar?b=${codificarBrief(brief)}`);
    const texto = [
      `🧭 Roteiro sugerido: ${plan.title}`,
      `${brief.days} dias · ${brief.travelers} ${brief.travelers > 1 ? 'viajantes' : 'viajante'} · ${mesRotulo(brief.month)}`,
      `Estimativa (${o.tag}): ${faixa(o.estimatedMin, o.estimatedMax)} para o grupo`,
      c.tempMinC != null ? `Clima no mês: ${c.tempMinC}° a ${c.tempMaxC} °C` : '',
      'Abra o link para gerar o mesmo caderno no Farol:',
    ].filter(Boolean).join('\n');
    return { titulo: plan.title, texto, url };
  });

  // ---- datas ----
  $('#form-datas').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const ini = $('#d-ida').value, fim = $('#d-volta').value;
    const erro = $('#d-erro'); erro.textContent = '';
    if ((ini && !fim) || (!ini && fim)) { erro.textContent = 'Informe ida e volta (ou deixe as duas vazias).'; return; }
    if (ini && fim && fim < ini) { erro.textContent = 'A volta precisa ser depois da ida.'; $('#d-volta').focus(); return; }
    datas = ini ? { inicio: ini, fim } : null;
    if (salvo()) { definirDatasCaderno(plan.id, datas); toast(datas ? `Datas salvas${diasAte(ini) > 0 ? `: faltam ${diasAte(ini)} dia(s)` : ''}.` : 'Datas removidas.', 'ok'); }
    else { definirAtual(brief, plan, datas); toast('Datas guardadas nesta sessão. Salve o caderno para mantê-las neste aparelho.', 'info', 6000); }
    pPrecos(); pGastos();
  });
  el.querySelectorAll('[data-ir-aba]').forEach((b) => b.addEventListener('click', () => {
    const alvo = el.querySelector(`#aba-${b.dataset.irAba}`);
    if (alvo) { alvo.click(); alvo.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }));

  // ---- abas acessíveis (setas, Home, End) ----
  const abas = [...el.querySelectorAll('.abas[aria-label="Seções do caderno"] > [role="tab"]')];
  const ativar = (btn, focar = true) => {
    abas.forEach((b) => { const on = b === btn; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; el.querySelector('#' + b.getAttribute('aria-controls')).hidden = !on; });
    if (focar) btn.focus();
  };
  abas.forEach((b, i) => {
    b.addEventListener('click', () => ativar(b));
    b.addEventListener('keydown', (ev) => {
      let j = null;
      if (ev.key === 'ArrowRight') j = (i + 1) % abas.length;
      if (ev.key === 'ArrowLeft') j = (i - 1 + abas.length) % abas.length;
      if (ev.key === 'Home') j = 0;
      if (ev.key === 'End') j = abas.length - 1;
      if (j !== null) { ev.preventDefault(); ativar(abas[j]); }
    });
  });

  // ---- ações ----
  $('#btn-salvar').addEventListener('click', () => {
    const { ok, removido } = salvarCaderno(brief, plan, { datas });
    if (!ok) { toast('Não foi possível salvar: o armazenamento do navegador está cheio ou bloqueado.', 'erro'); return; }
    $('#btn-salvar').textContent = 'Salvo neste aparelho';
    toast(removido ? `Caderno salvo. O limite é ${MAX_CADERNOS}; o mais antigo (“${removido}”) saiu da lista.` : 'Caderno salvo neste aparelho.', 'ok');
  });
  $('#btn-nova')?.addEventListener('click', () => { limparAtual(); location.hash = '#/planejar?novo=1'; });
  $('#btn-apagar')?.addEventListener('click', async () => {
    const v = viagemDoCaderno(plan.id);
    const ok = await confirmar({ titulo: 'Apagar caderno?', texto: `“${plan.title}” e o progresso do checklist serão removidos deste aparelho.${v ? ` O controle de gastos ligado a ele (${v.gastos.length} gasto(s)) continua em Minhas viagens.` : ''}`, ok: 'Apagar caderno' });
    if (!ok) return;
    apagarCaderno(plan.id);
    if (v) { v.cadernoId = null; salvarViagem(v); }
    toast('Caderno apagado.', 'ok');
    location.hash = '#/cadernos';
  });
}
