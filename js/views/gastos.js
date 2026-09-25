// Tela: Minhas viagens e controle de gastos (tudo no localStorage). Farol · byGui
import { esc, icone, reais, reaisCentavos, numero, toast, confirmar, uid, dataBR, hojeISO, vazioHTML } from '../ui.js';
import {
  CATEGORIAS, categoriaRotulo, listarViagens, obterViagem, salvarViagem, apagarViagem, novaViagem, totaisViagem, diasRestantes, diasAte,
  montarBackup, validarBackup, aplicarBackup, gastosCSV, baixarArquivo, MAX_VIAGENS,
} from '../store.js';
import { moedasSuportadas, cotacaoBRL, msgErro } from '../api.js';
import { htmlCompartilhar, ligarCompartilhar, urlCompleta } from '../share.js';

const moedaNome = (c) => { try { return new Intl.DisplayNames(['pt-BR'], { type: 'currency' }).of(c); } catch { return c; } };
const nomeArquivo = (s) => String(s || 'viagem').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'viagem';
const numeroCampo = (v) => { const n = Number(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : NaN; };
const valorInput = (n) => (n ? String(Math.round(n * 100) / 100).replace('.', ',') : '');

function barrasHTML(t) {
  return `<div class="barras">${CATEGORIAS.map((c) => {
    const x = t.porCat[c.id];
    if (!x.planejado && !x.pago && !x.pendente) return '';
    const base = Math.max(x.planejado, x.pago + x.pendente) || 1;
    const wPago = (x.pago / base) * 100, wPend = (x.pendente / base) * 100;
    const estouro = x.planejado > 0 && x.pago + x.pendente > x.planejado;
    return `<div class="barra ${estouro ? 'is-estouro' : ''}">
      <div class="barra__topo"><strong>${esc(c.rotulo)}</strong><span class="num muted">${reais(x.pago + x.pendente)} de ${reais(x.planejado)}${estouro ? ` · <span style="color:var(--danger);font-weight:700">passou ${reais(x.pago + x.pendente - x.planejado)}</span>` : ''}</span></div>
      <div class="barra__trilho" role="img" aria-label="${esc(c.rotulo)}: gasto ${reais(x.pago)} pago e ${reais(x.pendente)} pendente, de ${reais(x.planejado)} planejado"><span class="barra__gasto" style="width:${Math.min(100, wPago)}%"></span><span class="barra__pend" style="left:${Math.min(100, wPago)}%;width:${Math.min(100 - Math.min(100, wPago), wPend)}%"></span></div>
    </div>`;
  }).join('') || vazioHTML('Defina o orçamento por categoria ou registre um gasto para ver as barras.')}</div>
  <div class="legenda"><span><i style="background:var(--accent)"></i>Pago</span><span><i style="background:var(--secondary)"></i>Pendente</span><span><i style="background:var(--surface-3)"></i>Saldo planejado</span><span><i style="background:var(--danger)"></i>Acima do planejado</span></div>`;
}

export function resumoTexto(v) {
  const t = totaisViagem(v);
  const dr = diasRestantes(v);
  return [
    `💰 Gastos da viagem: ${v.nome}`,
    v.inicio ? `Datas: ${dataBR(v.inicio)}${v.fim ? ' a ' + dataBR(v.fim) : ''}` : '',
    `Planejado: ${reais(t.planejado)}`,
    `Gasto: ${reais(t.gasto)} (${reais(t.pago)} pago, ${reais(t.pendente)} pendente)`,
    `Saldo: ${reais(t.restante)}${dr && t.restante > 0 ? ` · ${reais(t.restante / dr)} por dia (${dr} dia${dr > 1 ? 's' : ''})` : ''}`,
    'Resumo feito no Farol (os dados ficam só no meu aparelho):',
  ].filter(Boolean).join('\n');
}

/** Painel completo de uma viagem. Usado em #/gastos/:id e na aba Gastos do caderno. */
export function painelViagem(box, id, { embed = false, signal, aoApagar } = {}) {
  let moedas = null;
  const desenhar = (focoSel) => {
    const v = obterViagem(id);
    if (!v) { box.innerHTML = vazioHTML('Esta viagem não existe mais neste aparelho.'); return; }
    const t = totaisViagem(v);
    const dr = diasRestantes(v);
    const porDia = dr ? t.restante / dr : null;
    const gastos = v.gastos.slice().sort((a, b) => (b.data || '').localeCompare(a.data || '') || b.criadoEm?.localeCompare?.(a.criadoEm || '') || 0);
    const hid = 'v' + id.slice(0, 6);
    box.innerHTML = `
      <div class="kpis">
        <div class="card card--tight"><p class="card__rotulo">Planejado</p><p class="card__valor num">${reais(t.planejado)}</p><p class="card__detalhe">${v.pessoas > 1 ? `${reais(t.planejado / v.pessoas)} por pessoa` : 'Soma das categorias'}</p></div>
        <div class="card card--tight"><p class="card__rotulo">Gasto</p><p class="card__valor num">${reais(t.gasto)}</p><p class="card__detalhe num">${reais(t.pago)} pago · ${reais(t.pendente)} pendente</p></div>
        <div class="card card--tight"><p class="card__rotulo">Saldo</p><p class="card__valor num" style="${t.restante < 0 ? 'color:var(--danger)' : ''}">${reais(t.restante)}</p><p class="card__detalhe">${t.planejado ? `${numero(Math.min(999, (t.gasto / t.planejado) * 100))}% do planejado usado` : 'Sem orçamento definido'}</p></div>
        <div class="card card--tight"><p class="card__rotulo">Por dia</p><p class="card__valor num">${porDia != null ? reais(Math.max(0, porDia)) : '—'}</p><p class="card__detalhe">${dr ? `Para ${dr} dia${dr > 1 ? 's' : ''} ${v.inicio && diasAte(v.inicio) <= 0 ? 'restantes' : 'de viagem'}` : dr === 0 ? 'Viagem encerrada' : 'Informe as datas'}</p></div>
      </div>
      <div class="linha-acoes" style="margin-top:var(--sp-4)"><span class="faint">Compartilhar resumo:</span>${htmlCompartilhar()}</div>

      <section class="secao" style="margin-top:var(--sp-6)" aria-labelledby="${hid}-t-barras">
        <h2 id="${hid}-t-barras" style="font-size:1.2rem">Planejado × gasto por categoria</h2>
        <div class="card">${barrasHTML(t)}</div>
      </section>

      <section class="secao" style="margin-top:var(--sp-6)" aria-labelledby="${hid}-t-novo">
        <h2 id="${hid}-t-novo" style="font-size:1.2rem">Registrar gasto</h2>
        <form class="bloco" data-form="gasto" novalidate>
          <div class="form-gasto">
            <div class="campo"><label for="${hid}-g-data">Data</label><input class="input" type="date" id="${hid}-g-data" name="data" value="${hojeISO()}" required></div>
            <div class="campo"><label for="${hid}-g-cat">Categoria</label><select class="select" id="${hid}-g-cat" name="categoria">${CATEGORIAS.map((c) => `<option value="${c.id}">${esc(c.rotulo)}</option>`).join('')}</select></div>
            <div class="campo"><label for="${hid}-g-status">Situação</label><select class="select" id="${hid}-g-status" name="status"><option value="pago">Pago</option><option value="pendente">Pendente (a pagar)</option></select></div>
            <div class="campo campo--largo"><label for="${hid}-g-desc">Descrição</label><input class="input" id="${hid}-g-desc" name="descricao" maxlength="120" placeholder="Ex.: jantar no centro, ingresso do museu" autocomplete="off"></div>
            <div class="campo"><label for="${hid}-g-valor">Valor</label><input class="input" id="${hid}-g-valor" name="valor" inputmode="decimal" placeholder="0,00" required aria-describedby="${hid}-g-erro"></div>
            <div class="campo"><label for="${hid}-g-moeda">Moeda</label><select class="select" id="${hid}-g-moeda" name="moeda"><option value="BRL">Real (BRL)</option>${moedas ? Object.keys(moedas).filter((c) => c !== 'BRL').map((c) => `<option value="${c}">${esc(moedaNome(c))} (${c})</option>`).join('') : ''}</select></div>
            <div class="campo" data-taxa hidden><label for="${hid}-g-taxa">Cotação (R$ por 1 unidade)</label><input class="input" id="${hid}-g-taxa" name="taxa" inputmode="decimal" aria-describedby="${hid}-g-taxa-info"><small id="${hid}-g-taxa-info"></small></div>
          </div>
          <p class="erro-campo" id="${hid}-g-erro" aria-live="polite"></p>
          <div class="acoes" style="margin-top:var(--sp-3)"><button class="btn btn--primario" type="submit">Adicionar gasto</button></div>
        </form>
      </section>

      <section class="secao" style="margin-top:var(--sp-6)" aria-labelledby="${hid}-t-lista">
        <div class="secao__cab"><h2 id="${hid}-t-lista" style="font-size:1.2rem">Gastos registrados</h2><button type="button" class="btn btn--fantasma btn--pequeno" data-acao="csv">${icone('i-baixar')} Exportar gastos (CSV)</button></div>
        ${gastos.length ? `<div class="tabela-wrap"><table>
          <caption>${gastos.length} gasto(s) · valores em reais</caption>
          <thead><tr><th scope="col">Data</th><th scope="col">Categoria</th><th scope="col">Descrição</th><th scope="col" class="num">Valor</th><th scope="col">Situação</th><th scope="col"><span class="sr-only">Apagar</span></th></tr></thead>
          <tbody>${gastos.map((g) => `<tr>
            <td class="num">${esc(dataBR(g.data))}</td><td>${esc(categoriaRotulo(g.categoria))}</td><td>${esc(g.descricao || '—')}</td>
            <td class="num">${reaisCentavos(g.valor)}${g.moeda && g.moeda !== 'BRL' ? `<br><span class="faint">${esc(numero(g.valorOriginal, 2))} ${esc(g.moeda)}</span>` : ''}</td>
            <td><button type="button" class="chip status-toggle" data-status="${esc(g.id)}" aria-label="Situação de ${esc(g.descricao || categoriaRotulo(g.categoria))}: ${g.status === 'pendente' ? 'pendente. Marcar como pago' : 'pago. Marcar como pendente'}">${g.status === 'pendente' ? '<span class="selo selo--aviso">Pendente</span>' : '<span class="selo selo--ok">Pago</span>'}</button></td>
            <td><button type="button" class="btn btn--fantasma btn--icone" data-apagar-gasto="${esc(g.id)}" aria-label="Apagar gasto ${esc(g.descricao || categoriaRotulo(g.categoria))} de ${reaisCentavos(g.valor)}">${icone('i-lixo')}</button></td>
          </tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="3">Total</td><td class="num">${reaisCentavos(t.gasto)}</td><td colspan="2"></td></tr></tfoot>
        </table></div>` : vazioHTML('Nenhum gasto registrado ainda. Use o formulário acima: cada gasto entra nas barras e no saldo por dia.')}
      </section>

      <section class="secao" style="margin-top:var(--sp-6)" aria-labelledby="${hid}-t-orc">
        <h2 id="${hid}-t-orc" style="font-size:1.2rem">Orçamento por categoria</h2>
        <form class="bloco" data-form="orcamento" novalidate>
          <div class="orcamento-grid">${CATEGORIAS.map((c) => `<div class="campo"><label for="${hid}-o-${c.id}">${esc(c.rotulo)} (R$)</label><input class="input num" id="${hid}-o-${c.id}" name="${c.id}" inputmode="decimal" value="${valorInput(v.orcamento[c.id])}" placeholder="0"></div>`).join('')}</div>
          ${embed ? '' : `<div class="linha-form linha-form--3" style="margin-top:var(--sp-4)">
            <div class="campo"><label for="${hid}-o-ini">Início da viagem</label><input class="input" type="date" id="${hid}-o-ini" name="inicio" value="${esc(v.inicio || '')}"></div>
            <div class="campo"><label for="${hid}-o-fim">Fim da viagem</label><input class="input" type="date" id="${hid}-o-fim" name="fim" value="${esc(v.fim || '')}"></div>
            <div class="campo"><label for="${hid}-o-pes">Pessoas</label><input class="input" type="number" min="1" max="20" id="${hid}-o-pes" name="pessoas" value="${v.pessoas || 1}"></div>
          </div>`}
          <p class="erro-campo" data-erro-orc aria-live="polite"></p>
          <div class="acoes" style="margin-top:var(--sp-3)"><button class="btn btn--secundario" type="submit">Salvar orçamento</button>${embed ? '' : `<button type="button" class="btn btn--fantasma" data-acao="apagar-viagem">${icone('i-lixo')} Apagar viagem</button>`}</div>
        </form>
      </section>`;

    ligarCompartilhar(box, () => ({ titulo: `Gastos · ${v.nome}`, texto: resumoTexto(obterViagem(id) || v), url: urlCompleta('#/') }));
    const $ = (s) => box.querySelector(s);

    // moeda estrangeira → cotação do BCE (Frankfurter), editável
    const selMoeda = $(`#${hid}-g-moeda`), campoTaxa = box.querySelector('[data-taxa]'), inTaxa = $(`#${hid}-g-taxa`), infoTaxa = $(`#${hid}-g-taxa-info`);
    const carregarMoedas = () => {
      if (moedas) return;
      moedasSuportadas({ signal }).then((m) => { moedas = m; const atual = selMoeda.value; selMoeda.innerHTML = `<option value="BRL">Real (BRL)</option>${Object.keys(m).filter((c) => c !== 'BRL').map((c) => `<option value="${c}">${esc(moedaNome(c))} (${c})</option>`).join('')}`; selMoeda.value = atual; })
        .catch(() => { infoTaxa.textContent = 'Lista de moedas indisponível agora; registre em reais.'; });
    };
    selMoeda.addEventListener('focus', carregarMoedas, { once: true });
    selMoeda.addEventListener('pointerdown', carregarMoedas, { once: true });
    selMoeda.addEventListener('change', async () => {
      const m = selMoeda.value;
      campoTaxa.hidden = m === 'BRL';
      if (m === 'BRL') return;
      inTaxa.value = ''; infoTaxa.textContent = 'Buscando cotação…';
      try {
        const { taxa, data } = await cotacaoBRL(m, { signal });
        inTaxa.value = String(Math.round(taxa * 10000) / 10000).replace('.', ',');
        infoTaxa.textContent = `Cotação de referência do BCE em ${dataBR(data)} (Frankfurter). Ajuste para a taxa real do seu cartão ou casa de câmbio.`;
      } catch (e) { infoTaxa.textContent = e.mensagem === 'sem-suporte' ? 'Sem cotação automática para esta moeda: informe a taxa.' : `${msgErro(e)} Informe a taxa manualmente.`; }
    });

    $('[data-form="gasto"]').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const erro = $(`#${hid}-g-erro`);
      const bruto = numeroCampo(fd.get('valor'));
      const moeda = String(fd.get('moeda') || 'BRL');
      const taxa = moeda === 'BRL' ? 1 : numeroCampo(fd.get('taxa'));
      const data = String(fd.get('data') || '');
      erro.textContent = '';
      if (!(bruto > 0)) { erro.textContent = 'Informe um valor maior que zero (use vírgula para centavos).'; $(`#${hid}-g-valor`).setAttribute('aria-invalid', 'true'); $(`#${hid}-g-valor`).focus(); return; }
      if (!(taxa > 0)) { erro.textContent = 'Informe a cotação da moeda em reais.'; inTaxa.focus(); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) { erro.textContent = 'Informe a data do gasto.'; return; }
      const vv = obterViagem(id);
      vv.gastos.push({ id: uid(), data, categoria: String(fd.get('categoria')), descricao: String(fd.get('descricao') || '').trim().slice(0, 120), valor: Math.round(bruto * taxa * 100) / 100, moeda, valorOriginal: bruto, status: fd.get('status') === 'pendente' ? 'pendente' : 'pago', criadoEm: new Date().toISOString() });
      if (!salvarViagem(vv)) { toast('Não foi possível salvar: armazenamento cheio ou bloqueado.', 'erro'); return; }
      toast(`Gasto de ${reaisCentavos(bruto * taxa)} registrado.`, 'ok');
      desenhar(`#${hid}-g-valor`);
    });

    box.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
      const vv = obterViagem(id); const g = vv.gastos.find((x) => x.id === b.dataset.status); if (!g) return;
      g.status = g.status === 'pendente' ? 'pago' : 'pendente'; salvarViagem(vv);
      toast(g.status === 'pago' ? 'Marcado como pago.' : 'Marcado como pendente.', 'ok');
      desenhar(`[data-status="${g.id}"]`);
    }));
    box.querySelectorAll('[data-apagar-gasto]').forEach((b) => b.addEventListener('click', async () => {
      const vv = obterViagem(id); const g = vv.gastos.find((x) => x.id === b.dataset.apagarGasto); if (!g) return;
      const ok = await confirmar({ titulo: 'Apagar gasto?', texto: `${g.descricao || categoriaRotulo(g.categoria)} · ${reaisCentavos(g.valor)} em ${dataBR(g.data)}.`, ok: 'Apagar gasto' });
      if (!ok) return;
      vv.gastos = vv.gastos.filter((x) => x.id !== g.id); salvarViagem(vv);
      toast('Gasto apagado.', 'ok');
      desenhar(`#${hid}-t-lista`);
    }));

    $('[data-form="orcamento"]').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const vv = obterViagem(id);
      const erro = box.querySelector('[data-erro-orc]');
      erro.textContent = '';
      for (const c of CATEGORIAS) {
        const raw = String(fd.get(c.id) || '').trim();
        const n = raw ? numeroCampo(raw) : 0;
        if (!(n >= 0)) { erro.textContent = `Valor inválido em ${c.rotulo}.`; $(`#${hid}-o-${c.id}`).focus(); return; }
        vv.orcamento[c.id] = Math.round(n * 100) / 100;
      }
      if (!embed) {
        const ini = String(fd.get('inicio') || ''), fim = String(fd.get('fim') || '');
        if (ini && fim && fim < ini) { erro.textContent = 'O fim da viagem precisa ser depois do início.'; return; }
        vv.inicio = ini; vv.fim = fim; vv.pessoas = Math.min(20, Math.max(1, Number(fd.get('pessoas')) || 1));
      }
      salvarViagem(vv);
      toast('Orçamento salvo.', 'ok');
      desenhar(`#${hid}-t-orc`);
    });

    $('[data-acao="csv"]').addEventListener('click', () => {
      const vv = obterViagem(id);
      if (!vv.gastos.length) { toast('Ainda não há gastos para exportar.', 'info'); return; }
      baixarArquivo(`farol-gastos-${nomeArquivo(vv.nome)}.csv`, gastosCSV([vv]), 'text/csv;charset=utf-8');
      toast('CSV exportado (separador ponto e vírgula).', 'ok');
    });
    box.querySelector('[data-acao="apagar-viagem"]')?.addEventListener('click', async () => {
      const vv = obterViagem(id);
      const ok = await confirmar({ titulo: 'Apagar viagem?', texto: `“${vv.nome}”, o orçamento e ${vv.gastos.length} gasto(s) serão removidos deste aparelho. Não dá para desfazer (a não ser que você tenha um backup).`, ok: 'Apagar viagem' });
      if (!ok) return;
      apagarViagem(id);
      toast('Viagem apagada.', 'ok');
      if (aoApagar) aoApagar();
    });

    if (focoSel) { const f = box.querySelector(focoSel); if (f) { if (!f.matches('input,button,select,textarea,a')) f.setAttribute('tabindex', '-1'); f.focus(); } }
  };
  desenhar();
}

