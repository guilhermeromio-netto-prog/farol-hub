// Mídia: fotos com crédito, galeria + lightbox, vídeos (YouTube sem cookies, só carrega ao clicar),
// carrossel com teclado, revelar ao rolar e paralaxe suave. Farol · byGui
import { esc, icone, prefereMenosMovimento } from './ui.js';
import { variante } from './api.js';

/* ---------- crédito (Wikimedia Commons) ---------- */
export function creditoHTML(f, { curto = false } = {}) {
  const lic = f.licencaUrl ? `<a href="${esc(f.licencaUrl)}" target="_blank" rel="noopener noreferrer">${esc(f.licenca)}<span class="sr-only"> (abre em nova aba)</span></a>` : esc(f.licenca);
  const commons = `<a href="${esc(f.pagina)}" target="_blank" rel="noopener noreferrer">Wikimedia Commons<span class="sr-only"> (abre em nova aba)</span></a>`;
  return curto ? `Foto: ${esc(f.artista)} · ${lic}` : `Foto: ${esc(f.artista)} · ${lic} · ${commons}`;
}

const altDe = (nome, x) => `Foto de ${nome}${x.f.descricao ? ': ' + x.f.descricao : ''}`.slice(0, 220);

/* ---------- imagem progressiva (caixa com proporção fixa + fade) ---------- */
export function ligarImagens(raiz) {
  raiz.querySelectorAll('img[data-prog]').forEach((img) => {
    const ok = () => { img.classList.add('is-ok'); img.closest('.foto')?.classList.add('is-pronta'); };
    img.addEventListener('load', ok, { once: true });
    img.addEventListener('error', () => img.closest('.foto')?.classList.add('is-falhou'), { once: true });
    if (img.complete && img.naturalWidth) ok();
  });
}

/* ---------- galeria ---------- */
export function galeriaHTML(itens, nome, rotulo = 'Galeria de fotos', desloc = 0) {
  if (!itens.length) return '';
  return `<div class="carrossel" data-carrossel>
    <div class="carrossel__pista galeria" tabindex="0" role="region" aria-label="${esc(rotulo)} — role para o lado ou use as setas do teclado">
      ${itens.map((x, i) => `<button type="button" class="galeria__item foto" data-foto="${i + desloc}" style="aspect-ratio:${Math.min(1.8, Math.max(0.8, x.f.w / x.f.h)).toFixed(3)}" aria-label="Ampliar foto ${i + 1 + desloc} de ${itens.length + desloc}${x.f.descricao ? ': ' + esc(x.f.descricao) : ''}">
        <img data-prog src="${esc(variante(x.f, 500))}" alt="${esc(altDe(nome, x))}" loading="lazy" decoding="async" width="500" height="${Math.round(500 * x.f.h / x.f.w)}">
        <span class="galeria__cred">${esc(x.f.artista)}</span>
      </button>`).join('')}
    </div>
    <div class="carrossel__ctl"><button type="button" class="btn-icone" data-c-prev aria-label="Fotos anteriores">${icone('i-esq')}</button><button type="button" class="btn-icone" data-c-next aria-label="Próximas fotos">${icone('i-dir')}</button></div>
  </div>`;
}

export function ligarGaleria(raiz, itens, nome, { signal } = {}) {
  raiz.querySelectorAll('[data-foto]').forEach((b) => b.addEventListener('click', () => abrirLightbox(itens, Number(b.dataset.foto), nome, b)));
  ligarImagens(raiz);
  ligarCarrossel(raiz, { signal });
}

