// Persistência local — cadernos, checklist, viagens/gastos, preferências e backup (localStorage). Farol · byGui
const CHAVE = 'farol:cadernos';
const CHAVE_ATUAL = 'farol:atual';
const CHAVE_BRIEF = 'farol:briefing';
export const MAX_CADERNOS = 20;

function ler(k, padrao) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch { return padrao; }
}
function gravar(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
}

export function listarCadernos() {
  const l = ler(CHAVE, []);
  return Array.isArray(l) ? l : [];
}
export function obterCaderno(id) {
  return listarCadernos().find((c) => c.plan && c.plan.id === id) || null;
}
export function estaSalvo(id) { return !!obterCaderno(id); }

/** Salva; retorna {ok, removido} (removido = título do mais antigo descartado se passou do limite). */
export function salvarCaderno(brief, plan, extra = {}) {
  const antigo = listarCadernos().find((c) => c.plan.id === plan.id);
  const lista = listarCadernos().filter((c) => c.plan.id !== plan.id);
  lista.unshift({ brief, plan, datas: extra.datas || (antigo && antigo.datas) || null, salvoEm: new Date().toISOString() });
  let removido = null;
  while (lista.length > MAX_CADERNOS) {
    const velho = lista.pop();
    removido = velho.plan.title;
    try { localStorage.removeItem('farol:check:' + velho.plan.id); } catch {}
  }
  const ok = gravar(CHAVE, lista);
  return { ok, removido };
}
export function apagarCaderno(id) {
  gravar(CHAVE, listarCadernos().filter((c) => c.plan.id !== id));
  try { localStorage.removeItem('farol:check:' + id); } catch {}
}

export const lerChecks = (id) => new Set(ler('farol:check:' + id, []));
export const gravarChecks = (id, set) => gravar('farol:check:' + id, [...set]);

// Caderno em edição (sessão)
export function cadernoAtual() {
  try { const v = sessionStorage.getItem(CHAVE_ATUAL); return v ? JSON.parse(v) : null; } catch { return null; }
}
export function definirAtual(brief, plan, datas = null) {
  try { sessionStorage.setItem(CHAVE_ATUAL, JSON.stringify({ brief, plan, datas })); } catch {}
}
/** Atualiza as datas de um caderno salvo (e da viagem ligada a ele). */
export function definirDatasCaderno(id, datas) {
  const lista = listarCadernos();
  const c = lista.find((x) => x.plan.id === id);
  if (c) { c.datas = datas; gravar(CHAVE, lista); }
  const v = listarViagens().find((x) => x.cadernoId === id);
  if (v) { v.inicio = datas ? datas.inicio || '' : ''; v.fim = datas ? datas.fim || '' : ''; salvarViagem(v); }
  const at = cadernoAtual();
  if (at && at.plan.id === id) definirAtual(at.brief, at.plan, datas);
}
export function limparAtual() {
  try { sessionStorage.removeItem(CHAVE_ATUAL); sessionStorage.removeItem(CHAVE_BRIEF); } catch {}
}
export function lerBriefing() {
  try { const v = sessionStorage.getItem(CHAVE_BRIEF); return v ? JSON.parse(v) : null; } catch { return null; }
}
export function gravarBriefing(b) {
  try { sessionStorage.setItem(CHAVE_BRIEF, JSON.stringify(b)); } catch {}
}

/* ================= Viagens e gastos ================= */
const CHAVE_VIAGENS = 'farol:viagens';
export const MAX_VIAGENS = 30;
export const CATEGORIAS = [
  { id: 'passagem', rotulo: 'Passagem' },
  { id: 'hospedagem', rotulo: 'Hospedagem' },
  { id: 'transporte', rotulo: 'Transporte local' },
  { id: 'alimentacao', rotulo: 'Alimentação' },
  { id: 'passeios', rotulo: 'Passeios' },
  { id: 'compras', rotulo: 'Compras' },
  { id: 'seguro', rotulo: 'Seguro' },
  { id: 'outros', rotulo: 'Outros' },
];
export const categoriaRotulo = (id) => (CATEGORIAS.find((c) => c.id === id) || { rotulo: id }).rotulo;
export const orcamentoVazio = () => Object.fromEntries(CATEGORIAS.map((c) => [c.id, 0]));

