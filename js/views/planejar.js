// Tela: Planejar (briefing → caderno) — Farol · byGui
import { montarCaderno, briefPadrao, TRANSPORTES, ORCAMENTOS, RITMOS, DIAS, MESES_OPCOES, FRASES, transporteRotulo } from '../planner.js';
import { esc, icone, toast } from '../ui.js';
import { definirAtual, gravarBriefing, lerBriefing, limparAtual } from '../store.js';
import { msgErro } from '../api.js';

const MAX_TEXTO = 800;
const HINTS = ['Chapada dos Veadeiros', 'Fernando de Noronha', 'Serra Gaúcha', 'Lençóis Maranhenses', 'El Calafate', 'Lisboa', 'San Pedro de Atacama', 'Jalapão', 'Paraty', 'Bonito'];

export function render(ctx) {
  const { el, dados, query, signal } = ctx;
  ctx.titulo('Planejar viagem');
  let b = { ...briefPadrao(), ...(lerBriefing() || {}) };
  if (query.get('novo') === '1') { limparAtual(); b = briefPadrao(); }
  if (query.get('destino')) {
    b.destination = query.get('destino').slice(0, 80);
    b.lat = query.get('lat') ? Number(query.get('lat')) : null;
    b.lon = query.get('lon') ? Number(query.get('lon')) : null;
  }

  const radio = (name, id, rot, marcado, extra = '') => `<span><input class="chip-input" type="radio" name="${name}" id="${name}-${id}" value="${id}" ${marcado ? 'checked' : ''} ${extra}><label class="chip" for="${name}-${id}">${rot}</label></span>`;

  el.innerHTML = `
  <div class="shell">
    <section id="tela-form" aria-labelledby="t-plan">
      <p class="kicker">Caderno de bordo</p>
      <h1 id="t-plan">Monte o briefing.<br>O farol monta o resto.</h1>
      <p class="lead">Destino, como você vai e o que quer viver. O Farol devolve três roteiros com clima real, custo estimado em reais, tempo de deslocamento e um checklist de partida.</p>

      <form id="form-plan" class="form" novalidate style="margin-top:var(--sp-6)">
        <fieldset class="bloco">
          <legend><span>01</span>Destino</legend>
          <div class="campo">
            <label for="f-destino">Para onde você quer ir <span aria-hidden="true" style="color:var(--danger)">*</span></label>
            <input class="input input--grande" id="f-destino" name="destination" type="text" required minlength="2" maxlength="80" autocomplete="off" placeholder="Chapada dos Veadeiros, Lisboa, Bonito…" value="${esc(b.destination)}" aria-describedby="f-destino-erro f-destino-ajuda">
            <small id="f-destino-ajuda">Cidade, parque ou região. Obrigatório.</small>
            <p class="erro-campo" id="f-destino-erro" aria-live="polite"></p>
          </div>
          <div class="atalhos" role="group" aria-label="Sugestões de destino" style="margin-top:var(--sp-2)">
            ${HINTS.map((h) => `<button type="button" class="chip" data-hint="${esc(h)}">${esc(h)}</button>`).join('')}
          </div>
          <div class="campo">
            <label for="f-origem">De onde você sai</label>
            <input class="input" id="f-origem" name="origin" type="text" maxlength="80" list="lista-origens" autocomplete="off" placeholder="São Paulo, Curitiba, Recife…" value="${esc(b.origin)}" aria-describedby="f-origem-ajuda">
            <datalist id="lista-origens">${dados.origens.map((o) => `<option value="${esc(o.nome)}"></option>`).join('')}</datalist>
            <small id="f-origem-ajuda">Opcional. Sem origem, assumimos São Paulo e avisamos no caderno.</small>
          </div>
        </fieldset>

        <fieldset class="bloco">
          <legend><span>02</span>Como você vai</legend>
          <div class="opcoes-meio">
            ${TRANSPORTES.map((t) => `<div class="meio"><input type="radio" name="transport" id="t-${t.id}" value="${t.id}" ${b.transport === t.id ? 'checked' : ''}><label for="t-${t.id}">${icone(t.icone)}<span><strong>${t.rotulo}</strong><small>${t.dica}</small></span></label></div>`).join('')}
          </div>
        </fieldset>

        <fieldset class="bloco">
          <legend><span>03</span>O que você quer viver</legend>
          <div class="chips" role="group" aria-label="Interesses (escolha quantos quiser)">
            ${dados.interesses.map((i) => `<span><input class="chip-input" type="checkbox" name="activities" id="i-${i.id}" value="${i.id}" ${b.activities.includes(i.id) ? 'checked' : ''}><label class="chip" for="i-${i.id}">${esc(i.rotulo)}</label></span>`).join('')}
          </div>
          <div class="campo">
            <label for="f-desejo">Conte com suas palavras</label>
            <textarea class="textarea" id="f-desejo" name="wish" maxlength="${MAX_TEXTO}" rows="4" placeholder="Ver o pôr do sol, viajar com criança, evitar estrada de terra, comer o que for local…" aria-describedby="f-desejo-cont">${esc(b.wish)}</textarea>
            <span class="contador" id="f-desejo-cont">${b.wish.length} de ${MAX_TEXTO} caracteres</span>
          </div>
        </fieldset>

        <fieldset class="bloco">
          <legend><span>04</span>Tempo, gente e dinheiro</legend>
          <div class="linha-form">
            <div class="campo" role="radiogroup" aria-labelledby="r-dias"><span class="rotulo" id="r-dias">Dias</span><div class="chips">${DIAS.map((d) => radio('days', d, `${d} dias`, b.days === d)).join('')}</div></div>
            <div class="campo" role="radiogroup" aria-labelledby="r-viaj"><span class="rotulo" id="r-viaj">Viajantes</span><div class="chips">${[1, 2, 3, 4, 5, 6].map((n) => radio('travelers', n, `${n}`, b.travelers === n, `aria-label="${n} ${n > 1 ? 'viajantes' : 'viajante'}"`)).join('')}</div></div>
          </div>
          <div class="linha-form" style="margin-top:var(--sp-4)">
            <div class="campo" role="radiogroup" aria-labelledby="r-ritmo"><span class="rotulo" id="r-ritmo">Ritmo</span><div class="chips">${RITMOS.map((r) => radio('pace', r.id, r.rotulo, b.pace === r.id)).join('')}</div></div>
            <div class="campo"><label for="f-mes">Quando</label>
              <select class="select" id="f-mes" name="month">${MESES_OPCOES.map((m) => `<option value="${m.id}" ${b.month === m.id ? 'selected' : ''}>${m.id === 'flex' ? 'Flexível' : m.rotulo}</option>`).join('')}</select>
            </div>
          </div>
          <div class="campo" role="radiogroup" aria-labelledby="r-orc" style="margin-top:var(--sp-4)">
            <span class="rotulo" id="r-orc">Orçamento total do grupo (em reais)</span>
            <div class="chips">${ORCAMENTOS.map((o) => radio('budget', o.id, `${o.rotulo} <small style="opacity:.75;font-weight:500">· ${o.dica}</small>`, b.budget === o.id)).join('')}</div>
          </div>
        </fieldset>

        <div class="barra-envio">
          <span class="barra-envio__resumo" id="resumo" aria-hidden="true"></span>
          <button class="btn btn--primario" type="submit">Montar o roteiro ${icone('i-seta')}</button>
        </div>
      </form>
    </section>

    <section id="tela-carregando" hidden aria-labelledby="t-carr">
      <div class="carregando" role="status" aria-live="polite">
        <svg class="carregando__farol" aria-hidden="true"><use href="#i-farol"/></svg>
        <h1 id="t-carr" class="sr-only">Montando o caderno</h1>
        <p class="carregando__frase" id="frase">${FRASES[0]}</p>
        <p class="muted" id="carr-meta"></p>
      </div>
      <div class="grid grid--3" aria-hidden="true"><div class="sk sk--card"></div><div class="sk sk--card"></div><div class="sk sk--card"></div></div>
      <div class="acoes" style="justify-content:center"><button type="button" class="btn btn--fantasma" id="btn-cancelar">${icone('i-voltar')} Cancelar e voltar ao briefing</button></div>
    </section>
  </div>`;

  const form = el.querySelector('#form-plan');
  const fDest = el.querySelector('#f-destino');
  const erroDest = el.querySelector('#f-destino-erro');
  const txt = el.querySelector('#f-desejo');
  const cont = el.querySelector('#f-desejo-cont');
  const resumo = el.querySelector('#resumo');

  const lerForm = () => {
    const fd = new FormData(form);
    return {
      ...b,
      destination: String(fd.get('destination') || '').trim(),
      origin: String(fd.get('origin') || '').trim(),
      transport: fd.get('transport') || 'car',
      activities: fd.getAll('activities'),
      wish: String(fd.get('wish') || '').slice(0, MAX_TEXTO),
      days: Number(fd.get('days')) || 7,
      travelers: Number(fd.get('travelers')) || 2,
      pace: fd.get('pace') || 'equilibrado',
      budget: fd.get('budget') || '5-10',
      month: fd.get('month') || 'flex',
    };
  };
  const atualizarResumo = () => {
    const x = lerForm();
    resumo.textContent = x.destination.length >= 2 ? `${x.destination} · ${transporteRotulo(x.transport)} · ${x.days} dias` : 'Preencha o destino para acender o farol';
  };
  atualizarResumo();

  form.addEventListener('input', (ev) => {
    if (ev.target === fDest) { b.lat = null; b.lon = null; if (fDest.value.trim().length >= 2) { erroDest.textContent = ''; fDest.removeAttribute('aria-invalid'); } }
    if (ev.target === txt) cont.textContent = `${txt.value.length} de ${MAX_TEXTO} caracteres`;
    atualizarResumo();
    gravarBriefing(lerForm());
  });
  form.addEventListener('change', () => { atualizarResumo(); gravarBriefing(lerForm()); });
  el.querySelectorAll('[data-hint]').forEach((bt) => bt.addEventListener('click', () => {
    fDest.value = bt.dataset.hint; b.lat = null; b.lon = null;
    erroDest.textContent = ''; fDest.removeAttribute('aria-invalid');
    atualizarResumo(); gravarBriefing(lerForm()); fDest.focus();
  }));

  // ---- geração ----
  const telaForm = el.querySelector('#tela-form');
  const telaCarr = el.querySelector('#tela-carregando');
  const frase = el.querySelector('#frase');
  let ctrl = null, timerFrase = null;

  const voltarAoForm = () => {
    clearInterval(timerFrase);
    telaCarr.hidden = true; telaForm.hidden = false;
    el.querySelector('button[type="submit"]').focus();
  };
  el.querySelector('#btn-cancelar').addEventListener('click', () => {
    if (ctrl) ctrl.abort();
    voltarAoForm();
    toast('Geração cancelada. Seu briefing continua aqui.', 'info');
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const brief = lerForm();
    if (brief.destination.length < 2) {
      erroDest.textContent = 'Para onde você quer ir? Digite ao menos 2 letras.';
      fDest.setAttribute('aria-invalid', 'true');
      fDest.focus();
      toast('Para onde você quer ir?', 'erro');
      return;
    }
    gravarBriefing(brief);
    telaForm.hidden = true; telaCarr.hidden = false;
    el.querySelector('#carr-meta').textContent = `${brief.destination} · ${transporteRotulo(brief.transport)} · ${brief.days} dias`;
    el.querySelector('#btn-cancelar').focus();
    let i = 0;
    frase.textContent = FRASES[0];
    timerFrase = setInterval(() => { i = (i + 1) % FRASES.length; frase.textContent = FRASES[i]; }, 2200);
    ctrl = new AbortController();
    const meu = ctrl;
    signal.addEventListener('abort', () => { meu.abort(); clearInterval(timerFrase); }, { once: true });
    try {
      const plan = await montarCaderno(brief, dados, { signal: meu.signal });
      if (meu.signal.aborted) return;
      clearInterval(timerFrase);
      definirAtual(brief, plan);
      location.hash = '#/caderno/atual';
    } catch (e) {
      if (meu.signal.aborted || e.status === -1) return;
      console.error(e);
      voltarAoForm();
      toast(e.mensagem ? msgErro(e) : 'Não deu para montar agora. Tente de novo.', 'erro', 6000);
    }
  });
}
