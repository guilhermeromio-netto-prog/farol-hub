// Planejador do Farol — gera o caderno no navegador, por regras + dados reais de clima.
// Sem IA, sem servidor. Chamado apenas via js/gerador.js (fronteira para troca futura). Custos são estimativas a partir de dados.json. Feito por byGui.
import { geocodificar, previsao, climaAnoPassado, feriados, ErroAPI } from './api.js';
import { estatisticaMensal, melhoresMeses, malaParaClima, descreverEstacao, condicoesProximas } from './clima.js';
import { MESES, reais, faixa, arred, uid, slugify, numero } from './ui.js';

export const TRANSPORTES = [
  { id: 'motorhome', rotulo: 'Motorhome', dica: 'Estrada livre, pernoite no veículo', icone: 'i-motorhome' },
  { id: 'plane', rotulo: 'Avião', dica: 'Chegada rápida, trechos aéreos', icone: 'i-aviao' },
  { id: 'car', rotulo: 'Carro', dica: 'Volante na mão, paradas no caminho', icone: 'i-carro' },
];
export const ORCAMENTOS = [
  { id: 'ate-2', rotulo: 'Até R$ 2 mil', dica: 'Enxuto', max: 2000 },
  { id: '2-5', rotulo: 'R$ 2 a 5 mil', dica: 'Contido', max: 5000 },
  { id: '5-10', rotulo: 'R$ 5 a 10 mil', dica: 'Folga', max: 10000 },
  { id: '10-20', rotulo: 'R$ 10 a 20 mil', dica: 'Conforto', max: 20000 },
  { id: '20-plus', rotulo: 'R$ 20 mil+', dica: 'Aberto', max: 40000 },
  { id: 'open', rotulo: 'Sem teto', dica: 'O melhor encaixe', max: Infinity },
];
export const RITMOS = [
  { id: 'leve', rotulo: 'Leve', n: 2, texto: 'Dias com duas atividades e bastante folga; bom para calor, crianças ou quem quer descansar.' },
  { id: 'equilibrado', rotulo: 'Equilibrado', n: 3, texto: 'Manhã e tarde ocupadas, noite livre ou com um programa leve.' },
  { id: 'intenso', rotulo: 'Intenso', n: 4, texto: 'Saídas cedo e dias cheios; exige disposição e reservas bem amarradas.' },
];
export const DIAS = [3, 5, 7, 10, 14, 21];
export const MESES_OPCOES = [{ id: 'flex', rotulo: 'Flexível' }, ...MESES.map((m, i) => ({ id: String(i + 1), rotulo: m.slice(0, 3).replace(/^./, (c) => c.toUpperCase()) }))];
export const FRASES = ['Cruzando mapas e ventos', 'Medindo km e orçamento', 'Olhando o céu da estação', 'Montando o checklist de partida', 'Comparando as três rotas'];

export const briefPadrao = () => ({ destination: '', origin: '', transport: 'car', activities: [], wish: '', days: 7, travelers: 2, budget: '5-10', month: 'flex', pace: 'equilibrado', lat: null, lon: null });

