// Links de busca pré-preenchidos — modelos verificados ficam em dados.json (links.categorias). Farol · byGui
const CODIFICAR = new Set(['qvoo', 'destino', 'origem', 'destinoCidade', 'origemMaps', 'destinoMaps', 'civitatis']);
// Kayak Carros: acentos e %20 quebram a busca (ex.: "Foz-do-Iguaçu" vira Ciudad del Este). Testado: "Foz-do-Iguacu", "Rio-de-Janeiro".
const CARRO_DESAMBIGUA = { CTG: 'Cartagena Colombia' };
export function slugKayak(nome) {
  return String(nome || '').replace(/\(.*?\)/g, '').split(',')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 -]/g, ' ').trim().replace(/\s+/g, '-');
}
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Preenche {chaves} do modelo; codifica texto livre. */
export function preencher(modelo, v) {
  return modelo.replace(/\{(\w+)\}/g, (_, k) => {
    const x = v[k] == null ? '' : String(v[k]);
    return CODIFICAR.has(k) ? encodeURIComponent(x) : x;
  });
}
const temValor = (v, k) => v[k] != null && String(v[k]).trim() !== '';

/** Datas padrão: 30 dias à frente (ou dia 10 do mês escolhido), com a duração pedida. */
export function datasPadrao(mes, dias) {
  const hoje = new Date();
  let ida;
  if (mes && mes !== 'flex') {
    const m = Number(mes) - 1;
    const ano = m > hoje.getMonth() || (m === hoje.getMonth() && hoje.getDate() < 10) ? hoje.getFullYear() : hoje.getFullYear() + 1;
    ida = new Date(ano, m, 10, 12);
  } else ida = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 30, 12);
  const volta = new Date(ida); volta.setDate(volta.getDate() + Math.max(1, (Number(dias) || 7) - 1));
  return [iso(ida), iso(volta)];
}

/**
 * Monta os valores para os modelos a partir de um contexto simples.
 * ctx: { origem, origemUF, origemLat, origemLon, destino, destinoLat, destinoLon, ida, volta, adultos, iataO, iataD, civitatis, pais }
 */
export function valores(ctx) {
  const adultos = Math.min(9, Math.max(1, Number(ctx.adultos) || 1));
  const o = ctx.origem || 'São Paulo';
  const d = ctx.destino || '';
  const alvoVoo = ctx.iataD || d, origemVoo = ctx.iataO || o;
  return {
    origem: o, destino: d, destinoCidade: slugKayak(ctx.cidadeCarro || d), ida: ctx.ida || '', volta: ctx.volta || '', adultos, quartos: Math.ceil(adultos / 2),
    iataO: (ctx.iataO || '').toUpperCase(), iataD: (ctx.iataD || '').toUpperCase(), civitatis: ctx.civitatis || '',
    qvoo: `Flights to ${alvoVoo} from ${origemVoo}${ctx.ida ? ` on ${ctx.ida}` : ''}${ctx.volta ? ` through ${ctx.volta}` : ''}`,
    origemMaps: ctx.origemLat != null ? `${ctx.origemLat},${ctx.origemLon}` : [o, ctx.origemUF, 'Brasil'].filter(Boolean).join(', '),
    destinoMaps: ctx.destinoLat != null ? `${Number(ctx.destinoLat).toFixed(4)},${Number(ctx.destinoLon).toFixed(4)}` : d,
  };
}

/** Lista por categoria: [{id, nome, itens:[{id, nome, url, preenchido, nota}]}] */
export function linksPorCategoria(dados, ctx) {
  // Carro: retirada na cidade do aeroporto de chegada (ex.: Chapada dos Veadeiros → Brasília), quando conhecida.
  const aer = ctx.iataD ? dados.aeroportos.find((a) => a.iata === String(ctx.iataD).toUpperCase()) : null;
  const cidadeCarro = aer ? (CARRO_DESAMBIGUA[aer.iata] || aer.cidade) : ctx.destino;
  const v = valores({ ...ctx, cidadeCarro });
  const retirada = String(cidadeCarro || '').replace(/\s*\(.*?\)/g, '').replace(' Colombia', '');
  const brasil = !ctx.pais || ctx.pais === 'BR';
  return dados.links.categorias.map((cat) => ({
    id: cat.id, nome: cat.nome,
    itens: cat.itens.filter((it) => !it.soBrasil || brasil).map((it) => {
      const falta = it.precisa.filter((k) => !temValor(v, k));
      const home = new URL(it.modelo).origin + '/';
      if (!it.preenche) return { id: it.id, nome: it.nome, url: it.modelo, preenchido: false, nota: 'Abre o site; preencha a busca lá (sem pré-preenchimento).' };
      if (falta.length) {
        const nota = falta.includes('civitatis') ? 'Destino sem página confirmada no site; abre a página inicial.' : falta.some((k) => k.startsWith('iata')) ? 'Informe os códigos de aeroporto para abrir já na busca.' : 'Informe as datas para abrir já na busca.';
        return { id: it.id, nome: it.nome, url: it.id === 'civitatis' ? 'https://www.civitatis.com/br/' : home, preenchido: false, nota };
      }
      const nota = it.id === 'kayak-carros' && retirada ? `Retirada em ${retirada}, nas datas da viagem` : it.preenche;
      return { id: it.id, nome: it.nome, url: preencher(it.modelo, v), preenchido: true, nota };
    }),
  }));
}

export function linkRota(dados, ctx) {
  return preencher(dados.links.rota.modelo, valores(ctx));
}

/** IATA por nome de cidade (origens + aeroportos do dados.json). */
export function iataDe(dados, nome) {
  const n = String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (!n) return '';
  const hit = dados.origens.find((o) => o.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === n)
    || dados.destaques.find((o) => o.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === n)
    || dados.aeroportos.find((o) => o.cidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === n);
  return hit ? hit.iata : '';
}
