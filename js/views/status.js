// Tela: Status e fontes — verificação ao vivo das APIs no seu navegador + última verificação automática. Farol · byGui
import { buscar, ultimaVerificacao, msgErro } from '../api.js';
import { esc, icone, dataBR, carregandoHTML } from '../ui.js';

const WORKFLOW = 'https://github.com/guilhermeromio-netto-prog/farol-hub/actions/workflows/checks.yml';
const hora = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function conferir(dado, espera) {
  if (espera === 'lista') return Array.isArray(dado) && dado.length > 0;
  if (espera === 'items') return Array.isArray(dado.items) && dado.items.length > 0 && (dado.status === undefined || dado.status === 'ok');
  if (espera === 'elements') return Array.isArray(dado.elements);
  if (espera === 'results') return Array.isArray(dado.results) && dado.results.length > 0;
  if (espera === 'xml') return /<item[\s>]/i.test(dado);
  return dado && dado[espera] != null;
}

async function checar(item, signal) {
  const t0 = performance.now();
  try {
    const d = await buscar(item.url, { fonte: item.nome, semCache: true, timeout: item.metodo === 'POST' ? 30000 : 15000, metodo: item.metodo || 'GET', corpo: item.corpo ? 'data=' + encodeURIComponent(item.corpo) : null, texto: item.espera === 'xml', signal });
    const ms = Math.round(performance.now() - t0);
    return conferir(d, item.espera) ? { estado: 'ok', ms } : { estado: 'falha', ms, msg: 'Respondeu, mas sem os dados esperados.' };
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    if (e.status === -1) return { estado: 'cancelado', ms };
    if (e.status === 429) return { estado: 'limitado', ms, msg: 'Limite de consultas atingido (HTTP 429). O serviço está no ar, mas pediu pausa.' };
    return { estado: 'falha', ms, msg: msgErro(e) };
  }
}

