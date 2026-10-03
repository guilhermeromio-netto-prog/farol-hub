// Tela: Destino (painel ao vivo) — Farol · byGui
import { previsao, qualidadeAr, climaAnoPassado, cotacaoBRL, moedasSuportadas, proximosFeriados, wikiResumo, lugarPorCoordenada, fotosWiki, pontosTuristicos, midiaDestino, creditosCommons, variante, lerCacheLocal, msgErro } from '../api.js';
import { esc, icone, bandeira, reais, faixa, carregandoHTML, erroHTML, vazioHTML, numero, diaSemana, dataCurta, dataLonga, dataBR, MESES_CURTOS } from '../ui.js';
import { htmlCompartilhar, ligarCompartilhar, urlCompleta } from '../share.js';
import { montarPrecos } from './precos-hub.js';
import { datasPadrao } from '../links.js';
import { GRUPOS, organizar, raioPara } from '../pontos.js';
import { galeriaHTML, ligarGaleria, abrirLightbox, creditoHTML, ligarImagens, ligarCarrossel, videoCardHTML, ligarVideos, ytBusca, ligarRevelar, ligarParalaxe } from '../midia.js';
import { estimarRapido, destinosQueCabem, veredito, lerBolso, gravarBolso, primeiraFrase, valorBR } from '../inspiracao.js';
import { ligarBarraAcoes } from './comum.js';
import { tempoTexto, tempoIcone, aqiEuropeu, uvTexto, estatisticaMensal, melhoresMeses, condicoesProximas, descreverEstacao } from '../clima.js';

const moedaNome = (c) => { try { return new Intl.DisplayNames(['pt-BR'], { type: 'currency' }).of(c); } catch { return c; } };
const hora = (iso) => (iso ? iso.slice(11, 16) : '—');

function montarErro(box, e, tentar) {
  box.innerHTML = erroHTML(msgErro(e));
  box.querySelector('[data-acao="tentar"]')?.addEventListener('click', tentar);
}

