// Tela: Destino (painel ao vivo) — Farol · byGui
import { previsao, qualidadeAr, climaAnoPassado, cotacaoBRL, moedasSuportadas, proximosFeriados, wikiResumo, lugarPorCoordenada, msgErro } from '../api.js';
import { esc, icone, bandeira, carregandoHTML, erroHTML, vazioHTML, numero, diaSemana, dataCurta, dataLonga, MESES_CURTOS } from '../ui.js';
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
  if (dest) lugar = { nome: dest.nome, lat: dest.lat, lon: dest.lon, cc: dest.pais, regiao: dest.local, wiki: dest.wiki, iata: dest.iata, resumo: dest.resumo };
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
    const nome = lugar.nome || 'Local selecionado';
    ctx.titulo(nome);
    const qPlan = new URLSearchParams({ destino: nome, lat: lugar.lat, lon: lugar.lon });
    const qPreco = new URLSearchParams({ destino: nome });
    if (lugar.cc) qPreco.set('pais', lugar.cc);
    if (lugar.iata) qPreco.set('iata', lugar.iata);
    el.innerHTML = `
    <div class="shell">
      <a class="voltar" href="#/">${icone('i-voltar')} Início</a>
      <header class="destino-cab">
        <div>
          <p class="kicker">${lugar.cc ? `<img src="${bandeira(lugar.cc)}" alt="" width="20" height="14" style="display:inline-block;vertical-align:-2px;border-radius:3px;margin-right:6px">` : ''}${esc([lugar.regiao, pais && pais.n].filter(Boolean).join(' · ') || 'Painel do destino')}</p>
          <h1>${esc(nome)}</h1>
          <p class="faint num">${numero(lugar.lat, 3)}, ${numero(lugar.lon, 3)}${lugar.resumo ? ' · ' + esc(lugar.resumo) : ''}</p>
        </div>
        <div class="acoes" style="margin-top:0">
          <a class="btn btn--primario" href="#/planejar?${qPlan}">Planejar viagem para cá</a>
          <a class="btn btn--secundario" href="#/precos?${qPreco}">Ver preços</a>
        </div>
      </header>

      <section class="secao" aria-labelledby="t-agora" style="margin-top:var(--sp-6)">
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

        const cond = condicoesProximas(p);
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
        const img = w.thumbnail && w.thumbnail.source;
        box.innerHTML = `<div class="wiki ${img ? 'wiki--img' : ''}">
          ${img ? `<img src="${esc(img)}" alt="Imagem ilustrativa: ${esc(w.title)}" loading="lazy">` : ''}
          <div><h3>${esc(w.title)}</h3>${w.description ? `<p class="faint">${esc(w.description)}</p>` : ''}<p>${esc(w.extract || '')}</p>
          <a href="${esc((w.content_urls && w.content_urls.desktop && w.content_urls.desktop.page) || 'https://pt.wikipedia.org')}" target="_blank" rel="noopener noreferrer">Ler na Wikipédia<span class="sr-only"> (abre em nova aba)</span></a>
          <p class="faint" style="margin-top:var(--sp-2)">Texto: Wikipédia em português (CC BY-SA).</p></div></div>`;
      } catch (e) {
        if (e.status === -1) return;
        if (e.vazio) { box.innerHTML = vazioHTML('A Wikipédia em português não tem um resumo para este lugar.'); return; }
        montarErro(box, e, carregarWiki);
      }
    }

    carregarTempo(); carregarAno(); carregarAr(); carregarCambio(); carregarFeriados(); carregarWiki();
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
