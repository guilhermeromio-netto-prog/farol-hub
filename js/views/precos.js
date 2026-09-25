// Tela: Preços e condições — Farol · byGui
import { esc, icone, faixa, reais, arred } from '../ui.js';

const iso = (d) => d.toISOString().slice(0, 10);
const yymmdd = (s) => s.replace(/-/g, '').slice(2);

function datasPadrao(mes, dias) {
  const hoje = new Date();
  let ida;
  if (mes) {
    const m = Number(mes) - 1;
    const ano = m > hoje.getMonth() || (m === hoje.getMonth() && hoje.getDate() < 10) ? hoje.getFullYear() : hoje.getFullYear() + 1;
    ida = new Date(Date.UTC(ano, m, 10));
  } else {
    ida = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 30));
  }
  const volta = new Date(ida); volta.setUTCDate(volta.getUTCDate() + Math.max(1, (Number(dias) || 7) - 1));
  return [iso(ida), iso(volta)];
}

export function render(ctx) {
  const { el, dados, query } = ctx;
  ctx.titulo('Preços e condições');
  const q = (k) => (query.get(k) || '').slice(0, 80);
  const [idaP, voltaP] = datasPadrao(q('mes'), q('dias'));
  const destQ = q('destino');
  const destaque = dados.destaques.find((d) => d.nome === destQ);
  const origemQ = q('origem') || 'São Paulo';
  const origemObj = dados.origens.find((o) => o.nome === origemQ);
  const st = {
    origem: origemQ,
    destino: destQ,
    ida: idaP, volta: voltaP,
    viajantes: Math.min(9, Math.max(1, Number(q('viajantes')) || 2)),
    iataO: (q('iataOrigem') || (origemObj && origemObj.iata) || '').toUpperCase(),
    iataD: (q('iata') || (destaque && destaque.iata) || '').toUpperCase(),
    transporte: q('transporte') || 'plane',
    pais: (q('pais') || (destaque && destaque.pais) || '').toUpperCase(),
  };
  const pais = st.pais ? dados.paises[st.pais] : null;
  const regioes = Object.entries(dados.custos).filter(([k]) => k !== 'outros');

  el.innerHTML = `
  <div class="shell">
    <p class="kicker">Preços e condições</p>
    <h1>Quanto custa e onde conferir</h1>
    <p class="lead">Faixas estimadas para se orientar e atalhos já preenchidos para buscar o preço real nos sites de viagem.</p>

    <section class="secao" aria-labelledby="t-busca" style="margin-top:var(--sp-6)">
      <h2 id="t-busca">Buscar preço real</h2>
      <form id="form-precos" class="bloco" novalidate>
        <div class="linha-form">
          <div class="campo"><label for="p-origem">Origem</label><input class="input" id="p-origem" name="origem" list="p-origens" maxlength="80" value="${esc(st.origem)}" autocomplete="off"><datalist id="p-origens">${dados.origens.map((o) => `<option value="${esc(o.nome)}"></option>`).join('')}</datalist></div>
          <div class="campo"><label for="p-destino">Destino</label><input class="input" id="p-destino" name="destino" maxlength="80" value="${esc(st.destino)}" placeholder="Ex.: Lisboa" autocomplete="off" list="p-destinos"><datalist id="p-destinos">${dados.destaques.map((d) => `<option value="${esc(d.nome)}"></option>`).join('')}</datalist></div>
        </div>
        <div class="linha-form linha-form--3" style="margin-top:var(--sp-4)">
          <div class="campo"><label for="p-ida">Ida</label><input class="input" type="date" id="p-ida" name="ida" value="${st.ida}"></div>
          <div class="campo"><label for="p-volta">Volta</label><input class="input" type="date" id="p-volta" name="volta" value="${st.volta}"></div>
          <div class="campo"><label for="p-viaj">Viajantes (adultos)</label><input class="input" type="number" inputmode="numeric" min="1" max="9" id="p-viaj" name="viajantes" value="${st.viajantes}"></div>
        </div>
        <div class="linha-form" style="margin-top:var(--sp-4)">
          <div class="campo"><label for="p-iatao">Código do aeroporto de origem (IATA)</label><input class="input" id="p-iatao" name="iataO" maxlength="3" value="${esc(st.iataO)}" placeholder="Ex.: SAO, GRU" autocomplete="off" style="text-transform:uppercase" aria-describedby="p-iata-ajuda"></div>
          <div class="campo"><label for="p-iatad">Código do aeroporto de destino (IATA)</label><input class="input" id="p-iatad" name="iataD" maxlength="3" value="${esc(st.iataD)}" placeholder="Ex.: LIS" autocomplete="off" style="text-transform:uppercase" aria-describedby="p-iata-ajuda"></div>
        </div>
        <p class="ajuda" id="p-iata-ajuda" style="margin-top:var(--sp-2)">Opcional. Com os códigos, o Skyscanner abre já na busca certa. Os destinos em destaque vêm preenchidos.</p>
        <p class="erro-campo" id="p-erro" aria-live="polite"></p>
        <div class="acoes" style="margin-top:var(--sp-3)"><button class="btn btn--primario" type="submit">Atualizar links</button></div>
      </form>
      <div id="links" class="link-lista" style="margin-top:var(--sp-4)" aria-live="polite"></div>
    </section>

    <section class="secao" aria-labelledby="t-faixas">
      <div class="secao__cab"><h2 id="t-faixas">Faixas estimadas por região</h2></div>
      <div class="aviso-estimativa" role="note"><strong>Faixas estimadas — confira o preço real.</strong> Valores em reais, de referência geral para 2026, sem promoções nem taxas de última hora.</div>
      <div class="tabela-wrap" style="margin-top:var(--sp-4)"><table>
        <caption>Hospedagem por noite (quarto duplo) e gastos diários por pessoa</caption>
        <thead><tr><th scope="col">Região</th><th scope="col" class="num">Hospedagem · econômica</th><th scope="col" class="num">Hospedagem · equilibrada</th><th scope="col" class="num">Hospedagem · conforto</th><th scope="col" class="num">Comida por pessoa/dia (equilibrado)</th><th scope="col" class="num">Voo ida e volta por pessoa, saindo do Brasil</th></tr></thead>
        <tbody>${regioes.map(([, r]) => `<tr><th scope="row" style="font-weight:600">${esc(r.nome)}</th><td class="num">${faixa(...r.hospedagem.economico)}</td><td class="num">${faixa(...r.hospedagem.equilibrado)}</td><td class="num">${faixa(...r.hospedagem.conforto)}</td><td class="num">${faixa(...r.alimentacao.equilibrado)}</td><td class="num">${faixa(...r.aereo)}</td></tr>`).join('')}</tbody>
      </table></div>

      <h3 style="margin-top:var(--sp-6)">Destinos em destaque · 7 dias para 2 pessoas (estimativa, opção equilibrada, de avião)</h3>
      <div class="tabela-wrap"><table>
        <caption>Soma de voo, 6 noites, comida e passeios. Estimativa — confira o preço real.</caption>
        <thead><tr><th scope="col">Destino</th><th scope="col">Região de custo</th><th scope="col" class="num">Total estimado</th></tr></thead>
        <tbody>${dados.destaques.map((d) => {
          const reg = dados.custos[(dados.paises[d.pais] || {}).r] || dados.custos.outros;
          const min = reg.aereo[0] * 2 + reg.hospedagem.equilibrado[0] * 6 + (reg.alimentacao.equilibrado[0] + reg.atividades.equilibrado[0]) * 7 * 2;
          const max = reg.aereo[1] * 2 + reg.hospedagem.equilibrado[1] * 6 + (reg.alimentacao.equilibrado[1] + reg.atividades.equilibrado[1]) * 7 * 2;
          return `<tr><th scope="row" style="font-weight:600"><a href="#/destino/${esc(d.slug)}">${esc(d.nome)}</a></th><td class="muted">${esc(reg.nome)}</td><td class="num">${faixa(arred(min, 100), arred(max, 100))}</td></tr>`;
        }).join('')}</tbody>
      </table></div>
    </section>

    <section class="secao" aria-labelledby="t-visto">
      <h2 id="t-visto">Visto, passaporte e saúde</h2>
      <p class="muted" style="max-width:70ch">O Farol não informa regras de visto ou de entrada: elas mudam e dependem do passaporte, do motivo e do tempo de estadia. ${pais && st.pais !== 'BR' ? `Para <strong>${esc(pais.n)}</strong>, confira o Portal Consular e o site da embaixada ou do consulado de ${esc(pais.n)} no Brasil.` : 'Confira sempre as fontes oficiais abaixo antes de comprar.'}</p>
      <div class="link-lista" style="margin-top:var(--sp-4)">
        ${dados.fontes.oficiais.map((f) => `<a class="card card--link card--tight link-card" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer"><span><strong>${esc(f.nome)}</strong><small>${esc(f.desc)}</small></span>${icone('i-externo')}<span class="sr-only">(abre em nova aba)</span></a>`).join('')}
      </div>
    </section>

    <section class="secao" aria-labelledby="t-dicas">
      <h2 id="t-dicas">Dicas de especialista</h2>
      <div class="grid grid--3">
        <div class="card"><h3>Passagens</h3><ul class="lista-marcada lista-limpa">
          <li>Compare datas vizinhas: voar um dia antes ou depois muda muito o preço.</li>
          <li>Confira o que a tarifa inclui (mala, assento, remarcação) antes de comparar valores.</li>
          <li>Em conexões internacionais, prefira um único bilhete: se atrasar, a companhia reacomoda.</li>
        </ul></div>
        <div class="card"><h3>Hospedagem</h3><ul class="lista-marcada lista-limpa">
          <li>Localização vale mais do que estrelas: perto do que você quer fazer economiza transporte e tempo.</li>
          <li>Leia avaliações recentes, dos últimos 3 a 6 meses.</li>
          <li>Tarifa reembolsável custa um pouco mais, mas protege contra imprevistos.</li>
        </ul></div>
        <div class="card"><h3>Dinheiro e seguro</h3><ul class="lista-marcada lista-limpa">
          <li>No exterior, compare IOF e spread do cartão com contas globais antes de viajar.</li>
          <li>Seguro viagem: confira cobertura médica, bagagem e esportes de aventura, se for praticar.</li>
          <li>Guarde um cartão reserva separado do principal.</li>
        </ul></div>
      </div>
    </section>
  </div>`;

  const form = el.querySelector('#form-precos');
  const box = el.querySelector('#links');
  const erro = el.querySelector('#p-erro');

  const gerar = () => {
    const fd = new FormData(form);
    const o = String(fd.get('origem') || '').trim();
    const d = String(fd.get('destino') || '').trim();
    const ida = String(fd.get('ida') || '');
    const volta = String(fd.get('volta') || '');
    const n = Math.min(9, Math.max(1, Number(fd.get('viajantes')) || 1));
    const io = String(fd.get('iataO') || '').trim().toUpperCase();
    const idd = String(fd.get('iataD') || '').trim().toUpperCase();
    erro.textContent = '';
    if (d.length < 2) { erro.textContent = 'Informe o destino para gerar os links.'; box.innerHTML = ''; return false; }
    if (ida && volta && volta < ida) { erro.textContent = 'A volta precisa ser depois da ida.'; box.innerHTML = ''; return false; }
    const quartos = Math.ceil(n / 2);
    const iataOk = /^[A-Z]{3}$/.test(io) && /^[A-Z]{3}$/.test(idd);
    const links = [
      { nome: 'Google Voos', desc: `${o || 'Origem'} → ${d}${ida ? ` · ${new Date(ida + 'T12:00').toLocaleDateString('pt-BR')}` : ''}`, url: `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights to ${idd || d} from ${io || o || 'São Paulo'}${ida ? ` on ${ida}` : ''}${volta ? ` through ${volta}` : ''} ${n} adults`)}&hl=pt-BR&curr=BRL` },
      { nome: 'Skyscanner', desc: iataOk ? `${io} → ${idd}, ${n} adulto(s)` : 'Informe os códigos IATA para abrir já na busca', url: iataOk && ida && volta ? `https://www.skyscanner.com.br/transporte/passagens-aereas/${io.toLowerCase()}/${idd.toLowerCase()}/${yymmdd(ida)}/${yymmdd(volta)}/?adultsv2=${n}&cabinclass=economy` : 'https://www.skyscanner.com.br/' },
      { nome: 'Booking.com', desc: `Hotéis em ${d}, ${quartos} quarto(s)`, url: `https://www.booking.com/searchresults.pt-br.html?ss=${encodeURIComponent(d)}${ida ? `&checkin=${ida}` : ''}${volta ? `&checkout=${volta}` : ''}&group_adults=${n}&no_rooms=${quartos}&group_children=0&selected_currency=BRL` },
      { nome: 'Airbnb', desc: `Casas e quartos em ${d}`, url: `https://www.airbnb.com.br/s/${encodeURIComponent(d)}/homes?${ida ? `checkin=${ida}&` : ''}${volta ? `checkout=${volta}&` : ''}adults=${n}` },
      { nome: 'Google Maps · rota de carro ou motorhome', desc: `${o || 'Origem'} → ${d}: distância, tempo e pedágios`, url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(o || 'São Paulo')}&destination=${encodeURIComponent(d)}&travelmode=driving` },
    ];
    if (st.transporte === 'car' || st.transporte === 'motorhome') links.unshift(links.pop());
    box.innerHTML = links.map((l) => `<a class="card card--link card--tight link-card" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><span><strong>${esc(l.nome)}</strong><small>${esc(l.desc)}</small></span>${icone('i-externo')}<span class="sr-only">(abre em nova aba)</span></a>`).join('') +
      `<p class="faint" style="grid-column:1/-1">Os links abrem os sites oficiais com a busca preenchida. O Farol não recebe comissão e não vê os preços.</p>`;
    return true;
  };
  form.addEventListener('submit', (ev) => { ev.preventDefault(); if (gerar()) box.querySelector('a')?.focus(); });
  form.addEventListener('change', gerar);
  el.querySelector('#p-destino').addEventListener('change', (ev) => {
    const dz = dados.destaques.find((x) => x.nome === ev.target.value.trim());
    if (dz) { el.querySelector('#p-iatad').value = dz.iata; gerar(); }
  });
  el.querySelector('#p-origem').addEventListener('change', (ev) => {
    const oz = dados.origens.find((x) => x.nome === ev.target.value.trim());
    if (oz) { el.querySelector('#p-iatao').value = oz.iata; gerar(); }
  });
  if (st.destino) gerar();
  else box.innerHTML = '<div class="vazio" style="grid-column:1/-1">Informe o destino para gerar os links de busca.</div>';
}