export function render(ctx) {
  const { el, params, query, dados, signal } = ctx;
  const id = params[0] || '';
  const dest = dados.destaques.find((d) => d.slug === id);
  let lugar = null;
  if (dest) lugar = { slug: dest.slug, nome: dest.nome, lat: dest.lat, lon: dest.lon, cc: dest.pais, regiao: dest.local, wiki: dest.wiki, iata: dest.iata, resumo: dest.resumo, tipo: dest.tipo, civitatis: dest.civitatis };
  else {
    const m = id.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
    if (m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180) {
      lugar = { nome: query.get('nome') || '', lat: +m[1], lon: +m[2], cc: (query.get('pais') || '').toUpperCase(), regiao: query.get('regiao') || '' };
    }
  }
  if (!lugar) {
    ctx.titulo('Destino não encontrado');
    el.innerHTML = `<section class="shell"><a class="voltar" href="#/">${icone('i-voltar')} Início</a><h1>Destino não encontrado</h1><p class="lead">O endereço não aponta para um destino conhecido nem para coordenadas válidas.</p><a class="btn btn--primario" href="#/">Buscar um destino</a></section>`;
    return;
  }

  const desenhar = () => {
    const pais = dados.paises[lugar.cc];
    const raio = raioPara(lugar.tipo);
    const nome = lugar.nome || 'Local selecionado';
    ctx.titulo(nome);
    const qPlan = new URLSearchParams({ destino: nome, lat: lugar.lat, lon: lugar.lon });
    const qPreco = new URLSearchParams({ destino: nome });
    if (lugar.cc) qPreco.set('pais', lugar.cc);
    if (lugar.iata) qPreco.set('iata', lugar.iata);
    const videos = (lugar.slug && (dados.videos.porDestino[lugar.slug] || [])) || [];
    const buscaVideo = ytBusca(`${nome} o que fazer roteiro de viagem`);
    const vt = ctx.vt ? ' style="view-transition-name: destino-foto"' : '';
    el.innerHTML = `
    <section class="hero-full" id="hero" aria-labelledby="titulo-destino">
      <div class="hero-full__midia foto"${vt}><img id="hero-img" data-paralaxe alt="" decoding="async" fetchpriority="high"></div>
      <div class="hero-full__veu" aria-hidden="true"></div>
      <div class="shell hero-full__conteudo">
        <a class="voltar voltar--sobre" href="#/">${icone('i-voltar')} Início</a>
        <p class="kicker kicker--sobre">${lugar.cc ? `<img src="${bandeira(lugar.cc)}" alt="" width="20" height="14" style="display:inline-block;vertical-align:-2px;border-radius:3px;margin-right:6px">` : ''}${esc([lugar.regiao, pais && pais.n].filter((x, i, arr) => x && arr.indexOf(x) === i).join(' · ') || 'Painel do destino')}</p>
        <h1 id="titulo-destino">${esc(nome)}</h1>
        ${lugar.resumo ? `<p class="hero-full__resumo">${esc(lugar.resumo)}</p>` : ''}
        <div class="acoes hero-full__acoes">
          <a class="btn btn--primario" href="#/planejar?${qPlan}">Planejar viagem para cá</a>
          <button type="button" class="btn btn--vidro" data-rolar>Ver preços</button>
          <button type="button" class="btn btn--vidro" data-fotos hidden>${icone('i-foto')} Ver fotos</button>
        </div>
      </div>
      <p class="hero-full__cred" id="hero-cred" hidden></p>
    </section>

    <div class="shell com-barra">
      <div class="linha-acoes" style="margin-top:var(--sp-4)"><span class="faint">Compartilhar este painel:</span>${htmlCompartilhar()}</div>

      <section class="secao revela" aria-labelledby="t-insp" style="margin-top:var(--sp-6)">
        <div class="inspira card">
          <div class="inspira__topo">
            <p class="kicker">Por que ir</p>
            <h2 id="t-insp">${esc(nome)} em um olhar</h2>
            <blockquote class="inspira__frase" id="insp-frase" hidden></blockquote>
          </div>
          <ul class="inspira__stats lista-limpa">
            <li><span class="inspira__rot">Agora</span><strong id="insp-agora">${icone('i-nuvem')} carregando…</strong></li>
            <li><span class="inspira__rot">Melhor época</span><strong id="insp-epoca">${dados.dicasPorTipo[lugar.tipo] ? esc(primeiraFrase(dados.dicasPorTipo[lugar.tipo].epoca, 90)) : 'Veja o clima medido abaixo'}</strong></li>
            <li><span class="inspira__rot">Custo estimado</span><strong id="insp-custo">—</strong><span class="selo-estimativa">estimativa</span></li>
          </ul>
          <form class="bolso" id="form-bolso" novalidate aria-labelledby="t-bolso">
            <h3 id="t-bolso">Cabe no seu bolso?</h3>
            <p class="faint" style="margin:0 0 var(--sp-3)">Informe o que você pode gastar. O Farol compara com a estimativa para ${esc(nome)} e com os outros destinos da lista — sem inventar desconto.</p>
            <div class="linha-form linha-form--3">
              <div class="campo"><label for="b-orc">Orçamento total (R$)</label><input class="input num" id="b-orc" inputmode="numeric" autocomplete="off" placeholder="Ex.: 12000"></div>
              <div class="campo"><label for="b-dias">Dias</label><input class="input num" id="b-dias" type="number" min="2" max="30" value="7"></div>
              <div class="campo"><label for="b-pes">Pessoas</label><input class="input num" id="b-pes" type="number" min="1" max="9" value="2"></div>
            </div>
            <div id="bolso-saida" class="bolso__saida" aria-live="polite"></div>
          </form>
        </div>
      </section>

      <section class="secao revela" aria-labelledby="t-galeria" id="sec-galeria">
        <div class="secao__cab"><h2 id="t-galeria">Fotos de ${esc(nome)}</h2><span class="faint">Wikipédia e Wikimedia Commons · crédito em cada foto</span></div>
        <div id="box-galeria">${carregandoHTML('Buscando fotos livres', 1)}<div class="galeria galeria--sk" aria-hidden="true"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div></div>
      </section>

      <section class="secao revela" aria-labelledby="t-videos" id="sec-videos">
        <div class="secao__cab"><h2 id="t-videos">Veja como é</h2><a class="btn btn--fantasma btn--pequeno" href="${esc(buscaVideo)}" target="_blank" rel="noopener noreferrer">Buscar vídeos no YouTube ${icone('i-externo')}<span class="sr-only"> (abre em nova aba)</span></a></div>
        ${videos.length ? `<div class="carrossel" data-carrossel>
          <div class="carrossel__pista videos" tabindex="0" role="region" aria-label="Vídeos sobre ${esc(nome)} — role para o lado ou use as setas do teclado">${videos.map((v) => videoCardHTML(v)).join('')}</div>
          <div class="carrossel__ctl"><button type="button" class="btn-icone" data-c-prev aria-label="Vídeos anteriores">${icone('i-esq')}</button><button type="button" class="btn-icone" data-c-next aria-label="Próximos vídeos">${icone('i-dir')}</button></div>
        </div>
        <p class="faint" style="margin-top:var(--sp-3)">Vídeos de criadores independentes, conferidos em ${esc(dataBR(dados.videos.verificadoEm))}. O player só carrega (sem cookies) quando você clica. Preços e regras citados podem estar desatualizados — confira abaixo e nos sites oficiais.</p>`
        : `<div class="vazio">Ainda não temos vídeos conferidos para este lugar. O botão acima abre o YouTube já com a busca “${esc(nome)} o que fazer roteiro de viagem”.</div>`}
      </section>

      <section class="secao revela" aria-labelledby="t-agora">
        <h2 id="t-agora">Agora</h2>
        <div class="card" id="box-agora">${carregandoHTML('Carregando o tempo agora', 3)}</div>
      </section>

      <section class="secao" aria-labelledby="t-prev">
        <div class="secao__cab"><h2 id="t-prev">Previsão de 16 dias</h2><span class="faint">Role para o lado · dias destacados são os mais agradáveis</span></div>
        <div id="box-prev">${carregandoHTML('Carregando previsão', 2)}</div>
      </section>

      <section class="secao" aria-labelledby="t-epoca">
        <h2 id="t-epoca">Melhor época e condições</h2>
        <div class="grid grid--2">
          <div class="card" id="box-cond">${carregandoHTML('Analisando os próximos dias', 4)}</div>
          <div class="card" id="box-ano">${carregandoHTML('Carregando clima do último ano', 4)}</div>
        </div>
      </section>

      <section class="secao" aria-labelledby="t-pontos">
        <div class="secao__cab"><h2 id="t-pontos">O que ver por perto</h2><span class="faint">Fonte: OpenStreetMap (colaborativo) · raio de ${numero(raio / 1000, 1)} km</span></div>
        <div id="box-pontos">${carregandoHTML('Buscando pontos turísticos no OpenStreetMap', 3)}</div>
      </section>

      <section class="secao" aria-labelledby="t-precos" id="precos-destino">
        <div class="secao__cab"><h2 id="t-precos">Preços e reservas</h2><a class="btn btn--fantasma btn--pequeno" href="#/precos?${qPreco}">Ajustar origem e datas ${icone('i-seta')}</a></div>
        <p class="faint">Saindo de São Paulo, 2 adultos, datas de exemplo. Os links abrem os sites oficiais com a busca preenchida.</p>
        <div id="box-precos"></div>
      </section>

      <section class="secao" aria-labelledby="t-dicas-esp">
        <h2 id="t-dicas-esp">Dicas de especialista</h2>
        <div id="box-dicas"></div>
      </section>

      <section class="secao" aria-labelledby="t-local">
        <h2 id="t-local">País, dinheiro e ar</h2>
        <div class="grid grid--3">
          <div class="card" id="box-pais"></div>
          <div class="card" id="box-cambio">${carregandoHTML('Carregando câmbio', 3)}</div>
          <div class="card" id="box-ar">${carregandoHTML('Carregando qualidade do ar', 3)}</div>
        </div>
      </section>

      <section class="secao" aria-labelledby="t-feriados">
        <div class="secao__cab"><h2 id="t-feriados">Feriados nacionais nos próximos 6 meses</h2><span class="faint">Fonte: Nager.Date · nomes no idioma local</span></div>
        <div class="card" id="box-feriados">${carregandoHTML('Carregando feriados', 4)}</div>
      </section>

      <section class="secao" aria-labelledby="t-wiki">
        <h2 id="t-wiki">Sobre o lugar</h2>
        <div class="card" id="box-wiki">${carregandoHTML('Carregando resumo da Wikipédia', 4)}</div>
      </section>
    </div>`;

    const $ = (s) => el.querySelector(s);
    const { lat, lon } = lugar;
    let resumoTempo = '';
    el.querySelector('[data-rolar]')?.addEventListener('click', (ev) => { ev.preventDefault(); const h = $('#t-precos'); h.setAttribute('tabindex', '-1'); h.scrollIntoView({ behavior: 'smooth', block: 'start' }); h.focus({ preventScroll: true }); });
    ligarCompartilhar(el, () => {
      const hash = dest ? `#/destino/${dest.slug}` : location.hash;
      return { titulo: `${nome} · Farol`, texto: [`📍 ${nome}${pais ? ` (${pais.n})` : ''}`, resumoTempo, 'Clima ao vivo, câmbio, feriados, pontos turísticos e preços estimados no Farol:'].filter(Boolean).join('\n'), url: urlCompleta(hash) };
    });

    // ----- Fotos (Wikipédia + Wikimedia Commons, com crédito) -----
    const heroBox = $('#hero'), heroImg = $('#hero-img'), heroCred = $('#hero-cred');
    const lqip = (() => { try { return sessionStorage.getItem('farol:thumb:' + lugar.wiki) || ''; } catch { return ''; } })();
    if (lqip) { heroImg.src = lqip; heroImg.alt = ''; heroImg.classList.add('is-lqip', 'is-ok'); heroBox.classList.add('tem-foto'); }
    let fotosTodas = [];
    function heroSemFoto() { if (!heroImg.src) heroBox.classList.add('is-vazio'); }
    function pintarHero(x) {
      const alt = `Foto de ${nome}${x.f.descricao ? ': ' + x.f.descricao : ''}`.slice(0, 220);
      const srcset = `${variante(x.f, 960)} 960w, ${variante(x.f, 1920)} 1920w`;
      const pre = new Image();
      pre.sizes = '100vw'; pre.srcset = srcset;
      pre.onload = () => {
        heroImg.sizes = '100vw'; heroImg.srcset = srcset; heroImg.src = variante(x.f, 1280);
        heroImg.alt = alt; heroImg.classList.remove('is-lqip'); heroImg.classList.add('is-ok'); heroBox.classList.add('tem-foto'); heroBox.classList.remove('is-vazio');
      };
      pre.onerror = heroSemFoto;
      pre.src = variante(x.f, 1280);
      heroCred.hidden = false; heroCred.innerHTML = creditoHTML(x.f);
    }
    async function carregarMidia(titulo) {
      const box = $('#box-galeria');
      try {
        const m = await midiaDestino(titulo, { signal });
        if (signal.aborted) return;
        fotosTodas = [m.hero, ...m.galeria];
        pintarHero(m.hero);
        const btn = $('[data-fotos]'); btn.hidden = false;
        btn.addEventListener('click', () => abrirLightbox(fotosTodas, 0, nome, btn));
        if (m.galeria.length) {
          box.innerHTML = galeriaHTML(m.galeria, nome, `Fotos de ${nome}`, 1);
          ligarGaleria(box, fotosTodas, nome, { signal });
        } else box.innerHTML = vazioHTML('A Wikipédia tem só uma foto livre deste lugar — ela está no topo da página.');
      } catch (e) {
        if (e.status === -1) return;
        heroSemFoto();
        if (heroImg.classList.contains('is-lqip')) { heroCred.hidden = false; heroCred.innerHTML = `Foto: <a href="https://pt.wikipedia.org/wiki/${encodeURIComponent(titulo.replace(/ /g, '_'))}" target="_blank" rel="noopener noreferrer">Wikipédia<span class="sr-only"> (abre em nova aba)</span></a> (autor e licença na página do arquivo)`; }
        box.innerHTML = e.vazio ? vazioHTML('Não encontramos fotos livres em boa qualidade para este lugar. Sem imagens genéricas: preferimos deixar vazio a mostrar algo que não seja daqui.')
          : erroHTML(e.status === 429 ? 'O Wikimedia Commons pediu uma pausa (muitos pedidos). As fotos aparecem quando você tentar de novo.' : msgErro(e));
        box.querySelector('[data-acao="tentar"]')?.addEventListener('click', () => carregarMidia(titulo));
      }
    }
    if (lugar.wiki) {
      if (!lqip) fotosWiki([lugar.wiki], { tamanho: 500, signal }).then((m) => { const f = m[lugar.wiki]; if (f && !signal.aborted && !heroImg.classList.contains('is-ok')) { heroImg.src = f.src; heroImg.classList.add('is-lqip', 'is-ok'); heroBox.classList.add('tem-foto'); } }).catch(() => {});
      carregarMidia(lugar.wiki);
    }
    ligarImagens(el);

    // ----- Pontos turísticos (OpenStreetMap) -----
    let grupoSel = 'todos', pontos = [];
    const fotosPonto = {};
    function desenharPontos() {
      const box = $('#box-pontos');
      const lista = pontos.filter((p) => grupoSel === 'todos' || p.grupo === grupoSel).slice(0, 24);
      const presentes = new Set(pontos.map((p) => p.grupo));
      box.innerHTML = `<div class="filtros" role="group" aria-label="Filtrar por tipo">${GRUPOS.filter((g) => g.id === 'todos' || presentes.has(g.id)).map((g) => `<button type="button" class="chip" data-grupo="${g.id}" aria-pressed="${g.id === grupoSel}">${g.rotulo}</button>`).join('')}</div>
        ${lista.length ? `<ul class="pontos">${lista.map((p) => `<li class="card card--tight ponto">
          ${p.wikiPt && fotosPonto[p.wikiPt] ? `<div class="ponto__foto foto"><img data-prog src="${esc(fotosPonto[p.wikiPt].src)}" alt="Foto de ${esc(p.nome)}" loading="lazy" decoding="async" width="${fotosPonto[p.wikiPt].largura}" height="${fotosPonto[p.wikiPt].altura}"><span class="ponto__cred" data-cred="${esc(fotosPonto[p.wikiPt].arquivo)}">Foto: Wikipédia</span></div>` : ''}
          <p class="card__rotulo" style="margin:0">${esc(p.tipo)} · <span class="num">${p.dist < 1 ? numero(p.dist * 1000) + ' m' : numero(p.dist, 1) + ' km'}</span></p>
          <h3>${esc(p.nome)}</h3>
          <div class="ponto__links">
            <a href="https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(6)},${p.lon.toFixed(6)}" target="_blank" rel="noopener noreferrer">Google Maps<span class="sr-only"> para ${esc(p.nome)} (abre em nova aba)</span></a>
            <a href="https://www.openstreetmap.org/${p.id}" target="_blank" rel="noopener noreferrer">OpenStreetMap<span class="sr-only"> para ${esc(p.nome)} (abre em nova aba)</span></a>
            ${p.wikiPt ? `<a href="https://pt.wikipedia.org/wiki/${encodeURIComponent(p.wikiPt.replace(/ /g, '_'))}" target="_blank" rel="noopener noreferrer">Wikipédia<span class="sr-only"> sobre ${esc(p.nome)} (abre em nova aba)</span></a>` : ''}
          </div></li>`).join('')}</ul>` : vazioHTML('Nenhum ponto deste tipo no raio pesquisado.')}
        <p class="faint" style="margin-top:var(--sp-3)">${pontos.length} lugares com nome no OpenStreetMap; mostramos até 24, priorizando os que têm artigo na Wikipédia e os mais perto. Dados colaborativos: confira horários e acesso antes de ir.</p>`;
      box.querySelectorAll('[data-grupo]').forEach((b) => b.addEventListener('click', () => { grupoSel = b.dataset.grupo; desenharPontos(); $(`#box-pontos [data-grupo="${grupoSel}"]`)?.focus(); }));
      ligarImagens(box);
      creditarPontos(box);
    }
    const creditos = {};
    async function creditarPontos(box) {
      const els = [...box.querySelectorAll('[data-cred]')].filter((e) => e.dataset.cred);
      const falta = els.map((e) => e.dataset.cred).filter((n) => !creditos[n]);
      if (falta.length) { try { Object.assign(creditos, await creditosCommons(falta, { signal })); } catch {} }
      els.forEach((e) => { const f = creditos[e.dataset.cred.replace(/_/g, ' ')]; if (f) e.innerHTML = creditoHTML(f, { curto: true }); });
    }
    async function fotosDosPontos() {
      const titulos = pontos.filter((p) => p.wikiPt).slice(0, 30).map((p) => p.wikiPt.replace(/ /g, '_'));
      if (!titulos.length) return;
      try {
        const m = await fotosWiki(titulos, { tamanho: 500, signal });
        if (signal.aborted) return;
        Object.entries(m).forEach(([k, v]) => { fotosPonto[k.replace(/_/g, ' ')] = v; });
        desenharPontos();
      } catch { /* sem fotos: os cartões continuam úteis */ }
    }
    async function carregarPontos() {
      const box = $('#box-pontos');
      box.innerHTML = carregandoHTML('Buscando pontos turísticos no OpenStreetMap', 3);
      try {
        const r = await pontosTuristicos(lat, lon, raio, { signal, onTentativa: (i) => { if (i && !signal.aborted) box.querySelector('.sr-only') && (box.querySelector('.sr-only').textContent = 'Servidor principal falhou; tentando o servidor reserva do OpenStreetMap'); } });
        if (signal.aborted) return;
        pontos = organizar(r.elementos, { lat, lon }, raio);
        if (!pontos.length) { box.innerHTML = vazioHTML('O OpenStreetMap não tem pontos turísticos com nome neste raio.'); return; }
        desenharPontos();
        fotosDosPontos();
      } catch (e) {
        if (e.status === -1) return;
        montarErro(box, e, carregarPontos);
      }
    }

    // ----- Preços -----
    const [idaEx, voltaEx] = datasPadrao(null, 8);
    montarPrecos($('#box-precos'), dados, { destino: nome, pais: lugar.cc, origem: 'São Paulo', origemUF: 'SP', ida: idaEx, volta: voltaEx, adultos: 2, iataO: 'SAO', iataD: lugar.iata || '', civitatis: lugar.civitatis || '', destinoLat: lat, destinoLon: lon });

    // ----- Dicas de especialista por tipo -----
    let tipoSel = lugar.tipo || '';
    function desenharDicas() {
      const box = $('#box-dicas');
      const tipos = Object.entries(dados.dicasPorTipo);
      const dz = dados.dicasPorTipo[tipoSel];
      box.innerHTML = `${lugar.tipo ? '' : `<p class="muted">Que tipo de destino é ${esc(nome)}? Escolha para ver as dicas.</p>`}
        ${lugar.tipo ? `<p class="faint">Tipo de destino: <span class="selo">${esc(dz.rotulo)}</span></p>` : `<div class="filtros" role="group" aria-label="Tipo de destino">${tipos.map(([k, v]) => `<button type="button" class="chip" data-tipo="${k}" aria-pressed="${k === tipoSel}">${esc(v.rotulo)}</button>`).join('')}</div>`}
        ${dz ? `<div class="grid grid--3">
          <div class="card"><p class="card__rotulo">Melhor época</p><p style="margin:0">${esc(dz.epoca)}</p></div>
          <div class="card"><p class="card__rotulo">Como economizar</p><ul class="lista-marcada lista-limpa">${dz.economizar.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
          <div class="card"><p class="card__rotulo">O que evitar</p><ul class="lista-marcada lista-limpa">${dz.evitar.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        </div><p class="faint" style="margin-top:var(--sp-3)">Orientações gerais de especialista para ${esc(dz.rotulo.toLowerCase())}, escritas pela equipe do Farol. Combine com o clima medido acima.</p>` : ''}`;
      box.querySelectorAll('[data-tipo]').forEach((b) => b.addEventListener('click', () => { tipoSel = b.dataset.tipo; desenharDicas(); $(`#box-dicas [data-tipo="${tipoSel}"]`)?.focus(); }));
    }
    desenharDicas();

    // ----- País (tabela local derivada de mledoze/countries) -----
    const bp = $('#box-pais');
    if (pais) {
      bp.innerHTML = `<p class="card__rotulo">País</p>
        <div class="pais"><img src="${bandeira(lugar.cc, 80)}" alt="Bandeira: ${esc(pais.n)}" width="56" height="38"><div><h3 style="margin:0">${esc(pais.n)}</h3><span class="faint">Código ${esc(lugar.cc)}${pais.d ? ' · DDI ' + esc(pais.d) : ''}</span></div></div>
        <ul class="lista-limpa lista-linhas" style="margin-top:var(--sp-3)">
          <li><span class="muted">Moeda</span><strong style="text-align:right">${esc(pais.m.map((c) => `${moedaNome(c)} (${c})`).join(', ') || '—')}</strong></li>
          <li><span class="muted">Idiomas</span><strong style="text-align:right">${esc(pais.i.join(', ') || '—')}</strong></li>
        </ul>`;
    } else {
      bp.innerHTML = `<p class="card__rotulo">País</p>${vazioHTML('Não identificamos o país deste ponto.')}`;
    }

    // ----- Tempo agora + previsão + condições -----
    let relogio = null;
    async function carregarTempo() {
      ['#box-agora', '#box-prev', '#box-cond'].forEach((s) => { $(s).innerHTML = carregandoHTML('Carregando', 3); });
      try {
        const p = await previsao(lat, lon, { signal });
        if (signal.aborted) return;
        const c = p.current, d = p.daily;
        const tz = p.timezone;
        const horaLocal = () => new Date().toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
        const dataLocal = () => new Date().toLocaleDateString('pt-BR', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' });
        const offH = p.utc_offset_seconds / 3600;
        const brOff = -3; const dif = offH - brOff;
        $('#box-agora').innerHTML = `
          <div class="agora">
            <div class="agora__temp">${icone(tempoIcone(c.weather_code))}<div><div class="grau">${Math.round(c.temperature_2m)}°</div><div class="muted">${esc(tempoTexto(c.weather_code))}</div></div></div>
            <dl class="dados-mini">
              <div><dt>Sensação</dt><dd>${Math.round(c.apparent_temperature)}°C</dd></div>
              <div><dt>Umidade</dt><dd>${Math.round(c.relative_humidity_2m)}%</dd></div>
              <div><dt>Vento</dt><dd>${Math.round(c.wind_speed_10m)} km/h</dd></div>
              <div><dt>Hoje</dt><dd>${Math.round(d.temperature_2m_min[0])}° / ${Math.round(d.temperature_2m_max[0])}°</dd></div>
              <div><dt>Nascer do sol</dt><dd>${hora(d.sunrise[0])}</dd></div>
              <div><dt>Pôr do sol</dt><dd>${hora(d.sunset[0])}</dd></div>
              <div><dt>Hora local</dt><dd><span id="relogio">${horaLocal()}</span></dd></div>
              <div><dt>Fuso</dt><dd>${esc(p.timezone_abbreviation)}</dd></div>
            </dl>
          </div>
          <p class="faint" style="margin:var(--sp-3) 0 0">${esc(dataLocal())} · ${esc(tz.replace(/_/g, ' '))} · ${dif === 0 ? 'mesmo horário de Brasília' : `${dif > 0 ? '+' : ''}${numero(dif, Number.isInteger(dif) ? 0 : 1)} h em relação a Brasília`}. Fonte: Open-Meteo.</p>`;
        clearInterval(relogio);
        relogio = setInterval(() => { const r = el.querySelector('#relogio'); if (!r || signal.aborted) return clearInterval(relogio); r.textContent = horaLocal(); }, 30000);
        signal.addEventListener('abort', () => clearInterval(relogio), { once: true });

        { const ia = $('#insp-agora'); if (ia) ia.innerHTML = `${icone(tempoIcone(c.weather_code))} ${Math.round(c.temperature_2m)}° · ${esc(tempoTexto(c.weather_code))}`; }
        const cond = condicoesProximas(p);
        resumoTempo = `Agora: ${Math.round(c.temperature_2m)} °C, ${tempoTexto(c.weather_code).toLowerCase()}. Próximos 16 dias: ${Math.round(cond.tmin)}° a ${Math.round(cond.tmax)} °C.`;
        const bons = new Set(cond.bons.map((x) => x.data));
        $('#box-prev').innerHTML = `<ul class="previsao" tabindex="0" aria-label="Previsão diária, role horizontalmente">${d.time.map((t, i) => `
          <li class="${bons.has(t) ? 'is-bom' : ''}">
            <div class="dia">${i === 0 ? 'Hoje' : esc(diaSemana(t))}<br><span class="faint">${esc(dataCurta(t))}</span></div>
            ${icone(tempoIcone(d.weather_code[i]))}
            <span class="sr-only">${esc(tempoTexto(d.weather_code[i]))}. Máxima</span>
            <div class="max">${Math.round(d.temperature_2m_max[i])}°</div>
            <span class="sr-only">mínima</span><div class="min">${Math.round(d.temperature_2m_min[i])}°</div>
            <div class="chuva">${d.precipitation_probability_max[i] ?? '—'}%<span class="sr-only"> de chance de chuva</span></div>
          </li>`).join('')}</ul>`;

        const alertas = [];
        if (cond.chuvosos) alertas.push(`<li><span class="selo selo--aviso">Chuva</span> ${cond.chuvosos} dia(s) com 70% ou mais de chance de chuva.</li>`);
        if (cond.quentes) alertas.push(`<li><span class="selo selo--perigo">Calor</span> ${cond.quentes} dia(s) com máxima de 33 °C ou mais.</li>`);
        if (cond.frios) alertas.push(`<li><span class="selo selo--info">Frio</span> ${cond.frios} dia(s) com mínima de 5 °C ou menos.</li>`);
        if (cond.ventosos) alertas.push(`<li><span class="selo selo--aviso">Vento</span> ${cond.ventosos} dia(s) com rajadas acima de 50 km/h.</li>`);
        if (cond.uvAlto) alertas.push(`<li><span class="selo selo--aviso">UV</span> ${cond.uvAlto} dia(s) com índice UV muito alto (8+).</li>`);
        $('#box-cond').innerHTML = `
          <p class="card__rotulo">Próximos 16 dias</p>
          <p class="card__valor num">${Math.round(cond.tmin)}° a ${Math.round(cond.tmax)}°C</p>
          <p class="card__detalhe">Faixa de temperatura prevista.</p>
          <h3 style="margin-top:var(--sp-4)">Melhores dias para sair</h3>
          <ul class="lista-limpa lista-linhas">${cond.bons.map((x) => `<li><span>${esc(dataLonga(x.data))}</span><strong class="num">${Math.round(x.min)}°–${Math.round(x.max)}° · ${x.prob ?? '—'}% chuva</strong></li>`).join('')}</ul>
          <h3 style="margin-top:var(--sp-4)">Atenção</h3>
          ${alertas.length ? `<ul class="lista-limpa" style="display:grid;gap:8px">${alertas.join('')}</ul>` : '<p class="muted">Nenhum alerta relevante de chuva, calor, frio, vento ou UV na previsão.</p>'}
          <p class="faint" style="margin-top:var(--sp-3)">Derivado da previsão Open-Meteo: pontua temperatura média perto de 23 °C, chance de chuva e vento.</p>`;
      } catch (e) {
        if (e.status === -1) return;
        ['#box-agora', '#box-prev', '#box-cond'].forEach((s) => montarErro($(s), e, carregarTempo));
      }
    }

    async function carregarAno() {
      const box = $('#box-ano');
      box.innerHTML = carregandoHTML('Carregando clima do último ano', 4);
      try {
        const arq = await climaAnoPassado(lat, lon, { signal });
        if (signal.aborted) return;
        const st = estatisticaMensal(arq);
        if (!st) { box.innerHTML = vazioHTML('Sem dados históricos para este ponto.'); return; }
        const top = melhoresMeses(st);
        { const ie = $('#insp-epoca'); if (ie) ie.textContent = `${top.map((m) => m.nome).join(', ')} (medido em ${arq.ano})`; }
        const topSet = new Set(top.map((m) => m.mes));
        const maxT = Math.max(...st.filter((m) => m.ok).map((m) => m.max));
        const minT = Math.min(...st.filter((m) => m.ok).map((m) => m.min));
        const esc01 = (v) => Math.max(0.06, (v - Math.min(0, minT)) / ((maxT - Math.min(0, minT)) || 1));
        box.innerHTML = `
          <p class="card__rotulo">Clima registrado em ${arq.ano}</p>
          <p class="card__valor" style="font-size:1.25rem">Melhor janela: ${esc(top.map((m) => m.nome).join(', '))}</p>
          <p class="card__detalhe">Meses com temperatura mais agradável e menos dias de chuva em ${arq.ano}.</p>
          <div class="meses" role="img" aria-label="Temperatura máxima média por mês em ${arq.ano}. ${esc(st.filter((m) => m.ok).map((m) => `${m.nome}: ${Math.round(m.max)} graus, ${m.diasChuva} dias de chuva`).join('; '))}">
            ${st.map((m) => `<div class="mes ${topSet.has(m.mes) ? 'is-melhor' : ''}"><span class="faint num" style="font-size:.66rem">${m.ok ? Math.round(m.max) + '°' : ''}</span><div class="mes__barra" style="height:${m.ok ? Math.round(esc01(m.max) * 100) : 4}%"></div><span class="mes__rot">${MESES_CURTOS[m.mes]}</span></div>`).join('')}
          </div>
          <div class="legenda"><span><i style="background:var(--accent)"></i>Máxima média</span><span><i style="background:var(--ok)"></i>Melhores meses</span></div>
          <div class="tabela-wrap" style="margin-top:var(--sp-4)"><table>
            <caption>Resumo por mês (${arq.ano})</caption>
            <thead><tr><th scope="col">Mês</th><th scope="col" class="num">Mín/Máx</th><th scope="col" class="num">Dias de chuva</th><th scope="col">Estação</th></tr></thead>
            <tbody>${st.filter((m) => m.ok).map((m) => `<tr><th scope="row" style="text-transform:capitalize;font-weight:600">${m.nome}</th><td class="num">${Math.round(m.min)}° / ${Math.round(m.max)}°</td><td class="num">${m.diasChuva}</td><td>${esc(descreverEstacao(lat, m))}</td></tr>`).join('')}</tbody>
          </table></div>
          <p class="faint" style="margin-top:var(--sp-3)">Um único ano de registro (arquivo Open-Meteo), não uma média climatológica de 30 anos.</p>`;
      } catch (e) {
        if (e.status === -1) return;
        montarErro(box, e, carregarAno);
      }
    }

    async function carregarAr() {
      const box = $('#box-ar');
      box.innerHTML = carregandoHTML('Carregando qualidade do ar', 3);
      try {
        const a = await qualidadeAr(lat, lon, { signal });
        if (signal.aborted) return;
        const c = a.current || {};
        const q = aqiEuropeu(c.european_aqi);
        box.innerHTML = `<p class="card__rotulo">Qualidade do ar agora</p>
          <p class="card__valor num">${c.european_aqi ?? '—'} <span class="selo ${q.cls}" style="vertical-align:middle">${q.rotulo}</span></p>
          <p class="card__detalhe">Índice europeu (EAQI): até 40 é bom ou razoável.</p>
          <ul class="lista-limpa lista-linhas" style="margin-top:var(--sp-3)">
            <li><span class="muted">PM2,5</span><strong class="num">${c.pm2_5 != null ? numero(c.pm2_5, 1) + ' µg/m³' : '—'}</strong></li>
            <li><span class="muted">PM10</span><strong class="num">${c.pm10 != null ? numero(c.pm10, 1) + ' µg/m³' : '—'}</strong></li>
            <li><span class="muted">Índice UV</span><strong class="num">${c.uv_index != null ? numero(c.uv_index, 1) + ' · ' + uvTexto(c.uv_index) : '—'}</strong></li>
          </ul>`;
      } catch (e) {
        if (e.status === -1) return;
        montarErro(box, e, carregarAr);
      }
    }

    async function carregarCambio() {
      const box = $('#box-cambio');
      if (!pais || !pais.m.length) { box.innerHTML = `<p class="card__rotulo">Câmbio</p>${vazioHTML('Moeda local não identificada.')}`; return; }
      const moeda = pais.m[0];
      if (moeda === 'BRL') { box.innerHTML = `<p class="card__rotulo">Câmbio</p><p class="card__valor">Real (BRL)</p><p class="card__detalhe">A moeda local é o real — sem conversão.</p>`; return; }
      box.innerHTML = carregandoHTML('Carregando câmbio', 3);
      try {
        const { taxa, data } = await cotacaoBRL(moeda, { signal });
        if (signal.aborted) return;
        const simb = pais.s[0] || moeda;
        const exemplos = [10, 100, 1000].map((v) => `<li><span class="muted num">${numero(v)} ${esc(moeda)}</span><strong class="num">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v * taxa)}</strong></li>`).join('');
        box.innerHTML = `<p class="card__rotulo">Câmbio de referência</p>
          <p class="card__valor num">1 ${esc(moeda)} = ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: taxa < 0.1 ? 4 : 2 }).format(taxa)}</p>
          <p class="card__detalhe">${esc(moedaNome(moeda))} (${esc(simb)}) · cotação de ${esc(new Date(data + 'T12:00:00').toLocaleDateString('pt-BR'))} (BCE via Frankfurter).</p>
          <ul class="lista-limpa lista-linhas" style="margin-top:var(--sp-3)">${exemplos}</ul>
          <p class="faint" style="margin-top:var(--sp-2)">Taxa comercial de referência. Casas de câmbio e cartões cobram spread e IOF.</p>`;
      } catch (e) {
        if (e.status === -1) return;
        if (e.mensagem === 'sem-suporte') {
          let lista = '';
          try { lista = Object.keys(await moedasSuportadas({ signal })).length; } catch {}
          box.innerHTML = `<p class="card__rotulo">Câmbio</p><p class="card__valor" style="font-size:1.15rem">${esc(moedaNome(moeda))} (${esc(moeda)})</p>
            <div class="vazio" style="margin-top:var(--sp-3);text-align:left">A fonte de câmbio que usamos (Banco Central Europeu, via Frankfurter) não publica cotação para ${esc(moeda)}${lista ? ` — ela cobre ${lista} moedas` : ''}. Consulte a cotação no seu banco ou casa de câmbio; em muitos destinos vale levar dólar ou euro.</div>`;
          return;
        }
        montarErro(box, e, carregarCambio);
      }
    }

    async function carregarFeriados() {
      const box = $('#box-feriados');
      if (!lugar.cc) { box.innerHTML = vazioHTML('País não identificado — sem lista de feriados.'); return; }
      box.innerHTML = carregandoHTML('Carregando feriados', 4);
      try {
        const lista = await proximosFeriados(lugar.cc, 6, { signal });
        if (signal.aborted) return;
        if (lista === null) { box.innerHTML = vazioHTML(`A base Nager.Date não cobre ${pais ? pais.n : lugar.cc}. Consulte o calendário oficial do país.`); return; }
        if (!lista.length) { box.innerHTML = vazioHTML('Nenhum feriado nacional nos próximos 6 meses.'); return; }
        box.innerHTML = `<ul class="lista-limpa lista-linhas">${lista.map((f) => `<li><span><strong>${esc(f.localName)}</strong></span><time class="num muted" datetime="${f.date}" style="text-align:right">${esc(dataLonga(f.date))}</time></li>`).join('')}</ul>
          <p class="faint" style="margin-top:var(--sp-3)">Feriados nacionais mudam preço e lotação. Feriados regionais não aparecem aqui.</p>`;
      } catch (e) {
        if (e.status === -1) return;
        montarErro(box, e, carregarFeriados);
      }
    }

    async function carregarWiki() {
      const box = $('#box-wiki');
      box.innerHTML = carregandoHTML('Carregando resumo da Wikipédia', 4);
      try {
        const w = await wikiResumo(lugar.wiki || nome, { signal });
        if (signal.aborted) return;
        const pagina = (w.content_urls && w.content_urls.desktop && w.content_urls.desktop.page) || 'https://pt.wikipedia.org';
        if (!lugar.wiki) carregarMidia(w.title);
        const frase = primeiraFrase(w.extract);
        if (frase) { const q = $('#insp-frase'); q.hidden = false; q.innerHTML = `${esc(frase)} <cite>— Wikipédia em português</cite>`; }
        box.innerHTML = `<div class="wiki">
          <div><h3>${esc(w.title)}</h3>${w.description ? `<p class="faint">${esc(w.description)}</p>` : ''}<p>${esc(w.extract || '')}</p>
          <a href="${esc((w.content_urls && w.content_urls.desktop && w.content_urls.desktop.page) || 'https://pt.wikipedia.org')}" target="_blank" rel="noopener noreferrer">Ler na Wikipédia<span class="sr-only"> (abre em nova aba)</span></a>
          <p class="faint" style="margin-top:var(--sp-2)">Texto: Wikipédia em português (CC BY-SA).</p></div></div>`;
      } catch (e) {
        if (e.status === -1) return;
        if (!lugar.wiki) { heroSemFoto(); $('#box-galeria').innerHTML = vazioHTML('Sem artigo na Wikipédia em português, não há fotos livres para mostrar aqui.'); }
        if (e.vazio) { box.innerHTML = vazioHTML('A Wikipédia em português não tem um resumo para este lugar.'); return; }
        montarErro(box, e, carregarWiki);
      }
    }

    // ----- Cabe no seu bolso? (só conta com os números informados) -----
    {
      const f = $('#form-bolso'), saida = $('#bolso-saida');
      const salvo = lerBolso();
      if (salvo.orcamento) { $('#b-orc').value = String(salvo.orcamento); }
      $('#b-dias').value = salvo.dias; $('#b-pes').value = salvo.pessoas;
      const lerCampos = () => ({ orcamento: valorBR($('#b-orc').value), dias: Math.min(30, Math.max(2, Number($('#b-dias').value) || 7)), pessoas: Math.min(9, Math.max(1, Number($('#b-pes').value) || 2)) });
      const custoPadrao = () => {
        const b = lerCampos();
        const est = estimarRapido(dados, { cc: lugar.cc, dias: b.dias, pessoas: b.pessoas });
        $('#insp-custo').textContent = lugar.cc ? `${faixa(est.economico.min, est.equilibrado.max)}` : '—';
        const rot = $('#insp-custo').parentElement; rot.querySelector('.inspira__rot').textContent = `Custo estimado · ${b.dias} dias, ${b.pessoas} ${b.pessoas > 1 ? 'pessoas' : 'pessoa'}`;
        return { b, est };
      };
      const calcular = () => {
        const { b, est } = custoPadrao();
        if (!b.orcamento) { saida.innerHTML = ''; return; }
        if (!lugar.cc) { saida.innerHTML = '<p class="muted">Não identificamos o país deste ponto, então não dá para estimar o custo com segurança.</p>'; return; }
        const v = veredito(est, b.orcamento);
        const c = destinosQueCabem(dados, b.orcamento, b.dias, b.pessoas);
        saida.innerHTML = `<p class="bolso__veredito bolso__veredito--${v.nivel}">${esc(v.texto)}</p>
          <p class="faint" style="margin:var(--sp-2) 0 0">Com ${esc(reais(b.orcamento))}, ${b.dias} dias e ${b.pessoas} ${b.pessoas > 1 ? 'pessoas' : 'pessoa'}, ${c.cabem} dos ${c.total} destinos do Farol cabem na faixa mínima do estilo Econômico${c.cabem < c.total ? `. Os mais em conta: ${c.maisBarato.map((d) => `<a href="#/destino/${esc(d.slug)}">${esc(d.nome)}</a>`).join(', ')}.` : '.'} Estimativas, não cotações.</p>
          <div class="acoes" style="margin-top:var(--sp-3)"><a class="btn btn--secundario btn--pequeno" href="#/planejar?${qPlan}">Montar roteiro com esse orçamento ${icone('i-seta')}</a></div>`;
      };
      f.addEventListener('submit', (ev) => { ev.preventDefault(); gravarBolso(lerCampos()); calcular(); });
      f.addEventListener('input', () => { const b = lerCampos(); if (b.orcamento) gravarBolso(b); calcular(); });
      calcular();
    }

    // ----- Barra de ações no celular, vídeos, revelar e paralaxe -----
    const barra = document.createElement('div');
    barra.className = 'barra-acoes'; barra.setAttribute('data-compartilhar', ''); barra.setAttribute('role', 'region'); barra.setAttribute('aria-label', 'Ações rápidas');
    barra.innerHTML = `<a class="btn btn--whats" data-whats href="https://wa.me/" target="_blank" rel="noopener noreferrer">${icone('i-whats')} WhatsApp<span class="sr-only"> (abre em nova aba)</span></a>
      <a class="btn btn--primario" href="#/planejar?${qPlan}">Planejar</a>
      <button type="button" class="btn btn--secundario" data-rolar-barra>Reservar</button>`;
    el.appendChild(barra);
    ligarCompartilhar(barra, () => ({ titulo: `${nome} · Farol`, texto: [`📍 ${nome}${pais ? ` (${pais.n})` : ''}`, resumoTempo, 'Clima ao vivo, fotos, vídeos, preços estimados e pontos turísticos no Farol:'].filter(Boolean).join('\n'), url: urlCompleta(dest ? `#/destino/${dest.slug}` : location.hash) }));
    barra.querySelector('[data-rolar-barra]').addEventListener('click', () => $('[data-rolar]').click());
    ligarBarraAcoes(barra, $('#hero'), signal);
    ligarVideos(el); ligarCarrossel(el, { signal });
    ligarParalaxe($('#hero'), { signal });
    ligarRevelar(el, { signal });

    carregarTempo(); carregarAno(); carregarAr(); carregarCambio(); carregarFeriados(); carregarWiki(); carregarPontos();
  };

  // Coordenadas sem nome/país: descobre por geocodificação reversa antes de desenhar
  if (!dest && (!lugar.nome || !lugar.cc)) {
    ctx.titulo('Destino');
    el.innerHTML = `<section class="shell"><div class="sk sk--titulo"></div>${carregandoHTML('Identificando o local', 2)}</section>`;
    lugarPorCoordenada(lugar.lat, lugar.lon, { signal })
      .then((r) => { if (signal.aborted) return; lugar.nome = lugar.nome || r.nome; lugar.cc = lugar.cc || r.cc; lugar.regiao = lugar.regiao || r.regiao; desenhar(); })
      .catch((e) => { if (e.status !== -1) desenhar(); });
  } else desenhar();
}