export const transporteRotulo = (id) => (TRANSPORTES.find((t) => t.id === id) || {}).rotulo || id;
export const orcamentoRotulo = (id) => (ORCAMENTOS.find((t) => t.id === id) || {}).rotulo || id;
export const mesRotulo = (id) => (id === 'flex' ? 'Época flexível' : MESES[Number(id) - 1] || id);

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function haversine(a, b) {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function resolverLugar(texto, dados, { signal, preferirBR = false } = {}) {
  const t = norm(texto);
  const palavra = (txt, termo) => new RegExp(`(^|[^a-z0-9])${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(txt);
  const dest = dados.destaques.find((d) => { const n = norm(d.nome); return n === t || palavra(t, n) || (t.length >= 5 && palavra(n, t)); });
  if (dest) return { nome: dest.nome, lat: dest.lat, lon: dest.lon, cc: dest.pais, regiao: dest.local, destaque: dest };
  const ori = dados.origens.find((o) => norm(o.nome) === t);
  if (ori) return { nome: ori.nome, lat: ori.lat, lon: ori.lon, cc: 'BR', regiao: ori.uf || '', uf: ori.uf || '', iata: ori.iata };
  const tentativas = [texto, texto.split(/,| - | e /i)[0]].map((x) => x.trim()).filter((x, i, a) => x.length >= 2 && a.indexOf(x) === i);
  for (const q of tentativas) {
    const r = await geocodificar(q, { count: 5, signal });
    if (r.length) {
      const escolhido = (preferirBR && r.find((x) => x.cc === 'BR')) || r[0];
      return { ...escolhido };
    }
  }
  return null;
}

function temporada(lugar, mes) {
  // Tendência geral de alta/baixa (não é medição): férias escolares brasileiras e verão do hemisfério.
  const m = mes + 1;
  let alta, media;
  if (lugar.cc === 'BR' || (lugar.lat != null && lugar.lat < 0 && lugar.lon < -30 && lugar.lon > -82)) { alta = [12, 1, 2, 7]; media = [6, 11, 3]; }
  else if (lugar.lat != null && lugar.lat > 23.5) { alta = [6, 7, 8, 12]; media = [4, 5, 9, 10]; }
  else { alta = [12, 1, 7]; media = [2, 6, 8]; }
  return alta.includes(m) ? 'alta' : media.includes(m) ? 'media' : 'baixa';
}

const TIERS = [
  { id: 'economico', tag: 'Econômico', nome: 'Enxuto e esperto', resumo: 'Prioriza o que é gratuito ou barato, hospedagem simples e deslocamentos por conta própria.' },
  { id: 'equilibrado', tag: 'Equilibrado', nome: 'Equilíbrio', resumo: 'Mistura passeios pagos com tempo livre, hospedagem bem localizada e reservas nos pontos-chave.' },
  { id: 'conforto', tag: 'Conforto', nome: 'Imersão com conforto', resumo: 'Guias, transfers e hospedagem melhor, para aproveitar mais com menos logística.' },
];

function pernoite(transp, tier, noDestino = true) {
  if (transp === 'motorhome') return { economico: 'Área de camping com ponto de energia', equilibrado: 'Camping estruturado com dump station e água', conforto: 'Parque de motorhome com serviços completos' }[tier];
  if (!noDestino) return 'Cidade de pernoite no caminho';
  return { economico: 'Hostel, pousada simples ou quarto em casa local', equilibrado: 'Pousada ou hotel 3 estrelas bem localizado', conforto: 'Hotel boutique ou 4 estrelas com boa avaliação' }[tier];
}

/** Gera o caderno. onEtapa(texto) recebe mensagens de progresso. */
export async function montarCaderno(brief, dados, { signal, onEtapa = () => {} } = {}) {
  onEtapa('Localizando destino e origem');
  let destino = null;
  if (brief.lat != null && brief.lon != null && !isNaN(brief.lat)) {
    const dz = dados.destaques.find((d) => norm(d.nome) === norm(brief.destination));
    destino = { nome: brief.destination, lat: Number(brief.lat), lon: Number(brief.lon), cc: dz ? dz.pais : '', destaque: dz };
    if (!destino.cc) { const r = await resolverLugar(brief.destination, dados, { signal }).catch(() => null); if (r) destino.cc = r.cc; }
  } else destino = await resolverLugar(brief.destination, dados, { signal });

  let origemAssumida = false;
  let origem = brief.origin.trim() ? await resolverLugar(brief.origin, dados, { signal, preferirBR: true }).catch(() => null) : null;
  if (!origem) { origemAssumida = true; const sp = dados.origens[0]; origem = { nome: sp.nome, lat: sp.lat, lon: sp.lon, cc: 'BR', iata: sp.iata, uf: sp.uf }; }
  if (!origem.iata || !origem.uf) { const o = dados.origens.find((x) => norm(x.nome) === norm(origem.nome)); if (o) { origem.iata = origem.iata || o.iata; origem.uf = origem.uf || o.uf; } }

  const avisos = [];
  const infoPais = destino && destino.cc ? dados.paises[destino.cc] : null;
  const regiaoId = (infoPais && infoPais.r) || 'outros';
  const custo = dados.custos[regiaoId] || dados.custos.outros;
  if (!destino) avisos.push('Não localizamos o destino no mapa. O roteiro usa faixas de custo médias e não traz clima real — tente um nome de cidade mais conhecido.');

  // ---- clima real ----
  onEtapa('Olhando o céu da estação');
  let stats = null, arqAno = null, prev = null, elevacao = null;
  if (destino) {
    const [a, p] = await Promise.allSettled([climaAnoPassado(destino.lat, destino.lon, { signal }), previsao(destino.lat, destino.lon, { signal })]);
    if (signal && signal.aborted) throw new ErroAPI('Operação cancelada.', { status: -1 });
    if (a.status === 'fulfilled') { stats = estatisticaMensal(a.value); arqAno = a.value.ano; elevacao = a.value.elevation; }
    if (p.status === 'fulfilled') { prev = p.value; elevacao = elevacao ?? p.value.elevation; }
  }
  const interesses = new Set(brief.activities.length ? brief.activities : (destino && destino.destaque ? destino.destaque.interesses.slice(0, 3) : ['natureza', 'gastronomia', 'cultura']));
  const wish = norm(brief.wish);
  if (/crianc|filho|famil|bebe/.test(wish)) interesses.add('familia');
  if (/por do sol|nascer do sol|foto/.test(wish)) interesses.add('fotografia');
  if (/comer|comida|gastron|local/.test(wish)) interesses.add('gastronomia');
  if (/descans|relax|sossego/.test(wish)) interesses.add('descanso');
  const listaInt = [...interesses].filter((id) => dados.interesses.some((x) => x.id === id));

  const melhores = melhoresMeses(stats, interesses.has('praia') ? 26 : 23);
  const mesIdx = brief.month === 'flex' ? (melhores[0] ? melhores[0].mes : new Date().getMonth()) : Number(brief.month) - 1;
  const mesStats = stats ? stats[mesIdx] : null;
  const agoraMes = new Date().getMonth();
  const anoViagem = mesIdx >= agoraMes ? new Date().getFullYear() : new Date().getFullYear() + 1;

  // ---- feriados do mês ----
  onEtapa('Conferindo feriados e lotação');
  let feriadosMes = null;
  if (destino && destino.cc) {
    try {
      const l = await feriados(destino.cc, anoViagem, { signal });
      if (l) feriadosMes = l.filter((f) => Number(f.date.slice(5, 7)) - 1 === mesIdx && f.global !== false);
    } catch (e) { if (e.status === -1) throw e; }
  }

  // ---- distâncias e logística ----
  onEtapa('Medindo km e orçamento');
  const distLinha = destino ? haversine(origem, destino) : null;
  const rodoviaOK = destino && !(destino.destaque && destino.destaque.semEstrada) && ['brasil', 'america-do-sul'].includes(regiaoId);
  let t = brief.transport;
  if (t !== 'plane' && destino && !rodoviaOK) {
    avisos.push((destino.destaque && destino.destaque.semEstrada ? destino.destaque.nota + ' ' : `Não há ligação rodoviária viável entre ${origem.nome} e ${destino.nome}. `) +
      `Por isso o roteiro abaixo foi montado de avião; no destino, dá para alugar ${t === 'motorhome' ? 'um motorhome ou carro' : 'um carro'} se fizer sentido.`);
    t = 'plane';
  }
  const veic = dados.veiculo[t] || {};
  let kmEstrada = distLinha != null ? Math.round(distLinha * 1.25) : null;
  let diasEstrada = 0;
  if (t !== 'plane') {
    if (kmEstrada != null) {
      diasEstrada = kmEstrada <= veic.kmDia * 0.6 ? 0 : Math.max(1, Math.ceil(kmEstrada / veic.kmDia - 0.15));
      const maxEstrada = Math.max(0, Math.floor((brief.days - 1) / 2));
      if (diasEstrada > maxEstrada) {
        avisos.push(`${numero(kmEstrada)} km de estrada em cada sentido pedem cerca de ${diasEstrada} dia(s) de volante na ida e outro tanto na volta. Com ${brief.days} dias, sobra pouco tempo no destino — pense em mais dias ou em outro meio.`);
        diasEstrada = maxEstrada;
      } else if (diasEstrada && brief.days - diasEstrada * 2 < Math.ceil(brief.days * 0.4)) {
        avisos.push(`São cerca de ${diasEstrada} dia(s) de estrada na ida e ${diasEstrada} na volta (${numero(kmEstrada)} km por sentido): sobram só ${brief.days - diasEstrada * 2} dia(s) no destino. Com mais dias a viagem rende bem mais.`);
      }
    }
  } else if (distLinha != null && distLinha < 350 && regiaoId === 'brasil') {
    avisos.push(`A distância em linha reta é de só ${numero(distLinha)} km: de carro pode sair mais barato e quase tão rápido quanto voar.`);
  }
  if (destino && destino.destaque && destino.destaque.terra && t !== 'plane') avisos.push(`${destino.nome} tem muitos trechos de estrada de terra e areia; veículo baixo ou motorhome grande podem não passar — confirme a rota e considere passeios 4x4 locais.`);
  if (/terra|asfalto/.test(wish) && destino && destino.destaque && destino.destaque.terra) avisos.push('Você pediu para evitar estrada de terra: nesse destino isso limita bastante os passeios; prefira operadoras locais com 4x4.');
  if (elevacao != null && elevacao > 2400) avisos.push(`O destino fica a cerca de ${numero(elevacao)} m de altitude. Reserve os primeiros dias para aclimatação e hidrate-se; converse com um médico se tiver condição cardíaca ou respiratória.`);
  if (destino && destino.destaque && destino.destaque.voucher) avisos.push('Os passeios principais funcionam com voucher e vagas limitadas por dia; reserve com antecedência.');

  const temp = destino ? temporada(destino, mesIdx) : 'media';
  if (temp === 'alta') avisos.push(`${MESES[mesIdx].replace(/^./, (c) => c.toUpperCase())} costuma ser alta temporada nesse tipo de destino: preços maiores e reservas disputadas.`);
  if (mesStats && mesStats.diasChuva >= 12) avisos.push(`Em ${MESES[mesIdx]} de ${arqAno} choveu em ${mesStats.diasChuva} dias no destino. Monte cada dia com um plano B coberto.`);

  // ---- roteiros ----
  const ritmo = RITMOS.find((r) => r.id === brief.pace) || RITMOS[1];
  const noites = Math.max(1, brief.days - 1);
  const quartos = Math.ceil(brief.travelers / 2);
  const intObj = (id) => dados.interesses.find((x) => x.id === id);
  const chuvoso = mesStats && mesStats.diasChuva >= 10;
  const horasVoo = distLinha != null ? Math.max(1, distLinha / (dados.veiculo.plane.velocidadeVoo || 750) + 0.5) : null;
  const horasEstrada = kmEstrada != null && veic.velocidade ? kmEstrada / veic.velocidade : null;
  const nomeDest = destino ? destino.nome : brief.destination;

  const internacionalP = destino && destino.cc && destino.cc !== 'BR';
  const precoReg = dados.precos ? (dados.precos.regioes[regiaoId] || dados.precos.regioes.outros) : null;
  const opcoes = TIERS.map((tier, ti) => {
    const dias = [];
    const cursor = {};
    const pegar = (id, pool) => {
      const o = intObj(id); if (!o) return null;
      const lista = o[pool];
      const k = id + pool; cursor[k] = ((cursor[k] ?? ti) % lista.length);
      const v = lista[cursor[k]]; cursor[k]++; return v;
    };
    const diasDestino = brief.days - (t === 'plane' ? 0 : diasEstrada * 2);
    let n = 1;
    // Ida
    if (t === 'plane') {
      dias.push({ day: n++, title: `Chegada a ${nomeDest}`, activities: [
        `Voo ${origem.nome} → ${nomeDest}${horasVoo ? ` (≈ ${numero(horasVoo, 1)} h se for direto; conexões somam tempo)` : ''}`,
        { economico: 'Do aeroporto, transporte público ou compartilhado até a hospedagem', equilibrado: 'Transfer ou táxi combinado até a hospedagem', conforto: 'Transfer privativo reservado com antecedência' }[tier.id],
        'Primeira volta leve pelo entorno e compras básicas',
      ].slice(0, Math.max(2, ritmo.n)), overnight: pernoite(t, tier.id) });
    } else if (diasEstrada === 0) {
      dias.push({ day: n++, title: `Estrada até ${nomeDest}`, activities: [
        kmEstrada != null ? `≈ ${numero(kmEstrada)} km de ${origem.nome} (≈ ${numero(horasEstrada, 1)} h ao volante, sem paradas)` : `Saída de ${origem.nome}`,
        'Sair cedo e parar a cada 2 horas', t === 'motorhome' ? 'Chegar ao camping antes de escurecer para nivelar e ligar energia' : 'Check-in e jantar perto da hospedagem',
      ], overnight: pernoite(t, tier.id) });
    } else {
      for (let k = 1; k <= diasEstrada; k++) {
        const ultimo = k === diasEstrada;
        dias.push({ day: n++, title: `Estrada · trecho ${k} de ${diasEstrada}`, activities: [
          `≈ ${numero(Math.round(kmEstrada / diasEstrada))} km neste trecho (média ${veic.kmDia} km/dia no máximo)`,
          'Abastecer antes de trechos longos e parar a cada 2 horas',
          ultimo ? `Chegada a ${nomeDest} no fim do dia` : (t === 'motorhome' ? 'Pernoite só em camping ou área autorizada' : 'Jantar e descanso na cidade de pernoite'),
        ], overnight: ultimo ? pernoite(t, tier.id) : pernoite(t, tier.id, false) });
      }
    }
    // Dias no destino
    const meio = Math.max(0, diasDestino - (t === 'plane' ? 2 : (diasEstrada === 0 ? 2 : 0)));
    const diaLivreEm = (tier.id !== 'economico' && meio >= 5) ? Math.ceil(meio / 2) : -1;
    for (let k = 0; k < meio; k++) {
      if (k === diaLivreEm) {
        dias.push({ day: n++, title: tier.id === 'conforto' ? 'Dia de descanso com conforto' : 'Dia livre', activities: [pegar('descanso', tier.id), 'Almoço sem pressa', 'Revisar reservas dos próximos dias'].slice(0, ritmo.n), overnight: pernoite(t, tier.id) });
        continue;
      }
      const principal = listaInt[k % listaInt.length];
      const secundario = listaInt[(k + 1) % listaInt.length];
      const atv = [pegar(principal, tier.id)];
      if (ritmo.n >= 2) atv.push(pegar(secundario !== principal ? secundario : principal, tier.id === 'conforto' ? 'equilibrado' : tier.id));
      if (ritmo.n >= 3) {
        const noite = ['gastronomia', 'vida-noturna', 'romantico'].find((x) => interesses.has(x));
        atv.push(noite ? pegar(noite, tier.id) : { economico: 'Jantar simples perto da hospedagem', equilibrado: 'Jantar em restaurante local bem avaliado', conforto: 'Jantar com reserva em restaurante de destaque' }[tier.id]);
      }
      if (ritmo.n >= 4) atv.push(pegar(listaInt[(k + 2) % listaInt.length], 'economico'));
      if (chuvoso && k % 2 === 1) atv.push('Plano B coberto se chover (museu, mercado, café ou centro cultural)');
      const rot = intObj(principal).rotulo;
      dias.push({ day: n++, title: `${rot}${k === 0 ? ' — primeiro dia inteiro' : ''}`, activities: atv.filter(Boolean), overnight: pernoite(t, tier.id) });
    }
    // Volta
    if (t === 'plane') {
      dias.push({ day: n++, title: 'Último passeio e volta', activities: ['Check-out e bagagem guardada na recepção', 'Passeio curto perto da hospedagem', `Chegar ao aeroporto com folga para o voo a ${origem.nome}`], overnight: 'Em casa' });
    } else if (diasEstrada === 0) {
      dias.push({ day: n++, title: 'Volta pela estrada', activities: [t === 'motorhome' ? 'Esvaziar tanques na dump station e reabastecer água antes de sair' : 'Check-out cedo', kmEstrada != null ? `≈ ${numero(kmEstrada)} km até ${origem.nome}` : `Retorno a ${origem.nome}`, 'Paradas a cada 2 horas'], overnight: 'Em casa' });
    } else {
      for (let k = 1; k <= diasEstrada; k++) {
        const ultimo = k === diasEstrada;
        dias.push({ day: n++, title: `Volta · trecho ${k} de ${diasEstrada}`, activities: [
          k === 1 && t === 'motorhome' ? 'Esvaziar tanques e reabastecer água antes de pegar a estrada' : 'Sair cedo e evitar dirigir à noite',
          `≈ ${numero(Math.round(kmEstrada / diasEstrada))} km neste trecho`,
          ultimo ? `Chegada a ${origem.nome}` : 'Pernoite no caminho',
        ], overnight: ultimo ? 'Em casa' : pernoite(t, tier.id, false) });
      }
    }

    // ---- custos (estimativa) ----
    const L = [];
    const f = (a) => [arred(a[0]), arred(a[1])];
    const paceF = { leve: 0.75, equilibrado: 1, intenso: 1.3 }[brief.pace] || 1;
    if (t === 'plane') {
      const [a, b] = custo.aereo;
      const faixaAereo = { economico: [a, (a + b) / 2], equilibrado: [a * 1.1, b], conforto: [b * 0.9, b * 1.5] }[tier.id];
      L.push({ cat: 'passagem', item: 'Passagens aéreas (ida e volta)', amountMin: faixaAereo[0] * brief.travelers, amountMax: faixaAereo[1] * brief.travelers, note: `Classe econômica, ${brief.travelers} pessoa(s), saindo do Brasil` });
      const [ba, bb] = dados.veiculo.plane.bagagemTrecho;
      if (tier.id !== 'economico') L.push({ cat: 'passagem', item: 'Bagagem despachada', amountMin: ba * 2 * brief.travelers * (tier.id === 'conforto' ? 0 : 1), amountMax: bb * 2 * brief.travelers, note: tier.id === 'conforto' ? 'Muitas tarifas maiores já incluem a mala' : 'Uma mala por pessoa, ida e volta' });
      const tl = custo.transporteLocal;
      const mult = { economico: 0.6, equilibrado: 1, conforto: 1.8 }[tier.id];
      L.push({ cat: 'transporte', item: 'Transporte no destino', amountMin: tl[0] * brief.days * mult, amountMax: tl[1] * brief.days * mult, note: tier.id === 'conforto' ? 'Transfers e carro alugado ou motorista' : 'Transporte público, aplicativo ou carro dividido' });
    } else if (kmEstrada != null) {
      const kmTotal = kmEstrada * 2 + Math.max(0, brief.days - diasEstrada * 2) * 40;
      L.push({ cat: 'transporte', item: t === 'motorhome' ? 'Diesel, pedágio e desgaste' : 'Combustível e pedágio', amountMin: kmTotal * veic.custoKm[0], amountMax: kmTotal * veic.custoKm[1], note: `≈ ${numero(kmTotal)} km no total. ${veic.nota}` });
      if (t === 'car') L.push({ cat: 'transporte', item: 'Estacionamento', amountMin: 20 * brief.days, amountMax: 70 * brief.days, note: 'Hospedagem e atrações' });
    }
    if (t === 'motorhome') {
      const pn = veic.pernoite[tier.id];
      L.push({ cat: 'hospedagem', item: 'Campings e pernoites', amountMin: pn[0] * noites, amountMax: pn[1] * noites, note: 'Por veículo, com energia e água' });
    } else {
      const h = custo.hospedagem[tier.id];
      L.push({ cat: 'hospedagem', item: 'Hospedagem', amountMin: h[0] * noites * quartos, amountMax: h[1] * noites * quartos, note: `${noites} noite(s), ${quartos} quarto(s) duplo(s)` });
    }
    const al = custo.alimentacao[tier.id];
    const alF = t === 'motorhome' ? 0.75 : 1;
    L.push({ cat: 'alimentacao', item: 'Alimentação', amountMin: al[0] * brief.days * brief.travelers * alF, amountMax: al[1] * brief.days * brief.travelers * alF, note: t === 'motorhome' ? 'Considera parte das refeições feitas no veículo' : 'Por pessoa, três refeições por dia' });
    const at = custo.atividades[tier.id];
    const diasAtiv = Math.max(1, brief.days - (t === 'plane' ? 1 : diasEstrada * 2)) * 0.8; // nem todo dia tem passeio pago
    L.push({ cat: 'passeios', item: 'Passeios e ingressos', amountMin: at[0] * diasAtiv * brief.travelers * paceF, amountMax: at[1] * diasAtiv * brief.travelers * paceF, note: `Ritmo ${ritmo.rotulo.toLowerCase()}` });
    if (internacionalP && precoReg) {
      const sg = precoReg.seguro; const fx = { economico: sg.economico, equilibrado: [(sg.economico[0] + sg.medio[0]) / 2, (sg.economico[1] + sg.medio[1]) / 2], conforto: sg.medio }[tier.id];
      L.push({ cat: 'seguro', item: 'Seguro viagem', amountMin: fx[0] * brief.days * brief.travelers, amountMax: fx[1] * brief.days * brief.travelers, note: 'Por pessoa por dia; alguns países exigem cobertura mínima' });
    }
    const sub = L.reduce((s, x) => [s[0] + x.amountMin, s[1] + x.amountMax], [0, 0]);
    L.push({ cat: 'outros', item: 'Reserva para imprevistos (10%)', amountMin: sub[0] * 0.1, amountMax: sub[1] * 0.1, note: 'Taxas locais, gorjetas, farmácia' });
    L.forEach((x) => { [x.amountMin, x.amountMax] = f([x.amountMin, x.amountMax]); });
    const totMin = L.reduce((s, x) => s + x.amountMin, 0), totMax = L.reduce((s, x) => s + x.amountMax, 0);

    const orc = ORCAMENTOS.find((o) => o.id === brief.budget) || ORCAMENTOS[5];
    let fit;
    if (orc.max === Infinity) fit = 'Sem teto definido: escolha pelo estilo de viagem.';
    else if (totMax <= orc.max) fit = `Cabe no orçamento informado (${orc.rotulo}) com folga para imprevistos.`;
    else if (totMin <= orc.max) fit = `Encosta no teto de ${orc.rotulo}: cabe se as escolhas ficarem perto da faixa mínima.`;
    else fit = `Passa do orçamento informado (${orc.rotulo}) em cerca de ${reais(arred(totMin - orc.max, 100))} mesmo na faixa mínima.`;

    const destaquesOp = [...new Set(dias.flatMap((d) => d.activities).filter((a) => !/^Voo|^≈|Check|Estrada|Abastecer|Sair cedo|Chegar|Chegada|Paradas|Esvaziar|Pernoite|Plano B|Revisar|Almoço sem|Primeira volta|Do aeroporto|Transfer|Passeio curto|cidade de pernoite|Jantar simples/.test(a)))].slice(0, 4);
    return { id: tier.id, name: tier.nome, tag: tier.tag, summary: tier.resumo, highlights: destaquesOp, days: dias, estimatedMin: totMin, estimatedMax: totMax, breakdown: L, fit };
  });

  const eq = opcoes[1];
  const orc = ORCAMENTOS.find((o) => o.id === brief.budget) || ORCAMENTOS[5];
  if (orc.max !== Infinity && opcoes[0].estimatedMin > orc.max) avisos.push(`Mesmo a opção Econômica passa do orçamento de ${orc.rotulo}. Reduza dias, viajantes ou escolha um destino mais perto.`);

  // ---- clima do caderno ----
  let clima;
  if (mesStats && mesStats.ok) {
    const cond = prev ? condicoesProximas(prev) : null;
    const pertoDaViagem = brief.month === 'flex' || mesIdx === agoraMes;
    clima = {
      season: descreverEstacao(destino.lat, mesStats),
      tempMinC: Math.round(mesStats.min), tempMaxC: Math.round(mesStats.max),
      rain: `${mesStats.diasChuva} dia(s) com chuva (≥ 1 mm) e ${numero(mesStats.chuvaTotal)} mm em ${MESES[mesIdx]} de ${arqAno}`,
      packing: malaParaClima({ min: mesStats.min, max: mesStats.max, diasChuva: mesStats.diasChuva, uv: cond ? Math.max(...cond.dias.map((x) => x.uv ?? 0)) : null }),
      bestWindow: melhores.length ? `Pelo registro de ${arqAno}, os meses mais agradáveis foram ${melhores.map((m) => m.nome).join(', ').replace(/, ([^,]*)$/, ' e $1')} (temperatura amena e menos dias de chuva).` : 'Sem dados suficientes para indicar a melhor janela.',
      notes: (brief.month === 'flex' ? `Época flexível: usamos ${MESES[mesIdx]}, o mês mais agradável de ${arqAno}, como referência. ` : '') +
        (cond && pertoDaViagem ? `Nos próximos 16 dias a previsão vai de ${Math.round(cond.tmin)}° a ${Math.round(cond.tmax)}°C, com ${cond.chuvosos} dia(s) de chance alta de chuva.` : `A previsão do tempo só alcança 16 dias; para ${MESES[mesIdx]} os números vêm do registro de ${arqAno}.`),
      fonte: `Open-Meteo — arquivo histórico de ${arqAno}${prev ? ' e previsão de 16 dias' : ''}`,
      meses: stats.map((m) => ({ mes: m.mes, max: m.max != null ? Math.round(m.max) : null, min: m.min != null ? Math.round(m.min) : null, diasChuva: m.diasChuva, ok: m.ok })),
      melhores: melhores.map((m) => m.mes),
      mesRef: mesIdx,
    };
  } else {
    clima = { season: 'Sem dados', tempMinC: null, tempMaxC: null, rain: 'Não foi possível obter o clima deste destino agora.', packing: malaParaClima({}), bestWindow: 'Sem dados de clima para indicar a melhor janela.', notes: 'Os serviços de clima não responderam ou o destino não foi localizado. Nada foi inventado aqui.', fonte: '', meses: [], melhores: [], mesRef: mesIdx };
  }

  // ---- tempo / logística ----
  const hipotese = origemAssumida ? ` Origem não informada: assumimos ${origem.nome} como ponto de partida.` : '';
  let ida, volta;
  if (t === 'plane') {
    ida = distLinha != null ? `Voo de ${origem.nome} a ${nomeDest}: ${numero(distLinha)} km em linha reta, ≈ ${numero(horasVoo, 1)} h de voo direto. Conexões podem dobrar esse tempo.${hipotese}` : `Voo de ${origem.nome} ao destino.${hipotese}`;
    volta = 'Mesmo trajeto na volta. Reserve meio dia livre antes do voo e chegue ao aeroporto com 2 h (nacional) ou 3 h (internacional) de antecedência.';
  } else {
    ida = kmEstrada != null ? `≈ ${numero(kmEstrada)} km de estrada (linha reta × 1,25), ≈ ${numero(horasEstrada, 1)} h ao volante sem paradas. ${diasEstrada ? `Em trechos de até ${veic.kmDia} km/dia: ${diasEstrada} dia(s) de ida.` : 'Dá para fazer em um dia.'}${hipotese}` : `Saída de ${origem.nome}.${hipotese}`;
    volta = diasEstrada ? `${diasEstrada} dia(s) de volta pelo mesmo caminho ou variando a rota. Evite dirigir à noite.` : 'Volta no último dia, saindo cedo.';
  }
  const nFer = feriadosMes ? feriadosMes.length : null;
  const disponibilidade = (nFer === null ? 'Sem dados de feriados para este país. ' : nFer ? `${nFer} feriado(s) nacional(is) no destino em ${MESES[mesIdx]} de ${anoViagem}: ${feriadosMes.map((x) => `${x.localName} (${x.date.slice(8, 10)}/${x.date.slice(5, 7)})`).join(', ')}. ` : `Nenhum feriado nacional no destino em ${MESES[mesIdx]} de ${anoViagem}. `) +
    ({ alta: 'Tendência de alta temporada.', media: 'Tendência de média temporada.', baixa: 'Tendência de baixa temporada — bom para preço.' }[temp]);
  const antecedencia = t === 'plane'
    ? (temp === 'alta' ? 'Voos: 60 a 120 dias antes. Hospedagem: assim que fechar as datas. Passeios com vaga limitada: 30 dias.' : 'Voos: 45 a 90 dias antes. Hospedagem: 30 a 60 dias. Passeios: 1 a 2 semanas.')
    : (t === 'motorhome' ? 'Campings concorridos: 30 a 60 dias antes (mais em feriados). Revisão do veículo: 2 semanas antes.' : 'Hospedagem: 30 a 60 dias antes (mais em feriados). Revisão do carro: 2 semanas antes.');
  const lotacao = ({ alta: 'Alta: filas, preços maiores e reservas obrigatórias nos pontos principais.', media: 'Média: movimento razoável; reserve o essencial.', baixa: 'Baixa: mais sossego e preço, alguns serviços podem ter horário reduzido.' }[temp]) + (nFer ? ' Feriados no mês aumentam a procura local.' : '');

  // ---- checklist ----
  const internacional = destino && destino.cc && destino.cc !== 'BR';
  const grupos = [];
  const add = (lista) => lista.forEach((g) => {
    let alvo = grupos.find((x) => x.category === g.categoria);
    if (!alvo) { alvo = { category: g.categoria, items: [] }; grupos.push(alvo); }
    g.itens.forEach((i) => alvo.items.push({ id: i.id, label: i.label, why: i.why, timing: i.timing }));
  });
  if (internacional) add(dados.checklists.internacional);
  add(dados.checklists[t] || []);
  add(dados.checklists.comum);
  if (clima.packing.length) {
    const g = grupos.find((x) => x.category === 'Mala');
    g.items.unshift({ id: 'mala-clima', label: `Mala para o clima: ${clima.packing.slice(0, 3).join('; ').toLowerCase()}`, why: clima.tempMinC != null ? `${clima.tempMinC}° a ${clima.tempMaxC}°C em ${MESES[mesIdx]} (registro de ${arqAno})` : 'Confira a previsão perto da data', timing: 'Três dias antes' });
  }
  if (internacional && infoPais && infoPais.m[0] && infoPais.m[0] !== 'BRL') {
    grupos.find((x) => x.category === 'Dinheiro').items.push({ id: 'din-moeda', label: `Planejar como pagar em ${infoPais.m[0]} (cartão com boa taxa, conta global ou espécie)`, why: 'Câmbio e IOF mudam o custo final', timing: 'Duas semanas antes' });
  }
  // ids únicos
  const usados = new Set();
  grupos.forEach((g) => g.items.forEach((i) => { let id = slugify(i.id) || 'item'; while (usados.has(id)) id += '-x'; usados.add(id); i.id = id; }));

  // ---- dicas de especialista ----
  const dicas = [];
  if (t === 'plane') dicas.push('Compare voos para aeroportos alternativos e em dias de semana; terça e quarta costumam ter tarifas menores.', 'Leve uma muda de roupa na bagagem de mão para o caso de extravio da mala.');
  if (t === 'car') dicas.push('Divida a direção quando houver mais de um motorista habilitado e evite trechos noturnos em estrada simples.', 'Aplicativos de rota com informação de pedágio ajudam a prever custo real do trajeto.');
  if (t === 'motorhome') dicas.push('Planeje pernoites a cada 300–450 km e chegue de dia para nivelar e ligar energia.', 'Tanque de água cheio e de servidas vazio antes de trechos remotos.');
  if (interesses.has('natureza') || interesses.has('aventura')) dicas.push('Em parques, comece as trilhas cedo e confira horário de fechamento da portaria.');
  if (interesses.has('gastronomia')) dicas.push('Pergunte o prato do dia nos restaurantes de bairro: costuma ser o mais fresco e o mais barato.');
  if (internacional) dicas.push('Salve cópias digitais do passaporte e do seguro em local acessível offline.');
  if (temp === 'alta') dicas.push('Na alta temporada, faça os passeios mais disputados logo cedo ou no fim da tarde.');

  const economia = [];
  economia.push(t === 'plane' ? 'Monitore o preço dos voos por algumas semanas antes de comprar.' : 'Abasteça em cidades maiores, onde o combustível costuma ser mais barato do que em áreas turísticas.');
  economia.push('Hospedagem com cozinha reduz o gasto com alimentação.');
  if (temp === 'alta') economia.push('Mudar a viagem para um mês de média ou baixa temporada pode baratear hospedagem de forma relevante.');
  if (t === 'motorhome') economia.push(`Se for alugar o motorhome, some cerca de ${faixa(...dados.veiculo.motorhome.aluguelDia)} por dia (faixa estimada, não incluída no total).`);

  const pessoas = `${brief.travelers} pessoa${brief.travelers > 1 ? 's' : ''}`;
  const titulo = t === 'plane' ? `${nomeDest}, de avião` : t === 'car' ? `${nomeDest} de carro` : `${nomeDest} de motorhome`;
  const summary = [
    `${brief.days} dias em ${nomeDest}${destino && infoPais ? ` (${infoPais.n})` : ''}, para ${pessoas}, saindo de ${origem.nome}.`,
    clima.tempMinC != null ? `Em ${MESES[mesIdx]} o registro de ${arqAno} marcou ${clima.tempMinC}° a ${clima.tempMaxC}°C e ${mesStats.diasChuva} dias de chuva.` : '',
    `A opção Equilibrado fica em ${faixa(eq.estimatedMin, eq.estimatedMax)} para o grupo (estimativa).`,
    brief.wish.trim() ? `Seu pedido: “${brief.wish.trim().slice(0, 160)}${brief.wish.trim().length > 160 ? '…' : ''}”.` : '',
  ].filter(Boolean).join(' ');

  onEtapa('Comparando as três rotas');
  return {
    id: uid(),
    title: titulo,
    kicker: `Roteiro sugerido · ${transporteRotulo(t)} · ${mesRotulo(brief.month)}`,
    summary,
    destino: destino ? { nome: destino.nome, lat: destino.lat, lon: destino.lon, cc: destino.cc || '', slug: destino.destaque ? destino.destaque.slug : '', iata: destino.destaque ? destino.destaque.iata : '', tipo: destino.destaque ? destino.destaque.tipo : '', civitatis: destino.destaque ? destino.destaque.civitatis || '' : '', wiki: destino.destaque ? destino.destaque.wiki : '' } : null,
    origem: { nome: origem.nome, assumida: origemAssumida, iata: origem.iata || '', uf: origem.uf || '', lat: origem.lat, lon: origem.lon },
    regiao: regiaoId,
    transporte: t,
    regiaoCusto: custo.nome,
    climate: clima,
    money: { totalMin: eq.estimatedMin, totalMax: eq.estimatedMax, perPerson: false, breakdown: eq.breakdown, savingTips: economia },
    time: { outbound: ida, inbound: volta, dailyPace: ritmo.texto, availability: disponibilidade, bookingLead: antecedencia, crowding: lotacao },
    options: opcoes,
    checklist: grupos,
    warnings: avisos,
    localTips: dicas.slice(0, 6),
    createdAt: new Date().toISOString(),
  };
}
