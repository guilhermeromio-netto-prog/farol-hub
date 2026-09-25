// Persistência local — cadernos e checklist (localStorage). Farol · byGui
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
export function salvarCaderno(brief, plan) {
  const lista = listarCadernos().filter((c) => c.plan.id !== plan.id);
  lista.unshift({ brief, plan, salvoEm: new Date().toISOString() });
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
export function definirAtual(brief, plan) {
  try { sessionStorage.setItem(CHAVE_ATUAL, JSON.stringify({ brief, plan })); } catch {}
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
