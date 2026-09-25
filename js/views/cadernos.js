// Tela: Cadernos salvos — Farol · byGui
import { esc, icone, faixa, toast, confirmar } from '../ui.js';
import { listarCadernos, apagarCaderno, lerChecks, MAX_CADERNOS, cadernoAtual } from '../store.js';
import { transporteRotulo, mesRotulo } from '../planner.js';

export function render(ctx) {
  const { el } = ctx;
  ctx.titulo('Cadernos salvos');

  const desenhar = () => {
    const lista = listarCadernos();
    const atual = cadernoAtual();
    el.innerHTML = `
    <div class="shell">
      <p class="kicker">Neste aparelho</p>
      <h1 tabindex="-1">Cadernos salvos</h1>
      <p class="lead">Até ${MAX_CADERNOS} cadernos ficam guardados no navegador (localStorage). Nada vai para servidor nenhum.</p>
      ${atual && !lista.some((c) => c.plan.id === atual.plan.id) ? `<div class="card card--tight" style="margin-top:var(--sp-5);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center"><span><strong>Caderno em edição:</strong> ${esc(atual.plan.title)} <span class="faint">(ainda não salvo)</span></span><a class="btn btn--secundario btn--pequeno" href="#/caderno/atual">Abrir</a></div>` : ''}
      <div class="secao" style="margin-top:var(--sp-5)">
        ${lista.length ? `<p class="faint num" style="margin-bottom:var(--sp-3)">${lista.length} de ${MAX_CADERNOS}</p><ul class="lista-limpa" style="display:grid;gap:var(--sp-3)">
          ${lista.map((c) => {
            const total = c.plan.checklist.reduce((s, g) => s + g.items.length, 0);
            const feitos = lerChecks(c.plan.id).size;
            const pct = total ? Math.round((feitos / total) * 100) : 0;
            return `<li class="card caderno-item">
              <div style="min-width:0">
                <h2 style="font-size:1.15rem;margin:0 0 6px"><a href="#/caderno/${esc(c.plan.id)}">${esc(c.plan.title)}</a></h2>
                <p class="faint" style="margin:0">${esc(transporteRotulo(c.brief.transport))} · ${c.brief.days} dias · ${c.brief.travelers} ${c.brief.travelers > 1 ? 'viajantes' : 'viajante'} · ${esc(mesRotulo(c.brief.month))} · salvo em ${new Date(c.salvoEm).toLocaleDateString('pt-BR')}</p>
                <p class="muted num" style="margin:6px 0 0;font-size:var(--fs-sm)">Estimativa (Equilibrado): ${faixa(c.plan.money.totalMin, c.plan.money.totalMax)} · checklist ${pct}%</p>
              </div>
              <div class="caderno-item__acoes">
                <a class="btn btn--secundario btn--pequeno" href="#/caderno/${esc(c.plan.id)}">Abrir</a>
                <button type="button" class="btn btn--fantasma btn--icone" data-apagar="${esc(c.plan.id)}" aria-label="Apagar o caderno ${esc(c.plan.title)}" title="Apagar">${icone('i-lixo')}</button>
              </div>
            </li>`;
          }).join('')}
        </ul>` : `<div class="vazio"><p>Nenhum caderno salvo ainda.</p><a class="btn btn--primario" href="#/planejar">Montar o primeiro caderno</a></div>`}
      </div>
    </div>`;

    el.querySelectorAll('[data-apagar]').forEach((b) => b.addEventListener('click', async () => {
      const c = listarCadernos().find((x) => x.plan.id === b.dataset.apagar);
      if (!c) return;
      const ok = await confirmar({ titulo: 'Apagar caderno?', texto: `“${c.plan.title}” e o progresso do checklist serão removidos deste aparelho. Não dá para desfazer.`, ok: 'Apagar caderno' });
      if (!ok) return;
      apagarCaderno(c.plan.id);
      toast(`“${c.plan.title}” foi apagado.`, 'ok');
      desenhar();
      (el.querySelector('[data-apagar]') || el.querySelector('h1')).focus();
    }));
  };
  desenhar();
}