export function listarViagens() {
  const l = ler(CHAVE_VIAGENS, []);
  return Array.isArray(l) ? l : [];
}
export const obterViagem = (id) => listarViagens().find((v) => v.id === id) || null;
export const viagemDoCaderno = (cid) => listarViagens().find((v) => v.cadernoId === cid) || null;

export function salvarViagem(v) {
  const lista = listarViagens().filter((x) => x.id !== v.id);
  v.atualizadaEm = new Date().toISOString();
  lista.unshift(v);
  if (lista.length > MAX_VIAGENS) return false;
  return gravar(CHAVE_VIAGENS, lista);
}
export function apagarViagem(id) { gravar(CHAVE_VIAGENS, listarViagens().filter((v) => v.id !== id)); }

export function novaViagem({ id, nome, destino = '', inicio = '', fim = '', pessoas = 1, dias = 0, cadernoId = null, orcamento = null }) {
  return { id, nome, destino, inicio, fim, pessoas, dias, cadernoId, orcamento: { ...orcamentoVazio(), ...(orcamento || {}) }, gastos: [], criadaEm: new Date().toISOString(), atualizadaEm: new Date().toISOString() };
}

/** Totais de uma viagem (tudo em reais). */
export function totaisViagem(v) {
  const planejado = CATEGORIAS.reduce((s, c) => s + (Number(v.orcamento[c.id]) || 0), 0);
  const porCat = Object.fromEntries(CATEGORIAS.map((c) => [c.id, { planejado: Number(v.orcamento[c.id]) || 0, pago: 0, pendente: 0 }]));
  let pago = 0, pendente = 0;
  v.gastos.forEach((g) => {
    const alvo = porCat[g.categoria] || porCat.outros;
    if (g.status === 'pendente') { pendente += g.valor; alvo.pendente += g.valor; } else { pago += g.valor; alvo.pago += g.valor; }
  });
  return { planejado, pago, pendente, gasto: pago + pendente, restante: planejado - pago - pendente, porCat };
}

/** Dias que faltam para usar o saldo (ou null sem datas). */
export function diasRestantes(v, hoje = new Date()) {
  const d0 = (iso) => new Date(iso + 'T12:00:00');
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12);
  if (v.inicio && v.fim) {
    const ini = d0(v.inicio), fim = d0(v.fim);
    if (fim < ini) return null;
    if (h > fim) return 0;
    const base = h < ini ? ini : h;
    return Math.round((fim - base) / 864e5) + 1;
  }
  return v.dias || null;
}
export function diasAte(iso, hoje = new Date()) {
  if (!iso) return null;
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12);
  return Math.round((new Date(iso + 'T12:00:00') - h) / 864e5);
}

/* ================= Preferências ================= */
export const lerTema = () => { try { return localStorage.getItem('farol:tema') || 'escuro'; } catch { return 'escuro'; } };
export const gravarTema = (t) => { try { localStorage.setItem('farol:tema', t); } catch {} };

/* ================= Backup ================= */
export function montarBackup() {
  const cadernos = listarCadernos();
  const checks = {};
  cadernos.forEach((c) => { const s = lerChecks(c.plan.id); if (s.size) checks[c.plan.id] = [...s]; });
  return { app: 'farol', formato: 1, exportadoEm: new Date().toISOString(), cadernos, checks, viagens: listarViagens(), preferencias: { tema: lerTema() } };
}