/* ---------------------------------------------------------------- telas */
export function render(ctx) {
  const { el, params, signal } = ctx;
  if (params[0]) return detalhe(ctx, params[0]);
  ctx.titulo('Minhas viagens e gastos');

  const desenhar = () => {
    const viagens = listarViagens();
    const tot = viagens.reduce((s, v) => { const t = totaisViagem(v); return { planejado: s.planejado + t.planejado, gasto: s.gasto + t.gasto }; }, { planejado: 0, gasto: 0 });
    const proximas = viagens.filter((v) => v.inicio && diasAte(v.fim || v.inicio) >= 0).sort((a, b) => a.inicio.localeCompare(b.inicio));
    el.innerHTML = `
    <div class="shell">
      <p class="kicker">Controle de gastos</p>
      <h1>Minhas viagens</h1>
      <p class="lead">Orçamento por categoria, gastos reais, saldo por dia e backup. Tudo fica salvo só neste aparelho (localStorage) — nada vai para servidor.</p>

      <div class="kpis" style="margin-top:var(--sp-5)">
        <div class="card card--tight"><p class="card__rotulo">Viagens</p><p class="card__valor num">${viagens.length}</p><p class="card__detalhe">Limite de ${MAX_VIAGENS}</p></div>
        <div class="card card--tight"><p class="card__rotulo">Próximas</p><p class="card__valor num">${proximas.length}</p><p class="card__detalhe">${proximas[0] ? `${esc(proximas[0].nome)} · ${diasAte(proximas[0].inicio) > 0 ? `em ${diasAte(proximas[0].inicio)} dia(s)` : 'em andamento'}` : 'Informe datas nas viagens'}</p></div>
        <div class="card card--tight"><p class="card__rotulo">Total planejado</p><p class="card__valor num">${reais(tot.planejado)}</p><p class="card__detalhe">Soma de todas as viagens</p></div>
        <div class="card card--tight"><p class="card__rotulo">Total gasto</p><p class="card__valor num">${reais(tot.gasto)}</p><p class="card__detalhe">Pago + pendente</p></div>
      </div>

      <section class="secao" aria-labelledby="t-lista-v" style="margin-top:var(--sp-6)">
        <h2 id="t-lista-v">Viagens</h2>
        ${viagens.length ? `<ul class="lista-limpa" style="display:grid;gap:var(--sp-3)">${viagens.map((v) => {
          const t = totaisViagem(v); const pct = t.planejado ? Math.min(100, Math.round((t.gasto / t.planejado) * 100)) : 0; const f = v.inicio ? diasAte(v.inicio) : null;
          return `<li class="card viagem-item">
            <div class="linha-acoes" style="justify-content:space-between"><h3><a href="#/gastos/${esc(v.id)}">${esc(v.nome)}</a></h3>${f != null ? `<span class="selo ${f > 0 ? 'selo--info' : diasAte(v.fim || v.inicio) >= 0 ? 'selo--ok' : ''}">${f > 0 ? `Faltam ${f} dia(s)` : diasAte(v.fim || v.inicio) >= 0 ? 'Em viagem' : 'Concluída'}</span>` : ''}</div>
            <p class="faint" style="margin:0">${v.inicio ? `${esc(dataBR(v.inicio))}${v.fim ? ' a ' + esc(dataBR(v.fim)) : ''} · ` : ''}${v.pessoas} pessoa(s) · ${v.gastos.length} gasto(s)${v.cadernoId ? ' · ligada a um caderno' : ''}</p>
            <div class="barra"><div class="barra__topo"><span class="num">${reais(t.gasto)} de ${reais(t.planejado)}</span><span class="num muted">${t.planejado ? pct + '%' : 'sem orçamento'}</span></div><div class="barra__trilho" role="img" aria-label="${pct}% do orçamento usado"><span class="barra__gasto" style="width:${pct}%${t.gasto > t.planejado && t.planejado ? ';background:var(--danger)' : ''}"></span></div></div>
            <div><a class="btn btn--secundario btn--pequeno" href="#/gastos/${esc(v.id)}">Abrir controle</a></div>
          </li>`;
        }).join('')}</ul>` : `<div class="vazio"><p>Nenhuma viagem ainda.</p><p class="faint">Crie abaixo ou, num caderno de roteiro, use a aba <strong>Gastos</strong> para começar com o orçamento estimado.</p></div>`}
      </section>

      <section class="secao" aria-labelledby="t-nova">
        <h2 id="t-nova">Nova viagem</h2>
        <form class="bloco" id="form-nova" novalidate>
          <div class="linha-form">
            <div class="campo"><label for="n-nome">Nome da viagem <span aria-hidden="true" style="color:var(--danger)">*</span></label><input class="input" id="n-nome" name="nome" maxlength="60" required placeholder="Ex.: Lisboa com a família" aria-describedby="n-erro"></div>
            <div class="campo"><label for="n-pes">Pessoas</label><input class="input" type="number" min="1" max="20" id="n-pes" name="pessoas" value="2"></div>
          </div>
          <div class="linha-form" style="margin-top:var(--sp-4)">
            <div class="campo"><label for="n-ini">Início (opcional)</label><input class="input" type="date" id="n-ini" name="inicio"></div>
            <div class="campo"><label for="n-fim">Fim (opcional)</label><input class="input" type="date" id="n-fim" name="fim"></div>
          </div>
          <p class="erro-campo" id="n-erro" aria-live="polite"></p>
          <div class="acoes" style="margin-top:var(--sp-3)"><button class="btn btn--primario" type="submit">Criar viagem</button></div>
        </form>
      </section>

      <section class="secao" aria-labelledby="t-conv">
        <h2 id="t-conv">Conversor rápido</h2>
        <form class="bloco" id="form-conv" novalidate>
          <div class="linha-form linha-form--3">
            <div class="campo"><label for="c-valor">Valor</label><input class="input" id="c-valor" inputmode="decimal" value="100"></div>
            <div class="campo"><label for="c-moeda">Moeda</label><select class="select" id="c-moeda"><option value="USD">Dólar americano (USD)</option><option value="EUR">Euro (EUR)</option></select></div>
            <div class="campo"><span class="rotulo">Em reais</span><p class="card__valor num" id="c-saida" aria-live="polite" style="margin:6px 0 0">—</p></div>
          </div>
          <p class="faint" id="c-info" style="margin-top:var(--sp-2)">Cotação comercial de referência do Banco Central Europeu (Frankfurter). Cartões e casas de câmbio cobram spread e IOF.</p>
        </form>
      </section>

      <section class="secao" aria-labelledby="t-backup">
        <h2 id="t-backup">Backup e exportação</h2>
        <p class="muted" style="max-width:70ch">Os dados ficam só neste navegador. Limpar o histórico ou trocar de aparelho apaga tudo — exporte um backup de vez em quando.</p>
        <div class="acoes">
          <button type="button" class="btn btn--secundario" id="btn-backup">${icone('i-baixar')} Exportar backup (JSON)</button>
          <button type="button" class="btn btn--fantasma" id="btn-importar">${icone('i-subir')} Importar backup</button>
          <input type="file" id="in-backup" accept="application/json,.json" hidden>
          <button type="button" class="btn btn--fantasma" id="btn-csv">${icone('i-baixar')} Exportar gastos (CSV)</button>
        </div>
        <p class="faint" style="margin-top:var(--sp-2)">O backup inclui cadernos, checklist, viagens, gastos e tema. O CSV usa ponto e vírgula e abre direto no Excel ou no Planilhas Google.</p>
      </section>
    </div>`;

    const $ = (s) => el.querySelector(s);
    $('#form-nova').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const nome = String(fd.get('nome') || '').trim();
      const ini = String(fd.get('inicio') || ''), fim = String(fd.get('fim') || '');
      const erro = $('#n-erro'); erro.textContent = '';
      if (nome.length < 2) { erro.textContent = 'Dê um nome à viagem (ao menos 2 letras).'; $('#n-nome').setAttribute('aria-invalid', 'true'); $('#n-nome').focus(); return; }
      if (ini && fim && fim < ini) { erro.textContent = 'O fim precisa ser depois do início.'; $('#n-fim').focus(); return; }
      if (listarViagens().length >= MAX_VIAGENS) { erro.textContent = `Limite de ${MAX_VIAGENS} viagens atingido. Apague uma antiga ou exporte um backup.`; return; }
      const v = novaViagem({ id: uid(), nome, inicio: ini, fim, pessoas: Math.min(20, Math.max(1, Number(fd.get('pessoas')) || 1)) });
      if (!salvarViagem(v)) { toast('Não foi possível salvar: armazenamento cheio ou bloqueado.', 'erro'); return; }
      toast('Viagem criada. Defina o orçamento por categoria.', 'ok');
      location.hash = `#/gastos/${v.id}`;
    });

    // conversor
    const conv = async () => {
      const n = numeroCampo($('#c-valor').value); const m = $('#c-moeda').value; const out = $('#c-saida');
      if (!(n >= 0)) { out.textContent = '—'; return; }
      out.textContent = '…';
      try { const { taxa, data } = await cotacaoBRL(m, { signal }); out.textContent = reaisCentavos(n * taxa); $('#c-info').textContent = `1 ${m} = ${reaisCentavos(taxa)} · referência do BCE em ${dataBR(data)} (Frankfurter). Cartões e casas de câmbio cobram spread e IOF.`; }
      catch (e) { if (e.status !== -1) { out.textContent = '—'; $('#c-info').textContent = e.mensagem === 'sem-suporte' ? 'Sem cotação para esta moeda.' : msgErro(e); } }
    };
    moedasSuportadas({ signal }).then((m) => {
      const sel = $('#c-moeda'); if (!sel) return; const atual = sel.value;
      sel.innerHTML = Object.keys(m).filter((c) => c !== 'BRL').map((c) => `<option value="${c}">${esc(moedaNome(c))} (${c})</option>`).join(''); sel.value = atual;
    }).catch(() => {});
    $('#c-valor').addEventListener('input', conv); $('#c-moeda').addEventListener('change', conv);
    $('#form-conv').addEventListener('submit', (ev) => { ev.preventDefault(); conv(); });
    conv();

    // backup
    $('#btn-backup').addEventListener('click', () => {
      const b = montarBackup();
      baixarArquivo(`farol-backup-${hojeISO()}.json`, JSON.stringify(b, null, 2), 'application/json');
      toast(`Backup exportado: ${b.cadernos.length} caderno(s) e ${b.viagens.length} viagem(ns).`, 'ok');
    });
    $('#btn-importar').addEventListener('click', () => $('#in-backup').click());
    $('#in-backup').addEventListener('change', async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) { toast('Arquivo grande demais para um backup do Farol (máx. 5 MB).', 'erro'); return; }
      let b;
      try { b = JSON.parse(await f.text()); } catch { toast('O arquivo não é um JSON válido.', 'erro', 6000); return; }
      const r = validarBackup(b);
      if (!r.ok) { toast(r.erro, 'erro', 7000); return; }
      const atual = montarBackup();
      const ok = await confirmar({ titulo: 'Substituir os dados deste aparelho?', texto: `O backup tem ${r.resumo}. Isso substitui os ${atual.cadernos.length} caderno(s) e ${atual.viagens.length} viagem(ns) atuais. Não dá para desfazer.`, ok: 'Substituir' });
      if (!ok) { toast('Importação cancelada. Nada foi alterado.', 'info'); return; }
      if (!aplicarBackup(b)) { toast('Não foi possível gravar: armazenamento cheio ou bloqueado.', 'erro'); return; }
      toast(`Backup importado: ${r.resumo}.`, 'ok');
      const tema = b.preferencias && b.preferencias.tema;
      if (tema) document.dispatchEvent(new CustomEvent('farol:tema', { detail: tema }));
      desenhar();
    });
    $('#btn-csv').addEventListener('click', () => {
      const vs = listarViagens();
      if (!vs.some((v) => v.gastos.length)) { toast('Ainda não há gastos para exportar.', 'info'); return; }
      baixarArquivo(`farol-gastos-${hojeISO()}.csv`, gastosCSV(vs), 'text/csv;charset=utf-8');
      toast('CSV exportado (separador ponto e vírgula).', 'ok');
    });
  };
  desenhar();
}

