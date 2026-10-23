// Tela: Descobrir (#/descobrir/<destino>): deslize nos lugares reais e monte o roteiro com as curtidas. Farol · byGui
import { esc, icone, toast, numero, carregandoHTML, prefereMenosMovimento } from '../ui.js';
import { listarCandidatos, resumoDoLugar } from '../candidatos.js';
import { montarCadernoDasCurtidas } from '../agrupar.js';
import { briefPadrao, resolverLugar, DIAS } from '../planner.js';
import { lerBriefing, gravarBriefing, definirAtual, salvarCaderno } from '../store.js';
import { msgErro } from '../api.js';

const LIMIAR = 90; // px arrastados para contar como voto

const lerVotos = (k) => { try { return JSON.parse(localStorage.getItem('farol:votos:' + k)) || {}; } catch { return {}; } };
const gravarVotos = (k, v) => { try { localStorage.setItem('farol:votos:' + k, JSON.stringify(v)); return true; } catch { return false; } };

async function resolverDestino(params, query, dados, signal) {
  const id = params[0] || '';
  const dest = dados.destaques.find((d) => d.slug === id);
  if (dest) return { chave: dest.slug, nome: dest.nome, lat: dest.lat, lon: dest.lon, tipo: dest.tipo, voltar: `#/destino/${dest.slug}` };
  const m = id.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180) {
    const lat = +m[1], lon = +m[2];
    const nome = query.get('nome') || 'Destino';
    return { chave: `${lat.toFixed(3)},${lon.toFixed(3)}`, nome, lat, lon, tipo: '', voltar: `#/destino/${lat},${lon}?nome=${encodeURIComponent(nome)}` };
  }
  const nomeBusca = id === 'busca' ? (query.get('nome') || '').trim() : '';
  if (nomeBusca.length >= 2) {
    const r = await resolverLugar(nomeBusca, dados, { signal });
    if (r && r.destaque) return { chave: r.destaque.slug, nome: r.destaque.nome, lat: r.lat, lon: r.lon, tipo: r.destaque.tipo, voltar: `#/destino/${r.destaque.slug}` };
    if (r) return { chave: `${r.lat.toFixed(3)},${r.lon.toFixed(3)}`, nome: r.nome, lat: r.lat, lon: r.lon, tipo: '', voltar: `#/destino/${r.lat},${r.lon}?nome=${encodeURIComponent(r.nome)}` };
  }
  return null;
}

export function render(ctx) {
  const { el, params, query, dados, signal } = ctx;
  ctx.titulo('Descobrir lugares');
  el.innerHTML = `<section class="shell">${carregandoHTML('Localizando o destino', 3)}</section>`;
  resolverDestino(params, query, dados, signal).then((d) => {
    if (signal.aborted) return;
    if (!d) {
      el.innerHTML = `<section class="shell"><a class="voltar" href="#/">${icone('i-voltar')} Início</a><h1 tabindex="-1">Destino não encontrado</h1><p class="lead">Não achamos esse lugar no mapa. Escolha um destino no início ou digite o nome de uma cidade no planejador.</p><div class="acoes"><a class="btn btn--primario" href="#/">Buscar um destino</a><a class="btn btn--fantasma" href="#/planejar">Planejar viagem</a></div></section>`;
      return;
    }
    desenhar(ctx, d);
  }).catch((e) => {
    if (signal.aborted || e.status === -1) return;
    el.innerHTML = `<section class="shell"><div class="erro" role="alert"><strong>Não deu para localizar o destino</strong>${esc(msgErro(e))}</div></section>`;
  });
}