const ehData = (s) => s === '' || s == null || /^\d{4}-\d{2}-\d{2}$/.test(s);
/** Valida um backup; devolve { ok, erro, resumo }. */
export function validarBackup(b) {
  const falha = (erro) => ({ ok: false, erro });
  if (!b || typeof b !== 'object') return falha('O arquivo não é um backup do Farol (JSON inválido).');
  if (b.app !== 'farol' || b.formato !== 1) return falha('O arquivo não parece ser um backup do Farol (campo “app” ou “formato” diferente).');
  if (!Array.isArray(b.cadernos) || !Array.isArray(b.viagens)) return falha('O backup precisa ter as listas “cadernos” e “viagens”.');
  if (b.cadernos.length > MAX_CADERNOS) return falha(`O backup tem ${b.cadernos.length} cadernos; o limite é ${MAX_CADERNOS}.`);
  if (b.viagens.length > MAX_VIAGENS) return falha(`O backup tem ${b.viagens.length} viagens; o limite é ${MAX_VIAGENS}.`);
  for (const c of b.cadernos) {
    if (!c || !c.plan || typeof c.plan.id !== 'string' || typeof c.plan.title !== 'string' || !c.brief || !Array.isArray(c.plan.options) || !Array.isArray(c.plan.checklist) || !c.plan.money) return falha('Um dos cadernos do backup está incompleto.');
  }
  const cats = new Set(CATEGORIAS.map((c) => c.id));
  for (const v of b.viagens) {
    if (!v || typeof v.id !== 'string' || typeof v.nome !== 'string' || !v.orcamento || typeof v.orcamento !== 'object' || !Array.isArray(v.gastos)) return falha('Uma das viagens do backup está incompleta.');
    if (!ehData(v.inicio) || !ehData(v.fim)) return falha(`A viagem “${v.nome}” tem datas em formato inválido.`);
    for (const k of Object.keys(v.orcamento)) if (!cats.has(k) || !(Number(v.orcamento[k]) >= 0)) return falha(`O orçamento da viagem “${v.nome}” tem categoria ou valor inválido.`);
    for (const g of v.gastos) {
      if (!g || typeof g.id !== 'string' || !cats.has(g.categoria) || !(typeof g.valor === 'number' && isFinite(g.valor) && g.valor >= 0) || !ehData(g.data) || !['pago', 'pendente'].includes(g.status)) return falha(`Um gasto da viagem “${v.nome}” é inválido.`);
    }
  }
  if (b.checks && typeof b.checks !== 'object') return falha('A lista de checklist do backup é inválida.');
  const nG = b.viagens.reduce((s, v) => s + v.gastos.length, 0);
  return { ok: true, resumo: `${b.cadernos.length} caderno(s), ${b.viagens.length} viagem(ns) e ${nG} gasto(s)` };
}

/** Substitui os dados locais pelos do backup (depois de validado e confirmado). */
export function aplicarBackup(b) {
  listarCadernos().forEach((c) => { try { localStorage.removeItem('farol:check:' + c.plan.id); } catch {} });
  const ok1 = gravar(CHAVE, b.cadernos);
  const ok2 = gravar(CHAVE_VIAGENS, b.viagens);
  Object.entries(b.checks || {}).forEach(([id, arr]) => { if (Array.isArray(arr)) gravar('farol:check:' + id, arr.filter((x) => typeof x === 'string')); });
  if (b.preferencias && ['claro', 'escuro'].includes(b.preferencias.tema)) gravarTema(b.preferencias.tema);
  return ok1 && ok2;
}

/* ================= CSV ================= */
const celula = (v) => {
  const t = String(v ?? '');
  return /[";\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};
const dec = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace('.', ',');
/** CSV (separador ;, vírgula decimal, com BOM) — abre direto no Excel/Planilhas em PT-BR. */
export function gastosCSV(viagens) {
  const linhas = [['viagem', 'data', 'categoria', 'descricao', 'valor_brl', 'moeda_original', 'valor_original', 'status']];
  viagens.forEach((v) => v.gastos.slice().sort((a, b) => (a.data || '').localeCompare(b.data || '')).forEach((g) => {
    linhas.push([v.nome, g.data || '', categoriaRotulo(g.categoria), g.descricao || '', dec(g.valor), g.moeda || 'BRL', g.moeda && g.moeda !== 'BRL' ? dec(g.valorOriginal) : '', g.status === 'pendente' ? 'pendente' : 'pago']);
  }));
  return '\uFEFF' + linhas.map((l) => l.map(celula).join(';')).join('\r\n') + '\r\n';
}

export function baixarArquivo(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