/* ---------- lightbox acessível (<dialog>) ---------- */
let dlg = null;
export function abrirLightbox(itens, inicio, nome, gatilho) {
  if (!itens.length) return;
  let i = inicio;
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.setAttribute('aria-label', 'Foto ampliada');
    document.body.appendChild(dlg);
  }
  dlg.innerHTML = `<div class="lightbox__corpo">
    <button type="button" class="btn-icone lightbox__fechar" data-lb-fechar aria-label="Fechar foto">${icone('i-fechar')}</button>
    <figure class="lightbox__fig">
      <div class="lightbox__img foto"><img data-lb-img alt=""></div>
      <figcaption class="lightbox__leg" aria-live="polite"><span data-lb-cont class="num"></span><span data-lb-desc></span><span data-lb-cred class="lightbox__cred"></span></figcaption>
    </figure>
    <button type="button" class="btn-icone lightbox__nav lightbox__nav--esq" data-lb-prev aria-label="Foto anterior">${icone('i-esq')}</button>
    <button type="button" class="btn-icone lightbox__nav lightbox__nav--dir" data-lb-next aria-label="Próxima foto">${icone('i-dir')}</button>
  </div>`;
  const img = dlg.querySelector('[data-lb-img]');
  const mostrar = (n) => {
    i = (n + itens.length) % itens.length;
    const x = itens[i];
    const caixa = img.closest('.foto');
    caixa.classList.remove('is-pronta');
    img.classList.remove('is-ok');
    img.onload = () => { img.classList.add('is-ok'); caixa.classList.add('is-pronta'); };
    img.src = variante(x.f, window.innerWidth > 900 ? 1920 : 1280);
    img.alt = altDe(nome, x);
    dlg.querySelector('[data-lb-cont]').textContent = `${i + 1} / ${itens.length}`;
    dlg.querySelector('[data-lb-desc]').textContent = x.f.descricao || `Foto de ${nome}`;
    dlg.querySelector('[data-lb-cred]').innerHTML = creditoHTML(x.f);
    // pré-carrega a vizinha
    const viz = itens[(i + 1) % itens.length];
    if (viz && viz !== x) new Image().src = variante(viz.f, 1280);
  };
  dlg.querySelector('[data-lb-fechar]').onclick = () => dlg.close();
  dlg.querySelector('[data-lb-prev]').onclick = () => mostrar(i - 1);
  dlg.querySelector('[data-lb-next]').onclick = () => mostrar(i + 1);
  dlg.querySelectorAll('[data-lb-prev],[data-lb-next]').forEach((b) => { b.hidden = itens.length < 2; });
  dlg.onkeydown = (ev) => {
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); mostrar(i - 1); }
    if (ev.key === 'ArrowRight') { ev.preventDefault(); mostrar(i + 1); }
  };
  dlg.onclick = (ev) => { if (ev.target === dlg || ev.target.classList.contains('lightbox__corpo')) dlg.close(); };
  // deslizar no celular
  let x0 = null;
  dlg.onpointerdown = (ev) => { x0 = ev.clientX; };
  dlg.onpointerup = (ev) => { if (x0 == null) return; const dx = ev.clientX - x0; x0 = null; if (Math.abs(dx) > 60 && itens.length > 1) mostrar(i + (dx < 0 ? 1 : -1)); };
  dlg.onclose = () => { dlg.innerHTML = ''; document.documentElement.classList.remove('sem-rolagem'); if (gatilho && document.contains(gatilho)) gatilho.focus(); };
  mostrar(i);
  document.documentElement.classList.add('sem-rolagem');
  dlg.showModal();
  dlg.querySelector('[data-lb-fechar]').focus();
}
export function fecharLightbox() { if (dlg && dlg.open) dlg.close(); }

