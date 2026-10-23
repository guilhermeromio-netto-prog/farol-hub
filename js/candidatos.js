// Candidatos para o deslize (#/descobrir): pontos turísticos reais com foto e resumo. Farol · byGui
import { pontosTuristicos, fotosWiki, wikiResumo } from './api.js';
import { organizar, raioPara } from './pontos.js';

export const MAX_CANDIDATOS = 40;

/**
 * Lista de lugares reais perto do destino, já ordenada por relevância, com foto da Wikipédia quando houver.
 * destino: { lat, lon, tipo? }. Cada item: { id, nome, tipo, grupo, lat, lon, dist, wikiPt, horario, foto }.
 */
export async function listarCandidatos(destino, { signal, onTentativa } = {}) {
  const raio = raioPara(destino.tipo);
  const r = await pontosTuristicos(destino.lat, destino.lon, raio, { signal, onTentativa });
  const lista = organizar(r.elementos, { lat: destino.lat, lon: destino.lon }, raio).slice(0, MAX_CANDIDATOS);
  const titulos = lista.filter((p) => p.wikiPt).map((p) => p.wikiPt.replace(/ /g, '_'));
  if (titulos.length) {
    try {
      const fotos = await fotosWiki(titulos, { tamanho: 640, signal });
      lista.forEach((p) => { const f = p.wikiPt && fotos[p.wikiPt.replace(/ /g, '_')]; if (f) p.foto = { src: f.src, largura: f.largura, altura: f.altura }; });
    } catch (e) { if (e.status === -1) throw e; /* segue sem foto */ }
  }
  // fotos primeiro, mantendo a relevância dentro de cada grupo
  return [...lista.filter((p) => p.foto), ...lista.filter((p) => !p.foto)];
}

/** Resumo curto da Wikipédia para um lugar (só quando ele tem artigo em português). */
export async function resumoDoLugar(p, { signal } = {}) {
  if (!p.wikiPt) return '';
  try { const w = await wikiResumo(p.wikiPt, { signal }); return String(w.extract || '').slice(0, 280); }
  catch (e) { if (e.status === -1) throw e; return ''; }
}
