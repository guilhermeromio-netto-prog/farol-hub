// Roteiro a partir das curtidas (#/descobrir): separa os lugares por dia, ordena a rota e respeita horários. Farol · byGui
// Sem IA e sem servidor: k-means sobre a distância real (distanciaKm), vizinho mais próximo dentro do dia
// e leitura simples do campo opening_hours do OpenStreetMap. O resultado tem o mesmo formato de montarCaderno().
import { distanciaKm } from './pontos.js';
import { montarCaderno } from './planner.js';

/** Dias de "lugar" no caderno (os mesmos que o caderno marca com paradas). */
export const ehDiaDeLugar = (d) => !/^(Chegada|Estrada|Volta|Último|Dia livre|Dia de descanso)/i.test(d.title);

/** k-means determinístico (início pelo ponto mais distante), com distância real em km. */
export function kmeans(pontos, k, iteracoes = 30) {
  if (!pontos.length) return [];
  k = Math.max(1, Math.min(k, pontos.length));
  const centros = [{ lat: pontos[0].lat, lon: pontos[0].lon }];
  while (centros.length < k) {
    let melhor = null, dMax = -1;
    pontos.forEach((p) => { const d = Math.min(...centros.map((c) => distanciaKm(c, p))); if (d > dMax) { dMax = d; melhor = p; } });
    centros.push({ lat: melhor.lat, lon: melhor.lon });
  }
  let rotulos = new Array(pontos.length).fill(0);
  for (let it = 0; it < iteracoes; it++) {
    const novos = pontos.map((p) => { let m = 0, dm = Infinity; centros.forEach((c, i) => { const d = distanciaKm(c, p); if (d < dm) { dm = d; m = i; } }); return m; });
    // nenhum grupo vazio: rouba o ponto mais distante do maior grupo
    for (let i = 0; i < k; i++) {
      if (novos.includes(i)) continue;
      const cont = centros.map((_, j) => novos.filter((x) => x === j).length);
      const maior = cont.indexOf(Math.max(...cont));
      let alvo = -1, dMax = -1;
      pontos.forEach((p, idx) => { if (novos[idx] === maior) { const d = distanciaKm(centros[maior], p); if (d > dMax) { dMax = d; alvo = idx; } } });
      if (alvo >= 0) novos[alvo] = i;
    }
    const mudou = novos.some((v, i) => v !== rotulos[i]);
    rotulos = novos;
    centros.forEach((c, i) => {
      const g = pontos.filter((_, idx) => rotulos[idx] === i);
      if (g.length) { c.lat = g.reduce((s, p) => s + p.lat, 0) / g.length; c.lon = g.reduce((s, p) => s + p.lon, 0) / g.length; }
    });
    if (!mudou && it > 0) break;
  }
  const grupos = centros.map((c) => ({ centro: c, lugares: [] }));
  pontos.forEach((p, i) => grupos[rotulos[i]].lugares.push(p));
  return grupos.filter((g) => g.lugares.length);
}

/** Ordem por vizinho mais próximo, começando pelo lugar mais perto do ponto de partida. */
export function vizinhoMaisProximo(lugares, inicio) {
  const resto = [...lugares];
  const ordem = [];
  let atual = inicio || resto[0];
  while (resto.length) {
    let m = 0, dm = Infinity;
    resto.forEach((p, i) => { const d = distanciaKm(atual, p); if (d < dm) { dm = d; m = i; } });
    atual = resto.splice(m, 1)[0];
    ordem.push(atual);
  }
  return ordem;
}

/**
 * Leitura simples de opening_hours: pega o primeiro intervalo HH:MM-HH:MM.
 * Devolve { abre, fecha } em horas decimais, { sempre: true } para 24/7 ou null quando não dá para ler.
 */
export function lerHorario(txt) {
  if (!txt) return null;
  const s = String(txt).trim();
  if (/^24\/7$/.test(s)) return { sempre: true };
  const m = s.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const abre = +m[1] + +m[2] / 60;
  let fecha = +m[3] + +m[4] / 60;
  if (fecha <= abre) fecha += 24;
  return { abre, fecha };
}

