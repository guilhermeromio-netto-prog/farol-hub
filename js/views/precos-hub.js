// Componente "Preços": abas Passagens / Hospedagem / Aluguel de carro / Passeios / Seguro viagem.
// Faixas = estimativas de dados.json (com data). Links = modelos verificados. Farol · byGui
import { esc, icone, faixa, arred, abasHTML, ligarAbas, dataBR } from '../ui.js';
import { linksPorCategoria, linkRota } from '../links.js';

export const ABAS_PRECO = [['passagens', 'Passagens'], ['hospedagem', 'Hospedagem'], ['carro', 'Aluguel de carro'], ['passeios', 'Passeios'], ['seguro', 'Seguro viagem']];

function noites(ctx) {
  if (ctx.ida && ctx.volta) { const n = Math.round((new Date(ctx.volta + 'T12:00') - new Date(ctx.ida + 'T12:00')) / 864e5); if (n > 0) return n; }
  return Math.max(1, (Number(ctx.dias) || 7) - 1);
}

function cartaoFaixa(titulo, unidade, par, mult, detalhe) {
  const [a, b] = par;
  return `<div class="card card--tight faixa-card">
    <p class="card__rotulo">${esc(titulo)}</p>
    <p class="card__valor num">${faixa(arred(a * mult, 10), arred(b * mult, 10))}</p>
    <p class="card__detalhe">${esc(detalhe)}</p>
    <p class="faint num" style="margin:6px 0 0">${faixa(a, b)} ${esc(unidade)}</p>
  </div>`;
}

function linksHTML(cat) {
  return `<div class="link-lista" style="margin-top:var(--sp-4)">${cat.itens.map((l) => `<a class="card card--link card--tight link-card" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><span><strong>${esc(l.nome)}</strong><small>${esc(l.nota)}</small><span class="link-card__sub">${l.preenchido ? 'Busca pré-preenchida' : 'Sem pré-preenchimento'}</span></span>${icone('i-externo')}<span class="sr-only">(abre em nova aba)</span></a>`).join('')}</div>`;
}

/**
 * Desenha o componente em `box`.
 * ctx: { destino, pais, regiao, origem, origemUF, ida, volta, adultos, dias, iataO, iataD, civitatis, destinoLat, destinoLon, transporte }
 */