/* ---------- carrossel com snap + teclado ---------- */
export function ligarCarrossel(raiz, { signal } = {}) {
  raiz.querySelectorAll('[data-carrossel]').forEach((c) => {
    if (c.dataset.ligado) return;
    c.dataset.ligado = '1';
    const pista = c.querySelector('.carrossel__pista');
    const prev = c.querySelector('[data-c-prev]'), prox = c.querySelector('[data-c-next]');
    const passo = () => Math.max(160, Math.round(pista.clientWidth * 0.85));
    const comportamento = () => (prefereMenosMovimento() ? 'auto' : 'smooth');
    const atualizar = () => {
      const max = pista.scrollWidth - pista.clientWidth - 2;
      if (prev) prev.disabled = pista.scrollLeft <= 2;
      if (prox) prox.disabled = pista.scrollLeft >= max;
      c.classList.toggle('sem-rolagem-lateral', max <= 0);
    };
    prev && prev.addEventListener('click', () => pista.scrollBy({ left: -passo(), behavior: comportamento() }));
    prox && prox.addEventListener('click', () => pista.scrollBy({ left: passo(), behavior: comportamento() }));
    pista.addEventListener('keydown', (ev) => {
      if (ev.target !== pista) return;
      if (ev.key === 'ArrowRight') { ev.preventDefault(); pista.scrollBy({ left: passo(), behavior: comportamento() }); }
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); pista.scrollBy({ left: -passo(), behavior: comportamento() }); }
      if (ev.key === 'Home') { ev.preventDefault(); pista.scrollTo({ left: 0, behavior: comportamento() }); }
      if (ev.key === 'End') { ev.preventDefault(); pista.scrollTo({ left: pista.scrollWidth, behavior: comportamento() }); }
    });
    pista.addEventListener('scroll', () => requestAnimationFrame(atualizar), { passive: true });
    // foco em item dentro da pista traz o item para a vista
    pista.addEventListener('focusin', (ev) => { if (ev.target !== pista) ev.target.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: comportamento() }); });
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(atualizar); ro.observe(pista); if (signal) signal.addEventListener('abort', () => ro.disconnect(), { once: true }); }
    atualizar();
  });
}

/* ---------- vídeos (YouTube sem cookies; player só carrega ao clicar) ---------- */
export const ytThumb = (id) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
export const ytBusca = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

export function videoCardHTML(v, { grande = false } = {}) {
  return `<article class="video ${grande ? 'video--grande' : ''}">
    <button type="button" class="video__facade foto" data-video="${esc(v.id)}" data-titulo="${esc(v.titulo)}" aria-label="Reproduzir vídeo: ${esc(v.titulo)} (${esc(v.duracao || '')}, canal ${esc(v.canal)})">
      <img data-prog src="${esc(ytThumb(v.id))}" alt="" loading="lazy" decoding="async" width="480" height="360">
      <span class="video__play">${icone('i-play')}</span>
      ${v.duracao ? `<span class="video__dur num">${esc(v.duracao)}</span>` : ''}
    </button>
    <h3 class="video__titulo">${esc(v.titulo)}</h3>
    <p class="video__canal">${esc(v.canal)}</p>
  </article>`;
}

export function ligarVideos(raiz) {
  ligarImagens(raiz);
  raiz.querySelectorAll('[data-video]').forEach((b) => {
    if (b.dataset.ligado) return;
    b.dataset.ligado = '1';
    b.addEventListener('click', () => {
      const f = document.createElement('div');
      f.className = 'video__player';
      f.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.dataset.video)}?autoplay=1&rel=0&hl=pt-BR" title="${esc(b.dataset.titulo)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" loading="lazy"></iframe>`;
      b.replaceWith(f);
      f.querySelector('iframe').focus();
    });
  });
}

/* ---------- revelar ao rolar + paralaxe (desligados com movimento reduzido) ---------- */
export function ligarRevelar(raiz, { signal } = {}) {
  const itens = [...raiz.querySelectorAll('.revela')];
  if (!itens.length) return;
  if (prefereMenosMovimento() || !('IntersectionObserver' in window)) { itens.forEach((e) => e.classList.add('is-visivel')); return; }
  document.documentElement.classList.add('anim');
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-visivel'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  itens.forEach((e, k) => { e.style.setProperty('--atraso', `${Math.min(k % 6, 5) * 60}ms`); io.observe(e); });
  if (signal) signal.addEventListener('abort', () => io.disconnect(), { once: true });
}

export function ligarParalaxe(hero, { signal } = {}) {
  const alvo = hero && hero.querySelector('[data-paralaxe]');
  if (!alvo || prefereMenosMovimento()) return;
  let pendente = false;
  const mover = () => {
    pendente = false;
    const y = Math.min(window.scrollY, hero.offsetHeight * 1.2);
    alvo.style.setProperty('--py', `${(y * 0.22).toFixed(1)}px`);
  };
  const aoRolar = () => { if (!pendente) { pendente = true; requestAnimationFrame(mover); } };
  window.addEventListener('scroll', aoRolar, { passive: true });
  if (signal) signal.addEventListener('abort', () => window.removeEventListener('scroll', aoRolar), { once: true });
}
