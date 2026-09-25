// Tela: Preços — abas por categoria, faixas estimadas e links verificados. Farol · byGui
import { esc, icone, faixa, dataBR } from '../ui.js';
import { montarPrecos } from './precos-hub.js';
import { datasPadrao, iataDe } from '../links.js';

export function render(ctx) {
  const { el, dados, query } = ctx;
  ctx.titulo('Preços e links de busca');
  const q = (k) => (query.get(k) || '').slice(0, 80);
  const [idaP, voltaP] = datasPadrao(q('mes'), q('dias'));
  const destQ = q('destino');
  const destaque = dados.destaques.find((d) => d.nome === destQ);
  const origemQ = q('origem') || 'São Paulo';
  const P = dados.precos;
  let aba = q('aba') || 'passagens';

  el.innerHTML = `
  <div class="shell">
    <p class="kicker">Preços</p>
    <h1>Quanto custa e onde reservar</h1>
    <p class="lead">Faixas estimadas em reais para o viajante de classe média — econômico e médio — e atalhos já preenchidos para ver o preço real nos sites de viagem.</p>
    <div class="aviso-estimativa" role="note" style="margin-top:var(--sp-4)"><strong>Estimativas, não cotações.</strong> ${esc(P.nota)} Atualizado em ${esc(dataBR(P.atualizadoEm))}.</div>

    <section class="secao" aria-labelledby="t-busca" style="margin-top:var(--sp-5)">
      <h2 id="t-busca">Sua viagem</h2>
      <form id="form-precos" class="bloco" novalidate>
        <div class="linha-form">
          <div class="campo"><label for="p-origem">Origem</label><input class="input" id="p-origem" name="origem" list="p-origens" maxlength="80" value="${esc(origemQ)}" autocomplete="off"><datalist id="p-origens">${dados.origens.map((o) => `<option value="${esc(o.nome)}">${esc(o.uf)} · ${esc(o.iata)}</option>`).join('')}</datalist></div>
          <div class="campo"><label for="p-destino">Destino</label><input class="input" id="p-destino" name="destino" maxlength="80" value="${esc(destQ)}" placeholder="Ex.: Lisboa" autocomplete="off" list="p-destinos"><datalist id="p-destinos">${dados.destaques.map((d) => `<option value="${esc(d.nome)}"></option>`).join('')}</datalist></div>
        </div>
        <div class="linha-form linha-form--3" style="margin-top:var(--sp-4)">
          <div class="campo"><label for="p-ida">Ida</label><input class="input" type="date" id="p-ida" name="ida" value="${esc(q('ida') || idaP)}"></div>
          <div class="campo"><label for="p-volta">Volta</label><input class="input" type="date" id="p-volta" name="volta" value="${esc(q('volta') || voltaP)}"></div>
          <div class="campo"><label for="p-viaj">Adultos</label><input class="input" type="number" inputmode="numeric" min="1" max="9" id="p-viaj" name="viajantes" value="${Math.min(9, Math.max(1, Number(q('viajantes')) || 2))}"></div>
        </div>
        <div class="linha-form" style="margin-top:var(--sp-4)">
          <div class="campo"><label for="p-iatao">Aeroporto de origem (código IATA)</label><input class="input" id="p-iatao" name="iataO" maxlength="3" value="${esc((q('iataOrigem') || iataDe(dados, origemQ)).toUpperCase())}" placeholder="Ex.: SAO" autocomplete="off" style="text-transform:uppercase" aria-describedby="p-iata-ajuda" list="p-aeros"></div>
          <div class="campo"><label for="p-iatad">Aeroporto de destino (código IATA)</label><input class="input" id="p-iatad" name="iataD" maxlength="3" value="${esc((q('iata') || (destaque && destaque.iata) || iataDe(dados, destQ)).toUpperCase())}" placeholder="Ex.: LIS" autocomplete="off" style="text-transform:uppercase" aria-describedby="p-iata-ajuda" list="p-aeros"></div>
          <datalist id="p-aeros">${dados.aeroportos.map((a) => `<option value="${esc(a.iata)}">${esc(a.cidade)}</option>`).join('')}</datalist>
        </div>
        <p class="ajuda" id="p-iata-ajuda" style="margin-top:var(--sp-2)">Preenchidos sozinhos para as capitais brasileiras e os destinos em destaque (tabela com ${dados.aeroportos.length} códigos). Códigos de cidade como SAO e RIO incluem todos os aeroportos.</p>
        <p class="erro-campo" id="p-erro" aria-live="polite"></p>
      </form>
      <div id="hub" style="margin-top:var(--sp-4)"></div>
    </section>

    <section class="secao" aria-labelledby="t-faixas">
      <h2 id="t-faixas">Faixas por região</h2>
      <div class="tabela-wrap"><table>
        <caption>Estimativas em reais · econômico – médio · atualizado em ${esc(dataBR(P.atualizadoEm))}</caption>
        <thead><tr><th scope="col">Região</th><th scope="col" class="num">Passagem (ida e volta, por pessoa)</th><th scope="col" class="num">Hospedagem (noite, quarto duplo)</th><th scope="col" class="num">Carro (diária)</th><th scope="col" class="num">Passeio (por pessoa)</th><th scope="col" class="num">Seguro (pessoa/dia)</th></tr></thead>
        <tbody>${Object.entries(P.regioes).filter(([k]) => k !== 'outros').map(([k, r]) => `<tr><th scope="row" style="font-weight:600">${esc((dados.custos[k] || {}).nome || k)}</th>${['passagem', 'hospedagem', 'carro', 'passeio', 'seguro'].map((c) => `<td class="num">${faixa(r[c].economico[0], r[c].medio[1])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>
      <p class="faint" style="margin-top:var(--sp-2)">Cada célula vai do mínimo econômico ao máximo médio. Conforto/luxo fica acima.</p>
    </section>

    <section class="secao" aria-labelledby="t-visto">
      <h2 id="t-visto">Visto, passaporte e saúde</h2>
      <p class="muted" style="max-width:70ch">O Farol não informa regras de visto ou de entrada: elas mudam e dependem do passaporte, do motivo e do tempo de estadia. Confira sempre as fontes oficiais antes de comprar.</p>
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
        <div class="card"><h3>Hospedagem e carro</h3><ul class="lista-marcada lista-limpa">
          <li>Localização vale mais do que estrelas: perto do que você quer fazer economiza transporte e tempo.</li>
          <li>No aluguel de carro, compare o valor final com proteções e taxas de retirada/devolução.</li>
          <li>Tarifa reembolsável custa um pouco mais, mas protege contra imprevistos.</li>
        </ul></div>
        <div class="card"><h3>Dinheiro e seguro</h3><ul class="lista-marcada lista-limpa">
          <li>No exterior, compare IOF e spread do cartão com contas globais antes de viajar.</li>
          <li>Seguro viagem: confira cobertura médica, bagagem e esportes de aventura, se for praticar.</li>
          <li>Registre cada gasto em <a href="#/gastos">Gastos</a> para saber quanto sobra por dia.</li>
        </ul></div>
      </div>
    </section>
  </div>`;

  const form = el.querySelector('#form-precos');
  const hub = el.querySelector('#hub');
  const erro = el.querySelector('#p-erro');
  const gerar = () => {
    const fd = new FormData(form);
    const d = String(fd.get('destino') || '').trim();
    const o = String(fd.get('origem') || '').trim() || 'São Paulo';
    const ida = String(fd.get('ida') || ''), volta = String(fd.get('volta') || '');
    erro.textContent = '';
    if (d.length < 2) { hub.innerHTML = '<div class="vazio">Informe o destino para ver faixas e links de busca.</div>'; return; }
    if (ida && volta && volta <= ida) { erro.textContent = 'A volta precisa ser depois da ida.'; return; }
    const dz = dados.destaques.find((x) => x.nome.toLowerCase() === d.toLowerCase());
    const oz = dados.origens.find((x) => x.nome.toLowerCase() === o.toLowerCase());
    const aero = dados.aeroportos.find((a) => a.iata === String(fd.get('iataD') || '').toUpperCase());
    const pais = (dz && dz.pais) || q('pais').toUpperCase() || (aero && aero.pais) || '';
    montarPrecos(hub, dados, {
      destino: dz ? dz.nome : d, pais, origem: o, origemUF: oz ? oz.uf : '', ida, volta,
      adultos: Number(fd.get('viajantes')) || 2, iataO: String(fd.get('iataO') || '').trim().toUpperCase(), iataD: String(fd.get('iataD') || '').trim().toUpperCase(),
      civitatis: dz ? dz.civitatis : '', destinoLat: dz ? dz.lat : null, destinoLon: dz ? dz.lon : null, transporte: q('transporte'),
    }, { ativa: aba, onTroca: (k) => { aba = k; } });
  };
  form.addEventListener('submit', (ev) => ev.preventDefault());
  form.addEventListener('change', gerar);
  el.querySelector('#p-destino').addEventListener('change', (ev) => {
    const v = ev.target.value.trim();
    const dz = dados.destaques.find((x) => x.nome === v);
    el.querySelector('#p-iatad').value = dz ? dz.iata : iataDe(dados, v);
  });
  el.querySelector('#p-origem').addEventListener('change', (ev) => {
    el.querySelector('#p-iatao').value = iataDe(dados, ev.target.value.trim());
  });
  gerar();
}