function desenhar(ctx, d) {
  const { el, dados, signal } = ctx;
  ctx.titulo(`Descobrir ${d.nome}`);
  const votos = lerVotos(d.chave);
  let candidatos = [];
  let fila = [];
  const historico = [];
  const anterior = lerBriefing();
  const diasIni = anterior && anterior.destination && anterior.destination.toLowerCase() === d.nome.toLowerCase() ? anterior.days : 5;

  el.innerHTML = `<section class="shell descobrir">
    <a class="voltar" href="${esc(d.voltar)}">${icone('i-voltar')} ${esc(d.nome)}</a>
    <p class="kicker">Descobrir</p>
    <h1 tabindex="-1">O que você quer ver em ${esc(d.nome)}?</h1>
    <p class="lead">Arraste o cartão para a direita se gostou e para a esquerda se não. Com as curtidas, o Farol monta os dias da viagem por proximidade.</p>
    <p class="descobrir__progresso" id="dc-prog" role="status" aria-live="polite"></p>
    <div class="deck" id="dc-deck">${carregandoHTML('Buscando lugares reais no OpenStreetMap', 4)}</div>
    <div class="deck__botoes" id="dc-botoes" hidden>
      <button type="button" class="btn btn--fantasma deck__btn" id="dc-nao" aria-keyshortcuts="ArrowLeft">${icone('i-fechar')} Não gostei</button>
      <button type="button" class="btn btn--fantasma btn--pequeno" id="dc-desfazer" disabled>Desfazer</button>
      <button type="button" class="btn btn--primario deck__btn" id="dc-sim" aria-keyshortcuts="ArrowRight">Gostei ${icone('i-seta')}</button>
    </div>
    <div class="card descobrir__montar" id="dc-montar">
      <h2 style="font-size:1.1rem;margin:0 0 var(--sp-2)">Montar roteiro</h2>
      <p class="faint" id="dc-curtidos"></p>
      <div class="descobrir__linha">
        <label for="dc-dias">Dias de viagem</label>
        <select class="select" id="dc-dias">${DIAS.map((n) => `<option value="${n}" ${n === diasIni ? 'selected' : ''}>${n} dias</option>`).join('')}</select>
      </div>
      <div class="acoes">
        <button type="button" class="btn btn--primario" id="dc-montar-btn">Montar roteiro ${icone('i-seta')}</button>
        <button type="button" class="btn btn--fantasma btn--pequeno" id="dc-zerar">Recomeçar votos</button>
      </div>
      <p class="faint" style="margin-top:var(--sp-3)">Lugares do OpenStreetMap e fotos da Wikipédia. Seus votos ficam só neste aparelho.</p>
    </div>
  </section>`;

  const $ = (s) => el.querySelector(s);
  const deck = $('#dc-deck');
  const curtidas = () => Object.values(votos).filter((v) => v.voto === 'sim').map((v) => v.lugar);

  function atualizarContadores() {
    const vistos = candidatos.filter((c) => votos[c.id]).length;
    const nSim = curtidas().length;
    $('#dc-prog').textContent = candidatos.length ? `${vistos} de ${candidatos.length} lugares vistos · ${nSim} ${nSim === 1 ? 'curtido' : 'curtidos'}` : '';
    $('#dc-curtidos').textContent = nSim ? `${nSim} ${nSim === 1 ? 'lugar curtido' : 'lugares curtidos'} até agora.` : 'Curta pelo menos um lugar para montar o roteiro.';
    $('#dc-montar-btn').disabled = !nSim;
    $('#dc-desfazer').disabled = !historico.length;
  }

  const fotoHTML = (p) => p.foto
    ? `<img src="${esc(p.foto.src)}" alt="Foto de ${esc(p.nome)}" draggable="false" loading="eager" decoding="async">`
    : `<span class="deck__semfoto">${icone('i-pin')}<span>Sem foto livre na Wikipédia</span></span>`;
  const distTxt = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${numero(km, 1)} km`);
  const cartaoHTML = (p, topo) => `<article class="deck__card${topo ? ' is-topo' : ''}" data-id="${esc(p.id)}" ${topo ? 'tabindex="0" aria-roledescription="cartão" aria-label="' + esc(p.nome) + '"' : 'aria-hidden="true"'}>
      <div class="deck__foto">${fotoHTML(p)}<span class="deck__selo deck__selo--sim" aria-hidden="true">Gostei</span><span class="deck__selo deck__selo--nao" aria-hidden="true">Não</span></div>
      <div class="deck__corpo">
        <p class="deck__tipo">${esc(p.tipo)} · ${distTxt(p.dist)} do centro</p>
        <h2 class="deck__nome">${esc(p.nome)}</h2>
        <p class="deck__resumo" data-resumo>${p.resumo ? esc(p.resumo) : ''}</p>
        ${p.horario ? `<p class="faint deck__horario">Horário no OpenStreetMap: ${esc(p.horario)}</p>` : ''}
      </div>
    </article>`;

  function desenharDeck() {
    fila = candidatos.filter((c) => !votos[c.id]);
    atualizarContadores();
    if (!fila.length) {
      deck.innerHTML = `<div class="vazio deck__fim">Você viu todos os ${candidatos.length} lugares. Agora é só montar o roteiro abaixo.</div>`;
      $('#dc-botoes').hidden = !historico.length;
      $('#dc-sim').disabled = true; $('#dc-nao').disabled = true;
      return;
    }
    $('#dc-botoes').hidden = false;
    $('#dc-sim').disabled = false; $('#dc-nao').disabled = false;
    deck.innerHTML = fila.slice(0, 2).reverse().map((p, i, arr) => cartaoHTML(p, i === arr.length - 1)).join('');
    const topo = deck.querySelector('.is-topo');
    ligarArraste(topo);
    carregarResumo(fila[0], topo);
  }

  async function carregarResumo(p, card) {
    if (p.resumo !== undefined || !p.wikiPt) return;
    p.resumo = '';
    try {
      p.resumo = await resumoDoLugar(p, { signal });
      const alvo = card.isConnected && card.querySelector('[data-resumo]');
      if (alvo) alvo.textContent = p.resumo;
    } catch { /* sem resumo */ }
  }

  function votar(voto) {
    const p = fila[0];
    if (!p) return;
    const { resumo, ...lugar } = p;
    votos[p.id] = { voto, lugar, em: new Date().toISOString() };
    historico.push(p.id);
    if (!gravarVotos(d.chave, votos)) toast('Não deu para guardar o voto neste aparelho (armazenamento cheio ou bloqueado).', 'erro');
    const card = deck.querySelector('.is-topo');
    if (card && !prefereMenosMovimento()) {
      card.style.transition = 'transform .25s ease, opacity .25s ease';
      card.style.transform = `translateX(${voto === 'sim' ? 120 : -120}%) rotate(${voto === 'sim' ? 14 : -14}deg)`;
      card.style.opacity = '0';
      setTimeout(desenharDeck, 230);
    } else desenharDeck();
  }

  function ligarArraste(card) {
    if (!card) return;
    let x0 = 0, y0 = 0, dx = 0, ativo = false;
    card.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      ativo = true; x0 = ev.clientX; y0 = ev.clientY; dx = 0;
      card.setPointerCapture(ev.pointerId);
      card.style.transition = 'none';
    });
    card.addEventListener('pointermove', (ev) => {
      if (!ativo) return;
      dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      card.style.transform = `translate(${dx}px, ${dy * 0.2}px) rotate(${dx / 18}deg)`;
      card.classList.toggle('is-sim', dx > LIMIAR / 2);
      card.classList.toggle('is-nao', dx < -LIMIAR / 2);
    });
    const soltar = () => {
      if (!ativo) return;
      ativo = false;
      if (dx > LIMIAR) return votar('sim');
      if (dx < -LIMIAR) return votar('nao');
      card.style.transition = 'transform .2s ease';
      card.style.transform = '';
      card.classList.remove('is-sim', 'is-nao');
    };
    card.addEventListener('pointerup', soltar);
    card.addEventListener('pointercancel', soltar);
    card.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight') { ev.preventDefault(); votar('sim'); }
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); votar('nao'); }
    });
  }

  $('#dc-sim').addEventListener('click', () => votar('sim'));
  $('#dc-nao').addEventListener('click', () => votar('nao'));
  $('#dc-desfazer').addEventListener('click', () => {
    const id = historico.pop();
    if (!id) return;
    delete votos[id];
    gravarVotos(d.chave, votos);
    desenharDeck();
  });
  $('#dc-zerar').addEventListener('click', () => {
    Object.keys(votos).forEach((k) => delete votos[k]);
    historico.length = 0;
    gravarVotos(d.chave, votos);
    desenharDeck();
    toast('Votos apagados. Pode recomeçar.', 'info');
  });

  let gerando = false;
  $('#dc-montar-btn').addEventListener('click', async () => {
    const lista = curtidas();
    if (!lista.length || gerando) return;
    gerando = true;
    const btn = $('#dc-montar-btn');
    btn.disabled = true; btn.textContent = 'Montando o roteiro…';
    const base = anterior && anterior.destination && anterior.destination.toLowerCase() === d.nome.toLowerCase() ? anterior : briefPadrao();
    const brief = { ...base, destination: d.nome, lat: d.lat, lon: d.lon, days: Number($('#dc-dias').value) || 5 };
    try {
      const plan = await montarCadernoDasCurtidas(brief, dados, lista, { signal, onEtapa: (t) => { btn.textContent = `${t}…`; } });
      if (signal.aborted) return;
      gravarBriefing(brief);
      definirAtual(brief, plan);
      const { ok } = salvarCaderno(brief, plan);
      location.hash = ok ? `#/caderno/${plan.id}` : '#/caderno/atual';
    } catch (e) {
      if (signal.aborted || e.status === -1) return;
      toast(`Não deu para montar o roteiro: ${msgErro(e)}`, 'erro', 7000);
      btn.disabled = false; btn.innerHTML = `Montar roteiro ${icone('i-seta')}`;
    } finally { gerando = false; }
  });

  atualizarContadores();
  listarCandidatos(d, { signal }).then((l) => {
    if (signal.aborted) return;
    candidatos = l;
    // curtidas antigas que não vieram nesta busca continuam valendo
    if (!candidatos.length) { deck.innerHTML = `<div class="vazio">O OpenStreetMap não tem pontos turísticos catalogados perto deste destino.</div>`; atualizarContadores(); return; }
    desenharDeck();
  }).catch((e) => {
    if (signal.aborted || e.status === -1) return;
    deck.innerHTML = `<div class="erro" role="alert"><strong>Não deu para buscar os lugares</strong>${esc(msgErro(e))}<br><button type="button" class="btn btn--fantasma btn--pequeno" id="dc-tentar">Tentar de novo</button></div>`;
    $('#dc-tentar').addEventListener('click', () => desenhar(ctx, d));
  });
}
