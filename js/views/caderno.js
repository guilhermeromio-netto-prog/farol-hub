// Tela: Caderno (resultado do planejador) — Farol · byGui
import { esc, icone, faixa, reais, toast, MESES, MESES_CURTOS, confirmar } from '../ui.js';
import { cadernoAtual, obterCaderno, salvarCaderno, estaSalvo, lerChecks, gravarChecks, apagarCaderno, limparAtual, MAX_CADERNOS } from '../store.js';
import { transporteRotulo, mesRotulo, orcamentoRotulo } from '../planner.js';

export function render(ctx) {
  const { el, params } = ctx;
  const id = params[0];
  const reg = id === 'atual' ? cadernoAtual() : obterCaderno(id);
  if (!reg) {
    ctx.titulo('Caderno não encontrado');
    el.innerHTML = `<section class="shell"><a class="voltar" href="#/cadernos">${icone('i-voltar')} Cadernos</a><h1>Caderno não encontrado</h1><p class="lead">${id === 'atual' ? 'Não há um caderno em edição nesta sessão.' : 'Ele pode ter sido apagado ou foi salvo em outro aparelho.'}</p><div class="acoes"><a class="btn btn--primario" href="#/planejar">Montar um caderno</a><a class="btn btn--fantasma" href="#/cadernos">Ver cadernos salvos</a></div></section>`;
    return;
  }
  const { brief, plan } = reg;
  ctx.titulo(plan.title);
  let sel = 1; // opção Equilibrado começa selecionada
  let aba = 'opcoes';
  const checks = lerChecks(plan.id);
  const totalItens = plan.checklist.reduce((s, g) => s + g.items.length, 0);
  const pct = () => (totalItens ? Math.round((checks.size / totalItens) * 100) : 0);
  const salvo = () => estaSalvo(plan.id);
  const c = plan.climate;

  const ABAS = [
    ['opcoes', 'Opções'], ['clima', 'Clima'], ['dinheiro', 'Dinheiro'], ['tempo', 'Tempo'], ['checklist', 'Checklist'],
  ];

  const qPreco = new URLSearchParams({ destino: plan.destino ? plan.destino.nome : brief.destination, origem: plan.origem.nome, viajantes: brief.travelers, dias: brief.days, transporte: brief.transport });
  if (plan.destino && plan.destino.cc) qPreco.set('pais', plan.destino.cc);
  if (plan.destino && plan.destino.iata) qPreco.set('iata', plan.destino.iata);
  if (plan.origem.iata) qPreco.set('iataOrigem', plan.origem.iata);
  if (brief.month !== 'flex') qPreco.set('mes', brief.month);
  const linkDestino = plan.destino ? (plan.destino.slug ? `#/destino/${plan.destino.slug}` : `#/destino/${plan.destino.lat.toFixed(4)},${plan.destino.lon.toFixed(4)}?${new URLSearchParams({ nome: plan.destino.nome, pais: plan.destino.cc })}`) : '';

  el.innerHTML = `
  <div class="shell">
    <a class="voltar" href="${id === 'atual' ? '#/planejar' : '#/cadernos'}">${icone('i-voltar')} ${id === 'atual' ? 'Briefing' : 'Cadernos'}</a>
    <p class="kicker">${esc(plan.kicker)}</p>
    <h1>${esc(plan.title)}</h1>
    <div class="meta-linha">
      <span class="selo">${esc(transporteRotulo(brief.transport))}</span>
      <span class="selo">${brief.days} dias</span>
      <span class="selo">${brief.travelers} ${brief.travelers > 1 ? 'viajantes' : 'viajante'}</span>
      <span class="selo">${esc(mesRotulo(brief.month))}</span>
      <span class="selo">${esc(orcamentoRotulo(brief.budget))}</span>
      ${plan.origem.assumida ? '<span class="selo selo--aviso">Origem assumida: ' + esc(plan.origem.nome) + '</span>' : ''}
    </div>
    <p class="lead">${esc(plan.summary)}</p>
    <div class="acoes">
      <button type="button" class="btn btn--primario" id="btn-salvar">${salvo() ? 'Salvo neste aparelho' : 'Salvar caderno'}</button>
      <a class="btn btn--secundario" href="#/precos?${qPreco}">Ver preços reais</a>
      ${linkDestino ? `<a class="btn btn--fantasma" href="${esc(linkDestino)}">Painel do destino</a>` : ''}
      ${id === 'atual' ? `<a class="btn btn--fantasma" href="#/planejar">Editar briefing</a><button type="button" class="btn btn--fantasma" id="btn-nova">Nova viagem</button>` : `<button type="button" class="btn btn--fantasma" id="btn-apagar" aria-label="Apagar o caderno ${esc(plan.title)}">${icone('i-lixo')} Apagar</button>`}
    </div>

    <div class="grid grid--4" style="margin-top:var(--sp-6)">
      <div class="card card--tight"><p class="card__rotulo">Clima</p><p class="card__valor num">${c.tempMinC != null ? `${c.tempMinC}–${c.tempMaxC}°C` : '—'}</p><p class="card__detalhe">${esc(c.season)}</p></div>
      <div class="card card--tight"><p class="card__rotulo">Estimativa</p><p class="card__valor num" style="font-size:1.15rem">${faixa(plan.money.totalMin, plan.money.totalMax)}</p><p class="card__detalhe">Grupo · opção Equilibrado</p></div>
      <div class="card card--tight"><p class="card__rotulo">Ida</p><p class="card__valor" style="font-size:1rem;line-height:1.35">${esc(plan.time.outbound.split('. ')[0])}</p></div>
      <div class="card card--tight"><p class="card__rotulo">Lotação</p><p class="card__valor" style="font-size:1rem;line-height:1.35">${esc(plan.time.crowding.split(':')[0])}</p><p class="card__detalhe">${esc(plan.time.bookingLead.split('. ')[0])}</p></div>
    </div>

    <div class="abas" role="tablist" aria-label="Seções do caderno">
      ${ABAS.map(([k, r]) => `<button type="button" class="aba" role="tab" id="aba-${k}" aria-controls="painel-${k}" aria-selected="${k === aba}" tabindex="${k === aba ? 0 : -1}">${r}${k === 'checklist' ? ` · <span id="pct-aba">${pct()}%</span>` : ''}</button>`).join('')}
    </div>
    ${ABAS.map(([k]) => `<section class="painel" role="tabpanel" id="painel-${k}" aria-labelledby="aba-${k}" tabindex="0" ${k === aba ? '' : 'hidden'}></section>`).join('')}
  </div>`;

  const $ = (s) => el.querySelector(s);

  // ---- painéis ----
  function pOpcoes() {
    const o = plan.options[sel];
    $('#painel-opcoes').innerHTML = `
      <div class="opcoes" role="group" aria-label="Escolha uma das três opções">
        ${plan.options.map((op, i) => `<button type="button" class="card opcao" data-op="${i}" aria-pressed="${i === sel}">
          <span class="selo ${i === 0 ? 'selo--ok' : i === 1 ? 'selo--info' : ''}">${esc(op.tag)}</span>
          <h3 style="margin-top:var(--sp-3)">${esc(op.name)}</h3>
          <p class="card__valor num">${faixa(op.estimatedMin, op.estimatedMax)}</p>
          <p class="muted" style="font-size:var(--fs-sm)">${esc(op.summary)}</p>
          ${op.highlights.length ? `<ul class="lista-marcada lista-limpa" style="font-size:var(--fs-sm)">${op.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
          <p class="faint" style="margin-top:var(--sp-3)">${esc(op.fit)}</p>
        </button>`).join('')}
      </div>
      <h2 style="margin-top:var(--sp-6)">Dia a dia · ${esc(o.tag)}</h2>
      <ol class="dias">${o.days.map((d) => `<li class="card card--tight dia-item"><span class="dia-item__n" aria-hidden="true">${String(d.day).padStart(2, '0')}</span><div><h3 style="font-size:1rem;margin:0 0 6px"><span class="sr-only">Dia ${d.day}: </span>${esc(d.title)}</h3><ul>${d.activities.map((a) => `<li>${esc(a)}</li>`).join('')}</ul><p class="dia-item__noite">Pernoite · ${esc(d.overnight)}</p></div></li>`).join('')}</ol>
      ${plan.warnings.length ? `<div class="card" style="margin-top:var(--sp-5);border-color:rgba(242,196,107,.35)"><h3>Atenção</h3><ul class="lista-marcada lista-limpa">${plan.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
      ${plan.localTips.length ? `<div class="card" style="margin-top:var(--sp-4)"><h3>Dicas de especialista</h3><ul class="lista-marcada lista-limpa">${plan.localTips.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
      <p class="faint" style="margin-top:var(--sp-4)">Roteiro montado por regras a partir dos seus interesses, do meio de transporte e do clima registrado. Tipos de lugar são sugestões, não reservas.</p>`;
    $('#painel-opcoes').querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => {
      sel = Number(b.dataset.op); pOpcoes(); pDinheiro();
      $(`#painel-opcoes [data-op="${sel}"]`).focus();
    }));
  }

  function pClima() {
    const temMeses = c.meses && c.meses.some((m) => m.ok);
    const okM = temMeses ? c.meses.filter((m) => m.ok) : [];
    const maxT = temMeses ? Math.max(...okM.map((m) => m.max)) : 1;
    const minB = temMeses ? Math.min(0, ...okM.map((m) => m.min)) : 0;
    $('#painel-clima').innerHTML = `
      <div class="grid grid--2">
        <div class="card">
          <p class="card__rotulo">${esc(c.season)} · ${esc(MESES[c.mesRef] || '')}</p>
          <p class="card__valor num" style="font-size:2.4rem">${c.tempMinC != null ? `${c.tempMinC}° a ${c.tempMaxC}°C` : 'Sem dados'}</p>
          <p class="card__detalhe">${esc(c.rain)}</p>
          <p style="margin-top:var(--sp-4)">${esc(c.notes)}</p>
          <h3 style="margin-top:var(--sp-4)">Melhor janela</h3><p class="muted">${esc(c.bestWindow)}</p>
        </div>
        <div class="card">
          <h3>Mala para o clima</h3>
          <ul class="lista-marcada lista-limpa">${c.packing.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
          ${temMeses ? `<div class="meses" role="img" aria-label="Máxima média por mês: ${esc(okM.map((m) => `${MESES[m.mes]} ${m.max} graus`).join(', '))}">${c.meses.map((m) => `<div class="mes ${c.melhores.includes(m.mes) ? 'is-melhor' : ''}"><span class="faint num" style="font-size:.66rem">${m.ok ? m.max + '°' : ''}</span><div class="mes__barra" style="height:${m.ok ? Math.max(6, Math.round(((m.max - minB) / ((maxT - minB) || 1)) * 100)) : 4}%;${m.mes === c.mesRef ? 'outline:2px solid var(--text);outline-offset:1px' : ''}"></div><span class="mes__rot">${MESES_CURTOS[m.mes]}</span></div>`).join('')}</div>
          <div class="legenda"><span><i style="background:var(--accent)"></i>Máxima média</span><span><i style="background:var(--ok)"></i>Melhores meses</span><span><i style="background:transparent;outline:2px solid var(--text)"></i>Mês da viagem</span></div>` : ''}
          ${c.fonte ? `<p class="faint" style="margin-top:var(--sp-3)">Fonte: ${esc(c.fonte)}.</p>` : ''}
        </div>
      </div>`;
  }

  function pDinheiro() {
    const o = plan.options[sel];
    $('#painel-dinheiro').innerHTML = `
      <div class="aviso-estimativa" role="note"><strong>Estimativa.</strong> Faixas calculadas com custos médios da região “${esc(plan.regiaoCusto)}” (dados.json). Não é cotação — confira os preços reais antes de reservar.</div>
      <div class="chips" role="group" aria-label="Ver estimativa da opção" style="margin-top:var(--sp-4)">${plan.options.map((op, i) => `<button type="button" class="chip" data-dop="${i}" aria-pressed="${i === sel}">${esc(op.tag)}</button>`).join('')}</div>
      <div class="tabela-wrap" style="margin-top:var(--sp-4)"><table>
        <caption>Estimativa para o grupo · opção ${esc(o.tag)} · em reais</caption>
        <thead><tr><th scope="col">Item</th><th scope="col" class="num">Faixa</th><th scope="col">Observação</th></tr></thead>
        <tbody>${o.breakdown.map((l) => `<tr><th scope="row" style="font-weight:600">${esc(l.item)}</th><td class="num">${faixa(l.amountMin, l.amountMax)}</td><td class="muted">${esc(l.note)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total estimado</td><td class="num">${faixa(o.estimatedMin, o.estimatedMax)}</td><td class="muted">${reais(o.estimatedMin / brief.travelers)} – ${reais(o.estimatedMax / brief.travelers)} por pessoa</td></tr></tfoot>
      </table></div>
      <p class="muted" style="margin-top:var(--sp-3)">${esc(o.fit)}</p>
      <div class="card" style="margin-top:var(--sp-4)"><h3>Como gastar menos</h3><ul class="lista-marcada lista-limpa">${plan.money.savingTips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
    $('#painel-dinheiro').querySelectorAll('[data-dop]').forEach((b) => b.addEventListener('click', () => {
      sel = Number(b.dataset.dop); pDinheiro(); pOpcoes();
      $(`#painel-dinheiro [data-dop="${sel}"]`).focus();
    }));
  }

  function pTempo() {
    const blocos = [['Ida', plan.time.outbound], ['Volta', plan.time.inbound], ['Ritmo dos dias', plan.time.dailyPace], ['Disponibilidade', plan.time.availability], ['Antecedência', plan.time.bookingLead], ['Lotação', plan.time.crowding]];
    $('#painel-tempo').innerHTML = `<div class="grid grid--3">${blocos.map(([t, v]) => `<div class="card"><p class="card__rotulo">${t}</p><p style="margin:0">${esc(v)}</p></div>`).join('')}</div>
      <p class="faint" style="margin-top:var(--sp-3)">Distâncias estimadas por linha reta (× 1,25 para estrada). Feriados: Nager.Date. Temporada: tendência geral, não medição.</p>`;
  }

  function pChecklist() {
    $('#painel-checklist').innerHTML = `
      <h2>Antes de partir</h2>
      <p class="muted num" id="contagem" aria-live="polite">${checks.size} de ${totalItens} itens · ${pct()}%</p>
      <div class="progresso" role="progressbar" aria-label="Progresso do checklist" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct()}"><span style="width:${pct()}%"></span></div>
      ${plan.checklist.map((g) => `<div class="check-grupo card"><h3>${esc(g.category)}</h3>${g.items.map((i) => `
        <div class="check-item"><input type="checkbox" id="ck-${esc(i.id)}" data-ck="${esc(i.id)}" ${checks.has(i.id) ? 'checked' : ''}><label for="ck-${esc(i.id)}"><span>${esc(i.label)}</span><small>${esc(i.why)} · ${esc(i.timing)}</small></label></div>`).join('')}</div>`).join('')}
      <p class="faint" style="margin-top:var(--sp-4)">Regras de visto e entrada mudam: consulte sempre as fontes oficiais listadas em <a href="#/precos">Preços e condições</a>.</p>`;
    $('#painel-checklist').querySelectorAll('[data-ck]').forEach((cb) => cb.addEventListener('change', () => {
      if (cb.checked) checks.add(cb.dataset.ck); else checks.delete(cb.dataset.ck);
      gravarChecks(plan.id, checks);
      const p = pct();
      $('#contagem').textContent = `${checks.size} de ${totalItens} itens · ${p}%`;
      const bar = $('#painel-checklist .progresso');
      bar.setAttribute('aria-valuenow', p); bar.firstElementChild.style.width = p + '%';
      $('#pct-aba').textContent = p + '%';
    }));
  }

  pOpcoes(); pClima(); pDinheiro(); pTempo(); pChecklist();

  // ---- abas acessíveis (setas, Home, End) ----
  const abas = [...el.querySelectorAll('[role="tab"]')];
  const ativar = (btn, focar = true) => {
    abas.forEach((b) => { const on = b === btn; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; el.querySelector('#' + b.getAttribute('aria-controls')).hidden = !on; });
    if (focar) btn.focus();
  };
  abas.forEach((b, i) => {
    b.addEventListener('click', () => ativar(b));
    b.addEventListener('keydown', (ev) => {
      let j = null;
      if (ev.key === 'ArrowRight') j = (i + 1) % abas.length;
      if (ev.key === 'ArrowLeft') j = (i - 1 + abas.length) % abas.length;
      if (ev.key === 'Home') j = 0;
      if (ev.key === 'End') j = abas.length - 1;
      if (j !== null) { ev.preventDefault(); ativar(abas[j]); }
    });
  });

  // ---- ações ----
  $('#btn-salvar').addEventListener('click', () => {
    const { ok, removido } = salvarCaderno(brief, plan);
    if (!ok) { toast('Não foi possível salvar: o armazenamento do navegador está cheio ou bloqueado.', 'erro'); return; }
    $('#btn-salvar').textContent = 'Salvo neste aparelho';
    toast(removido ? `Caderno salvo. O limite é ${MAX_CADERNOS}; o mais antigo (“${removido}”) saiu da lista.` : 'Caderno salvo neste aparelho.', 'ok');
  });
  $('#btn-nova')?.addEventListener('click', () => { limparAtual(); location.hash = '#/planejar?novo=1'; });
  $('#btn-apagar')?.addEventListener('click', async () => {
    const ok = await confirmar({ titulo: 'Apagar caderno?', texto: `“${plan.title}” e o progresso do checklist serão removidos deste aparelho.`, ok: 'Apagar caderno' });
    if (!ok) return;
    apagarCaderno(plan.id);
    toast('Caderno apagado.', 'ok');
    location.hash = '#/cadernos';
  });
}