export function render(ctx) {
  const { el, dados, signal } = ctx;
  ctx.titulo('Status e fontes');
  const feeds = dados.feeds.map((f) => ({ id: 'feed-' + f.id, nome: `Feed · ${f.nome}${f.cors ? '' : ' (via rss2json)'}`, url: f.cors ? f.url : `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(f.url)}`, espera: f.cors ? 'xml' : 'items' }));
  const itens = [...dados.apis, ...feeds];

  el.innerHTML = `
  <div class="shell">
    <p class="kicker">Garantia e confiança</p>
    <h1>Status e fontes</h1>
    <p class="lead">O Farol só mostra dados de fontes públicas. Aqui você vê, ao vivo e a partir do seu navegador, se cada serviço está respondendo — e o resultado da verificação automática diária.</p>

    <section class="secao" aria-labelledby="t-vivo" style="margin-top:var(--sp-6)">
      <div class="secao__cab"><h2 id="t-vivo">Serviços agora</h2><button type="button" class="btn btn--secundario btn--pequeno" id="btn-rever">Verificar de novo</button></div>
      <p class="faint" id="resumo-vivo" aria-live="polite">Verificando ${itens.length} serviços…</p>
      <div class="card"><div class="status-lista" id="lista-vivo">${itens.map((it) => `<div class="status-linha" data-id="${esc(it.id)}"><div><strong>${esc(it.nome)}</strong><small data-det>Aguardando…</small></div><span class="selo" data-selo>…</span></div>`).join('')}</div></div>
    </section>

    <section class="secao" aria-labelledby="t-auto">
      <h2 id="t-auto">Verificação automática (GitHub Actions)</h2>
      <div class="card" id="box-auto">${carregandoHTML('Consultando a última verificação no GitHub', 2)}</div>
    </section>

    <section class="secao" aria-labelledby="t-fontes">
      <h2 id="t-fontes">Fontes e confiabilidade</h2>
      <div class="tabela-wrap"><table>
        <caption>De onde vem cada dado e com que frequência ele muda</caption>
        <thead><tr><th scope="col">Fonte</th><th scope="col">O que fornece</th><th scope="col">Tempo real ou estimativa?</th></tr></thead>
        <tbody>${dados.fontes.dados.map((f) => `<tr><th scope="row" style="font-weight:600">${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.nome)}<span class="sr-only"> (abre em nova aba)</span></a>` : esc(f.nome)}</th><td>${esc(f.fornece)}</td><td class="muted">${esc(f.tipo)}</td></tr>`).join('')}</tbody>
      </table></div>
    </section>

    <section class="secao" aria-labelledby="t-links">
      <h2 id="t-links">Links de busca verificados</h2>
      <p class="muted" style="max-width:70ch">Cada modelo de link foi aberto num navegador real em ${esc(dataBR(dados.links.verificadoEm))} e é testado todo dia pelo script de verificação. Sites que bloqueiam robôs com captcha (Skyscanner, Hoteis.com) , recusaram o acesso (Decolar) ou caíram numa página genérica (Trivago) ficaram de fora porque não deu para confirmar o formato.</p>
      <div class="tabela-wrap"><table>
        <caption>Sites usados nas abas de Preços</caption>
        <thead><tr><th scope="col">Categoria</th><th scope="col">Site</th><th scope="col">Pré-preenchimento</th></tr></thead>
        <tbody>${dados.links.categorias.flatMap((c) => c.itens.map((i) => `<tr><td>${esc(c.nome)}</td><th scope="row" style="font-weight:600">${esc(i.nome)}</th><td class="muted">${i.preenche ? esc(i.preenche) : 'Não (abre a página inicial)'}</td></tr>`)).join('')}
          <tr><td>Rotas</td><th scope="row" style="font-weight:600">${esc(dados.links.rota.nome)}</th><td class="muted">Origem e destino (por coordenadas)</td></tr></tbody>
      </table></div>
    </section>

    <section class="secao" aria-labelledby="t-limites">
      <h2 id="t-limites">O que o Farol não faz</h2>
      <ul class="lista-marcada lista-limpa card" style="display:grid;gap:6px">
        <li>Não mostra preço ao vivo de passagem, hotel, carro, passeio ou seguro: as faixas são estimativas com data; o preço real aparece ao abrir o link.</li>
        <li>Não informa regras de visto e entrada: use as fontes oficiais do governo em Preços.</li>
        <li>Não usa inteligência artificial: o roteiro é sugerido por regras, com clima e feriados reais.</li>
        <li>Não guarda nada em servidor: cadernos, viagens e gastos ficam no seu navegador. Faça backup em Gastos.</li>
      </ul>
    </section>
  </div>`;

  let rodada = 0;
  async function verificarTudo() {
    const minha = ++rodada;
    const btn = el.querySelector('#btn-rever');
    btn.disabled = true;
    el.querySelectorAll('.status-linha').forEach((l) => { l.querySelector('[data-selo]').className = 'selo'; l.querySelector('[data-selo]').textContent = '…'; l.querySelector('[data-det]').textContent = 'Verificando…'; });
    const fila = itens.slice();
    const cont = { ok: 0, falha: 0, limitado: 0 };
    const trabalhador = async () => {
      while (fila.length) {
        const it = fila.shift();
        const r = await checar(it, signal);
        if (signal.aborted || minha !== rodada) return;
        const linha = el.querySelector(`.status-linha[data-id="${it.id}"]`);
        const selo = linha.querySelector('[data-selo]');
        const agora = new Date();
        if (r.estado === 'ok') { cont.ok++; selo.className = 'selo selo--ok'; selo.textContent = 'OK'; }
        else if (r.estado === 'limitado') { cont.limitado++; selo.className = 'selo selo--aviso'; selo.textContent = 'Limitado'; }
        else if (r.estado === 'falha') { cont.falha++; selo.className = 'selo selo--perigo'; selo.textContent = 'Falha'; }
        linha.querySelector('[data-det]').textContent = `${r.msg ? r.msg + ' · ' : ''}${r.ms} ms · verificado às ${hora(agora)}`;
      }
    };
    await Promise.all([trabalhador(), trabalhador(), trabalhador()]);
    if (signal.aborted || minha !== rodada) return;
    btn.disabled = false;
    el.querySelector('#resumo-vivo').textContent = `${cont.ok} de ${itens.length} OK${cont.limitado ? ` · ${cont.limitado} limitado(s)` : ''}${cont.falha ? ` · ${cont.falha} com falha` : ''} · última verificação às ${hora(new Date())} (horário do seu aparelho).`;
  }
  el.querySelector('#btn-rever').addEventListener('click', verificarTudo);
  verificarTudo();

  (async () => {
    const box = el.querySelector('#box-auto');
    try {
      const { run } = await ultimaVerificacao({ signal });
      if (signal.aborted) return;
      if (!run) { box.innerHTML = `<p class="muted" style="margin:0">Ainda não há execuções registradas. <a href="${WORKFLOW}" target="_blank" rel="noopener noreferrer">Ver no GitHub<span class="sr-only"> (abre em nova aba)</span></a></p>`; return; }
      const concl = run.status !== 'completed' ? { cls: 'selo--info', t: 'Em andamento' } : run.conclusion === 'success' ? { cls: 'selo--ok', t: 'Sucesso' } : { cls: 'selo--perigo', t: run.conclusion === 'failure' ? 'Falhou' : run.conclusion || 'Desconhecido' };
      const quando = new Date(run.run_started_at || run.created_at);
      const evento = { schedule: 'agendada (diária)', push: 'após publicação', workflow_dispatch: 'manual' }[run.event] || run.event;
      box.innerHTML = `<div class="linha-acoes" style="justify-content:space-between"><div><p class="card__rotulo">Última execução · ${esc(evento)}</p><p style="margin:0"><span class="selo ${concl.cls}">${esc(concl.t)}</span> <span class="num">${esc(quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))}</span> <span class="faint">(horário do seu aparelho)</span></p></div>
        <a class="btn btn--fantasma btn--pequeno" href="${esc(run.html_url)}" target="_blank" rel="noopener noreferrer">Ver relatório ${icone('i-externo')}<span class="sr-only"> (abre em nova aba)</span></a></div>
        <p class="faint" style="margin:var(--sp-3) 0 0">O script <code>tools/check.py</code> roda todo dia, a cada publicação e sob demanda: testa cada API, feed, link de busca e arquivo do site e falha se algo quebrar.</p>`;
    } catch (e) {
      if (e.status === -1) return;
      box.innerHTML = `<p style="margin:0" class="muted">${esc(msgErro(e))} <a href="${WORKFLOW}" target="_blank" rel="noopener noreferrer">Abrir as execuções no GitHub<span class="sr-only"> (abre em nova aba)</span></a></p>`;
    }
  })();
}
