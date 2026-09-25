// Pontos turísticos do OpenStreetMap: tradução de tipos e ordenação. Farol · byGui
const TIPOS = {
  tourism: { attraction: 'Atração turística', museum: 'Museu', viewpoint: 'Mirante', theme_park: 'Parque temático', zoo: 'Zoológico' },
  historic: { monument: 'Monumento', memorial: 'Memorial', castle: 'Castelo', ruins: 'Ruínas', archaeological_site: 'Sítio arqueológico', fort: 'Forte', church: 'Igreja histórica', building: 'Edifício histórico', city_gate: 'Portão histórico', palace: 'Palácio', manor: 'Solar histórico', monastery: 'Mosteiro', tower: 'Torre histórica', ship: 'Navio histórico', wayside_shrine: 'Santuário' },
  natural: { beach: 'Praia', waterfall: 'Cachoeira', peak: 'Pico' },
};
export const GRUPOS = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'atracao', rotulo: 'Atrações' },
  { id: 'museu', rotulo: 'Museus' },
  { id: 'historico', rotulo: 'Histórico' },
  { id: 'natureza', rotulo: 'Natureza' },
  { id: 'mirante', rotulo: 'Mirantes' },
  { id: 'parque', rotulo: 'Parques' },
];

export function classificar(tags) {
  if (tags.tourism && TIPOS.tourism[tags.tourism]) {
    const t = tags.tourism;
    return { tipo: TIPOS.tourism[t], grupo: t === 'museum' ? 'museu' : t === 'viewpoint' ? 'mirante' : t === 'theme_park' || t === 'zoo' ? 'parque' : 'atracao' };
  }
  if (tags.natural && TIPOS.natural[tags.natural]) return { tipo: TIPOS.natural[tags.natural], grupo: 'natureza' };
  if (tags.historic) return { tipo: TIPOS.historic[tags.historic] || 'Patrimônio histórico', grupo: 'historico' };
  if (tags.leisure === 'park') return { tipo: 'Parque', grupo: 'parque' };
  return { tipo: 'Ponto de interesse', grupo: 'atracao' };
}

export function distanciaKm(a, b) {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Raio de busca (m) por tipo de destino. */
export function raioPara(tipo) {
  return { 'cidade-grande': 3500, historica: 4000, 'praia-urbana': 5000, praia: 9000, ilha: 9000, serra: 10000, parques: 12000, natureza: 22000, deserto: 22000 }[tipo] || 6000;
}

/** Normaliza, remove duplicados por nome e ordena por relevância (tem Wikipédia/Wikidata) e distância. */
export function organizar(elementos, centro, raio) {
  const vistos = new Set();
  const lista = [];
  elementos.forEach((e) => {
    const t = e.tags || {};
    const nome = t['name:pt'] || t.name;
    if (!nome) return;
    const lat = e.lat ?? (e.center && e.center.lat), lon = e.lon ?? (e.center && e.center.lon);
    if (lat == null || lon == null) return;
    const chave = nome.toLowerCase().trim();
    if (vistos.has(chave)) return;
    vistos.add(chave);
    const { tipo, grupo } = classificar(t);
    const dist = distanciaKm(centro, { lat, lon });
    const wp = typeof t.wikipedia === 'string' && t.wikipedia.startsWith('pt:') ? t.wikipedia.slice(3) : '';
    const score = (wp ? 3 : t.wikipedia ? 1.5 : 0) + (t.wikidata ? 1 : 0) + (t.tourism === 'attraction' || t.tourism === 'museum' ? 0.5 : 0) - (dist * 1000) / raio;
    lista.push({ id: `${e.type}/${e.id}`, nome, tipo, grupo, lat, lon, dist, wikiPt: wp, score });
  });
  return lista.sort((a, b) => b.score - a.score);
}