/** Período sugerido: 0 manhã, 1 tarde, 2 noite. Respeita o horário quando ele é conhecido. */
export function periodoPara(lugar) {
  const h = lerHorario(lugar.horario);
  if (!h || h.sempre) return null;
  if (h.fecha <= 13.5) return 0;
  if (h.abre >= 17) return 2;
  if (h.abre >= 12) return 1;
  return null;
}
const PERIODOS = ['Manhã', 'Tarde', 'Noite'];

/** Ordena um dia: rota por vizinho mais próximo e, depois, encaixa quem tem horário restrito no período certo. */
export function ordenarDia(lugares, inicio) {
  const rota = vizinhoMaisProximo(lugares, inicio);
  const base = rota.map((p, i) => ({ p, i, fixo: periodoPara(p) }));
  // sem horário restrito: metade de manhã, metade à tarde, na ordem da rota; a noite fica para quem só abre à noite
  const livres = base.filter((x) => x.fixo == null);
  livres.forEach((x, k) => { x.per = livres.length === 1 ? 0 : Math.floor((k * 2) / livres.length); });
  base.forEach((x) => { if (x.fixo != null) x.per = x.fixo; });
  return base.sort((a, b) => a.per - b.per || a.i - b.i);
}

const textoLugar = (x) => {
  const h = x.p.horario ? ` · horário no OpenStreetMap: ${x.p.horario}` : '';
  return `${PERIODOS[x.per]}: ${x.p.nome} (${x.p.tipo})${h}`;
};

/**
 * Separa as curtidas em `nDias` dias. Devolve [{ titulo, lugares (ordenados), atividades }].
 * Dias a mais que lugares ficam de fora (o caderno mantém o conteúdo padrão neles).
 */
export function agruparCurtidas(curtidas, nDias, centro) {
  const grupos = kmeans(curtidas, nDias);
  // dia mais perto do centro primeiro
  grupos.sort((a, b) => distanciaKm(centro, a.centro) - distanciaKm(centro, b.centro));
  return grupos.map((g) => {
    const ordem = ordenarDia(g.lugares, centro);
    const nomes = ordem.slice(0, 2).map((x) => x.p.nome);
    return {
      titulo: nomes.length > 1 ? `${nomes[0]} e arredores` : nomes[0],
      lugares: ordem.map((x) => x.p),
      atividades: ordem.map(textoLugar),
    };
  });
}

/**
 * Monta o caderno completo (clima, custos, checklist de montarCaderno) e troca os dias de passeio
 * pelos lugares curtidos, agrupados e ordenados. Mesmo formato de retorno de montarCaderno().
 */
export async function montarCadernoDasCurtidas(brief, dados, curtidas, { signal, onEtapa = () => {} } = {}) {
  const plan = await montarCaderno(brief, dados, { signal, onEtapa });
  const centro = plan.destino ? { lat: plan.destino.lat, lon: plan.destino.lon } : { lat: Number(brief.lat), lon: Number(brief.lon) };
  onEtapa('Separando suas curtidas por dia');
  let paradas = [];
  let foraDoRoteiro = 0;
  plan.options.forEach((op, oi) => {
    const slots = op.days.filter(ehDiaDeLugar);
    const dias = agruparCurtidas(curtidas, slots.length, centro);
    dias.forEach((d, i) => { slots[i].title = d.titulo; slots[i].activities = d.atividades; });
    if (oi === 1 || (oi === 0 && !paradas.length)) { paradas = dias.map((d) => d.lugares[0]); foraDoRoteiro = slots.length ? 0 : curtidas.length; }
  });
  plan.kicker = `Roteiro das suas curtidas · ${plan.kicker.split(' · ').slice(1).join(' · ')}`;
  plan.descobrir = { total: curtidas.length, paradas };
  plan.warnings = [
    `Os dias de passeio foram montados com os ${curtidas.length} lugares que você curtiu, agrupados por proximidade e em ordem de rota. Horários vêm do OpenStreetMap quando existem: confirme antes de ir.`,
    ...(foraDoRoteiro ? ['Este roteiro não tem dias livres no destino para encaixar as curtidas. Aumente o número de dias.'] : []),
    ...plan.warnings,
  ];
  return plan;
}