function detalhe(ctx, id) {
  const { el, signal } = ctx;
  const v = obterViagem(id);
  if (!v) {
    ctx.titulo('Viagem não encontrada');
    el.innerHTML = `<section class="shell"><a class="voltar" href="#/gastos">${icone('i-voltar')} Minhas viagens</a><h1>Viagem não encontrada</h1><p class="lead">Ela pode ter sido apagada ou foi criada em outro aparelho (os dados ficam só no navegador onde foram salvos).</p><div class="acoes"><a class="btn btn--primario" href="#/gastos">Ver minhas viagens</a></div></section>`;
    return;
  }
  ctx.titulo(`Gastos · ${v.nome}`);
  const f = v.inicio ? diasAte(v.inicio) : null;
  el.innerHTML = `
  <div class="shell">
    <a class="voltar" href="#/gastos">${icone('i-voltar')} Minhas viagens</a>
    <p class="kicker">Controle de gastos</p>
    <h1>${esc(v.nome)}</h1>
    <div class="meta-linha">
      ${v.inicio ? `<span class="selo">${esc(dataBR(v.inicio))}${v.fim ? ' a ' + esc(dataBR(v.fim)) : ''}</span>` : '<span class="selo">Sem datas</span>'}
      ${f != null ? `<span class="selo selo--info">${f > 0 ? `Faltam ${f} dia(s)` : diasAte(v.fim || v.inicio) >= 0 ? 'Em viagem' : 'Concluída'}</span>` : ''}
      <span class="selo">${v.pessoas} pessoa(s)</span>
      ${v.cadernoId ? `<a class="selo selo--info" href="#/caderno/${esc(v.cadernoId)}">Abrir caderno do roteiro</a>` : ''}
    </div>
    <div id="painel-viagem" style="margin-top:var(--sp-5)"></div>
  </div>`;
  painelViagem(el.querySelector('#painel-viagem'), id, { signal, aoApagar: () => { location.hash = '#/gastos'; } });
}