export function montarPrecos(box, dados, ctx, { ativa = 'passagens', onTroca = () => {} } = {}) {
  const P = dados.precos;
  const regId = ctx.regiao || (dados.paises[ctx.pais] || {}).r || 'outros';
  const reg = P.regioes[regId] || P.regioes.outros;
  const regNome = (dados.custos[regId] || dados.custos.outros).nome;
  const n = noites(ctx);
  const dias = n + 1;
  const adultos = Math.min(9, Math.max(1, Number(ctx.adultos) || 1));
  const quartos = Math.ceil(adultos / 2);
  const nPasseios = Math.min(5, Math.max(1, Math.round(dias / 2)));
  const cats = Object.fromEntries(linksPorCategoria(dados, ctx).map((c) => [c.id, c]));
  const nacional = ctx.pais === 'BR';
  const atualizado = dataBR(P.atualizadoEm);
  const aviso = `<p class="linha-acoes" style="margin:0 0 var(--sp-3)"><span class="selo-estimativa">Estimativa · atualizado em ${esc(atualizado)}</span><span class="faint">Região de preço: ${esc(regNome)} · ${adultos} adulto(s) · ${n} noite(s)</span></p>`;
  const semDatas = !(ctx.ida && ctx.volta) ? `<p class="faint" style="margin-top:var(--sp-3)">Sem datas definidas: os links usam datas de exemplo${ctx.ida ? '' : ' daqui a ~30 dias'}. Ajuste no site ou informe as datas.</p>` : `<p class="faint" style="margin-top:var(--sp-3)">Datas nos links: ${esc(dataBR(ctx.ida))} a ${esc(dataBR(ctx.volta))}.</p>`;

  const paineis = {
    passagens: () => `${aviso}<div class="faixas">
        ${cartaoFaixa('Econômico', P.unidades.passagem ? 'por pessoa' : '', reg.passagem.economico, adultos, `Ida e volta para ${adultos} pessoa(s), tarifa básica`)}
        ${cartaoFaixa('Médio', 'por pessoa', reg.passagem.medio, adultos, 'Com mala despachada ou horários melhores')}
      </div>
      <p class="faint" style="margin-top:var(--sp-3)">Base: ${esc(P.unidades.passagem)}. ${nacional ? 'Em trechos curtos, compare com ônibus ou carro.' : 'Taxas de embarque internacionais já costumam vir no preço final.'}</p>
      ${linksHTML(cats.passagens)}
      ${ctx.transporte === 'car' || ctx.transporte === 'motorhome' || nacional ? `<a class="card card--link card--tight link-card" style="margin-top:var(--sp-3)" href="${esc(linkRota(dados, ctx))}" target="_blank" rel="noopener noreferrer"><span><strong>${esc(dados.links.rota.nome)}</strong><small>Distância, tempo e pedágios de ${esc(ctx.origem || 'São Paulo')} até ${esc(ctx.destino)}</small></span>${icone('i-externo')}<span class="sr-only">(abre em nova aba)</span></a>` : ''}
      ${semDatas}`,
    hospedagem: () => `${aviso}<div class="faixas">
        ${cartaoFaixa('Econômico', 'por noite', reg.hospedagem.economico, n * quartos, `${n} noite(s), ${quartos} quarto(s) duplo(s): pousada, hostel ou hotel simples`)}
        ${cartaoFaixa('Médio', 'por noite', reg.hospedagem.medio, n * quartos, 'Hotel 3–4 estrelas ou apartamento bem localizado')}
      </div>${linksHTML(cats.hospedagem)}${semDatas}`,
    carro: () => `${aviso}<div class="faixas">
        ${cartaoFaixa('Econômico', 'por dia', reg.carro.economico, dias, `${dias} diária(s) de carro econômico com proteção básica`)}
        ${cartaoFaixa('Médio', 'por dia', reg.carro.medio, dias, 'Intermediário ou SUV compacto')}
      </div>
      <p class="faint" style="margin-top:var(--sp-3)">Não inclui combustível, pedágio nem estacionamento. ${nacional ? 'CNH brasileira vale no país.' : 'No exterior, confira se o país pede Permissão Internacional para Dirigir (PID).'} </p>
      ${linksHTML(cats.carro)}${semDatas}`,
    passeios: () => `${aviso}<div class="faixas">
        ${cartaoFaixa('Econômico', 'por pessoa, por passeio', reg.passeio.economico, adultos * nPasseios, `${nPasseios} passeio(s) guiado(s) em grupo para ${adultos} pessoa(s)`)}
        ${cartaoFaixa('Médio', 'por pessoa, por passeio', reg.passeio.medio, adultos * nPasseios, 'Passeios com transfer, grupos menores ou ingressos incluídos')}
      </div>${linksHTML(cats.passeios)}
      <p class="faint" style="margin-top:var(--sp-3)">Os sites listam passeios de operadores locais; compare avaliações recentes e política de cancelamento.</p>`,
    seguro: () => `${aviso}<div class="faixas">
        ${cartaoFaixa('Econômico', 'por pessoa por dia', reg.seguro.economico, adultos * dias, `${dias} dia(s) para ${adultos} pessoa(s), cobertura básica`)}
        ${cartaoFaixa('Médio', 'por pessoa por dia', reg.seguro.medio, adultos * dias, 'Cobertura médica maior, bagagem e cancelamento')}
      </div>
      <p class="faint" style="margin-top:var(--sp-3)">${nacional ? 'Em viagens nacionais o seguro é opcional; o SUS atende em todo o país.' : 'Alguns destinos exigem seguro com cobertura mínima (por exemplo, países do Espaço Schengen). Confira a exigência no site oficial do país.'}</p>
      ${linksHTML(cats.seguro)}`,
  };

  const { html } = abasHTML(ABAS_PRECO, ativa, 'Categorias de preço', 'abas--compactas');
  box.innerHTML = html;
  box.querySelectorAll('[data-painel]').forEach((pn) => { pn.innerHTML = paineis[pn.dataset.painel](); });
  return ligarAbas(box, onTroca);
}
