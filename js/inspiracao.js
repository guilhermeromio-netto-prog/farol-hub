// Estimativa rápida e "cabe no seu bolso?" — só cálculo sobre os custos do dados.json e os números que a pessoa digita.
// Usa a mesma base de custos do roteiro sugerido (dados.custos e dados.precos). Farol · byGui
import { reais, faixa, arred, esc, numero } from './ui.js';

const regiaoDe = (dados, cc) => (cc === 'BR' ? 'brasil' : (dados.paises[cc] || {}).r || 'outros');

/** Faixa total estimada (R$) para o grupo, nos estilos Econômico e Equilibrado. Partindo de capital brasileira. */
export function estimarRapido(dados, { cc, dias, pessoas }) {
  const reg = regiaoDe(dados, cc);
  const custo = dados.custos[reg] || dados.custos.outros;
  const preco = dados.precos.regioes[reg] || dados.precos.regioes.outros;
  const nacional = cc === 'BR';
  const noites = Math.max(1, dias - 1), quartos = Math.ceil(pessoas / 2);
  const [a, b] = custo.aereo;
  const estilos = {
    economico: { aereo: [a, (a + b) / 2], tl: 0.6, seg: preco.seguro.economico },
    equilibrado: { aereo: [a * 1.1, b], tl: 1, seg: [(preco.seguro.economico[0] + preco.seguro.medio[0]) / 2, (preco.seguro.economico[1] + preco.seguro.medio[1]) / 2] },
  };
  const out = { regiao: reg, regiaoNome: custo.nome, nacional };
  for (const [id, e] of Object.entries(estilos)) {
    const h = custo.hospedagem[id], al = custo.alimentacao[id], at = custo.atividades[id];
    const itens = {
      passagem: [e.aereo[0] * pessoas, e.aereo[1] * pessoas],
      hospedagem: [h[0] * noites * quartos, h[1] * noites * quartos],
      transporte: [custo.transporteLocal[0] * dias * e.tl, custo.transporteLocal[1] * dias * e.tl],
      alimentacao: [al[0] * dias * pessoas, al[1] * dias * pessoas],
      passeios: [at[0] * Math.max(1, dias - 1) * 0.8 * pessoas, at[1] * Math.max(1, dias - 1) * 0.8 * pessoas],
      seguro: nacional ? [0, 0] : [e.seg[0] * dias * pessoas, e.seg[1] * dias * pessoas],
    };
    const sub = Object.values(itens).reduce((s, x) => [s[0] + x[0], s[1] + x[1]], [0, 0]);
    out[id] = { min: arred(sub[0] * 1.1), max: arred(sub[1] * 1.1), itens };
  }
  return out;
}

/** Quantos destinos em destaque cabem no orçamento (estilo Econômico, pela faixa mínima). */
export function destinosQueCabem(dados, orcamento, dias, pessoas) {
  const lista = dados.destaques.map((d) => ({ d, e: estimarRapido(dados, { cc: d.pais, dias, pessoas }).economico }));
  const cabem = lista.filter((x) => x.e.min <= orcamento);
  return { total: lista.length, cabem: cabem.length, maisBarato: [...lista].sort((x, y) => x.e.min - y.e.min).slice(0, 3).map((x) => x.d) };
}

/** Texto do veredito, calculado só com a estimativa e o orçamento informado. */
export function veredito(est, orcamento) {
  const { economico: eco, equilibrado: eq } = est;
  if (orcamento >= eq.max) return { nivel: 'ok', texto: `Cabe até no estilo Equilibrado (${faixa(eq.min, eq.max)}), com folga de pelo menos ${reais(orcamento - eq.max)} sobre o teto da estimativa.` };
  if (orcamento >= eq.min) return { nivel: 'ok', texto: `Cabe no estilo Equilibrado se as escolhas ficarem na parte de baixo da faixa (${faixa(eq.min, eq.max)}). No teto, faltariam ${reais(eq.max - orcamento)}.` };
  if (orcamento >= eco.max) return { nivel: 'ok', texto: `Cabe no estilo Econômico (${faixa(eco.min, eco.max)}) e sobram pelo menos ${reais(orcamento - eco.max)}. Para o Equilibrado faltariam de ${reais(eq.min - orcamento)} a ${reais(eq.max - orcamento)}.` };
  if (orcamento >= eco.min) return { nivel: 'aviso', texto: `Aperta: cabe só perto da faixa mínima do estilo Econômico (${faixa(eco.min, eco.max)}). No teto, faltariam ${reais(eco.max - orcamento)}.` };
  return { nivel: 'aviso', texto: `Abaixo da faixa do estilo Econômico (${faixa(eco.min, eco.max)}): faltam de ${reais(eco.min - orcamento)} a ${reais(eco.max - orcamento)}. Reduzir dias ou pessoas, ou escolher um destino mais perto, ajuda.` };
}

const CHAVE = 'farol:bolso';
export function lerBolso() {
  try { const o = JSON.parse(localStorage.getItem(CHAVE) || 'null'); if (o && o.orcamento > 0) return { orcamento: +o.orcamento, dias: +o.dias || 7, pessoas: +o.pessoas || 2 }; } catch {}
  return { orcamento: 0, dias: 7, pessoas: 2 };
}
export function gravarBolso(b) { try { localStorage.setItem(CHAVE, JSON.stringify(b)); } catch {} }

/** Frase de inspiração: a primeira do texto que não seja só número (população, área); corta a oração de estatística. */
export function primeiraFrase(t, max = 220) {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  const frases = (s.match(/.+?[.!?](?=\s+[A-ZÀ-Ú]|\s*$)/g) || [s]).slice(0, 3);
  const estat = /(popula[cç][aã]o|habitantes|km²|densidade|\d{1,3}(\.\d{3})+)/i;
  const corta = (x) => x.replace(/,\s*(com|tendo|numa|em uma|numa área)\b[^,]*(popula|habitantes|km²|\d{1,3}(\.\d{3})+)[\s\S]*$/i, '');
  let f = (frases[0] || '').trim();
  if (estat.test(f)) {
    const c = corta(f);
    if (c !== f && c.length > 20) f = c + '.';
    else f = (frases.find((x) => !estat.test(x)) || f).trim();
  }
  return f.length > max ? f.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : f;
}

export function valorBR(v) { const n = Number(String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; }
export { numero, esc };
