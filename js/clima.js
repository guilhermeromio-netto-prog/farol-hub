// Interpretação de dados de clima — Farol · byGui
import { MESES } from './ui.js';

const WMO = {
  0: ['Céu limpo', 'i-sol'], 1: ['Predomínio de sol', 'i-sol'], 2: ['Parcialmente nublado', 'i-sol-nuvem'], 3: ['Nublado', 'i-nuvem'],
  45: ['Neblina', 'i-nevoa'], 48: ['Neblina com geada', 'i-nevoa'],
  51: ['Garoa fraca', 'i-chuva'], 53: ['Garoa', 'i-chuva'], 55: ['Garoa forte', 'i-chuva'], 56: ['Garoa congelante', 'i-chuva'], 57: ['Garoa congelante forte', 'i-chuva'],
  61: ['Chuva fraca', 'i-chuva'], 63: ['Chuva', 'i-chuva'], 65: ['Chuva forte', 'i-chuva'], 66: ['Chuva congelante', 'i-chuva'], 67: ['Chuva congelante forte', 'i-chuva'],
  71: ['Neve fraca', 'i-neve'], 73: ['Neve', 'i-neve'], 75: ['Neve forte', 'i-neve'], 77: ['Grãos de neve', 'i-neve'],
  80: ['Pancadas de chuva', 'i-chuva'], 81: ['Pancadas fortes', 'i-chuva'], 82: ['Pancadas muito fortes', 'i-tempestade'],
  85: ['Pancadas de neve', 'i-neve'], 86: ['Pancadas fortes de neve', 'i-neve'],
  95: ['Trovoadas', 'i-tempestade'], 96: ['Trovoadas com granizo', 'i-tempestade'], 99: ['Trovoadas fortes com granizo', 'i-tempestade'],
};
export const tempoTexto = (c) => (WMO[c] || ['Condição indisponível'])[0];
export const tempoIcone = (c) => (WMO[c] || [0, 'i-nuvem'])[1];

export function aqiEuropeu(v) {
  if (v == null) return { rotulo: 'Sem dado', cls: '' };
  if (v <= 20) return { rotulo: 'Boa', cls: 'selo--ok' };
  if (v <= 40) return { rotulo: 'Razoável', cls: 'selo--ok' };
  if (v <= 60) return { rotulo: 'Moderada', cls: 'selo--aviso' };
  if (v <= 80) return { rotulo: 'Ruim', cls: 'selo--perigo' };
  if (v <= 100) return { rotulo: 'Muito ruim', cls: 'selo--perigo' };
  return { rotulo: 'Extremamente ruim', cls: 'selo--perigo' };
}
export function uvTexto(v) {
  if (v == null) return 'sem dado';
  if (v < 3) return 'baixo';
  if (v < 6) return 'moderado';
  if (v < 8) return 'alto';
  if (v < 11) return 'muito alto';
  return 'extremo';
}

/** Estatística por mês a partir do arquivo diário de um ano. */
export function estatisticaMensal(arquivo) {
  const d = arquivo && arquivo.daily;
  if (!d || !d.time) return null;
  const meses = Array.from({ length: 12 }, () => ({ max: [], min: [], chuva: [], diasChuva: 0 }));
  d.time.forEach((t, i) => {
    const m = Number(t.slice(5, 7)) - 1;
    const mx = d.temperature_2m_max[i], mn = d.temperature_2m_min[i], pr = d.precipitation_sum[i];
    if (mx != null) meses[m].max.push(mx);
    if (mn != null) meses[m].min.push(mn);
    if (pr != null) { meses[m].chuva.push(pr); if (pr >= 1) meses[m].diasChuva++; }
  });
  const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const res = meses.map((m, i) => ({
    mes: i,
    nome: MESES[i],
    max: media(m.max),
    min: media(m.min),
    chuvaTotal: m.chuva.reduce((s, x) => s + x, 0),
    diasChuva: m.diasChuva,
    ok: m.max.length > 20,
  }));
  return res.every((m) => !m.ok) ? null : res;
}

/** Pontua meses para viajar: temperatura agradável e pouca chuva. alvo = temperatura média desejada. */
export function melhoresMeses(stats, alvo = 23) {
  if (!stats) return [];
  return stats.filter((m) => m.ok)
    .map((m) => {
      const med = (m.max + m.min) / 2;
      const score = -Math.abs(med - alvo) * 1.2 - m.diasChuva * 0.7 - Math.max(0, m.max - 33) * 1.5;
      return { ...m, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function estacao(lat, mes) {
  if (Math.abs(lat) < 23.5) return null; // trópicos: usa chuva/seca
  const sul = lat < 0;
  const n = ['inverno', 'inverno', 'primavera', 'primavera', 'primavera', 'verão', 'verão', 'verão', 'outono', 'outono', 'outono', 'inverno'];
  const s = ['verão', 'verão', 'outono', 'outono', 'outono', 'inverno', 'inverno', 'inverno', 'primavera', 'primavera', 'primavera', 'verão'];
  return (sul ? s : n)[mes];
}

export function descreverEstacao(lat, m) {
  const e = estacao(lat, m.mes);
  if (e) return e.charAt(0).toUpperCase() + e.slice(1);
  if (m.diasChuva >= 12) return 'Período chuvoso';
  if (m.diasChuva <= 4) return 'Período seco';
  return 'Transição entre chuva e seca';
}

/** Itens de mala ligados ao clima medido. */
export function malaParaClima({ min, max, diasChuva, uv }) {
  const l = [];
  if (max != null && max >= 28) l.push('Roupas leves e respiráveis, chapéu e garrafa reutilizável');
  if (min != null && min <= 12) l.push('Casaco quente e camadas para a noite');
  else if (min != null && min <= 17) l.push('Agasalho leve para manhãs e noites');
  if (min != null && min <= 3) l.push('Luvas, gorro e segunda pele');
  if (diasChuva != null && diasChuva >= 8) l.push('Capa de chuva ou jaqueta impermeável e calçado que seque rápido');
  if ((uv != null && uv >= 6) || (max != null && max >= 26)) l.push('Protetor solar FPS 50 e óculos escuros');
  l.push('Calçado confortável já amaciado para caminhar');
  return l.slice(0, 6);
}

/** Resumo dos próximos dias de previsão: melhores dias e alertas. */
export function condicoesProximas(prev) {
  const d = prev && prev.daily;
  if (!d || !d.time) return null;
  const dias = d.time.map((t, i) => ({
    data: t, max: d.temperature_2m_max[i], min: d.temperature_2m_min[i],
    prob: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null,
    chuva: d.precipitation_sum ? d.precipitation_sum[i] : null,
    uv: d.uv_index_max ? d.uv_index_max[i] : null,
    vento: d.wind_speed_10m_max ? d.wind_speed_10m_max[i] : null,
    code: d.weather_code[i],
  })).filter((x) => x.max != null && x.min != null);
  if (!dias.length) return null;
  const pont = (x) => -(x.prob ?? 50) * 0.08 - Math.abs(((x.max + x.min) / 2) - 23) * 0.8 - ((x.vento ?? 0) > 45 ? 3 : 0);
  const bons = [...dias].sort((a, b) => pont(b) - pont(a)).slice(0, 3).sort((a, b) => a.data.localeCompare(b.data));
  const chuvosos = dias.filter((x) => (x.prob ?? 0) >= 70).length;
  const quentes = dias.filter((x) => x.max >= 33).length;
  const frios = dias.filter((x) => x.min <= 5).length;
  const ventosos = dias.filter((x) => (x.vento ?? 0) >= 50).length;
  const uvAlto = dias.filter((x) => (x.uv ?? 0) >= 8).length;
  const tmax = Math.max(...dias.map((x) => x.max)), tmin = Math.min(...dias.map((x) => x.min));
  return { dias, bons, chuvosos, quentes, frios, ventosos, uvAlto, tmax, tmin };
}
