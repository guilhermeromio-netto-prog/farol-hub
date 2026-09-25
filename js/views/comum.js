// Peças compartilhadas entre telas — Farol · byGui
import { esc, bandeira, textoPuro, tempoRelativo, icone } from '../ui.js';
import { fotosWiki } from '../api.js';

export function hrefDestino(l) {
  const q = new URLSearchParams();
  if (l.nome) q.set('nome', l.nome);
  if (l.cc) q.set('pais', l.cc);
  if (l.regiao) q.set('regiao', l.regiao);
  return `#/destino/${Number(l.lat).toFixed(4)},${Number(l.lon).toFixed(4)}?${q.toString()}`;
}

export function cardDestaque(d, paises) {
  const p = paises[d.pais];
  return `<a class="card card--link destaque destaque--foto" href="#/destino/${esc(d.slug)}" data-pais="${esc(d.pais)}">
    <div class="destaque__foto"><img data-wiki="${esc(d.wiki)}" alt="" width="480" height="300" loading="lazy" decoding="async"></div>
    <div class="destaque__corpo">
      <span class="destaque__pais"><img src="${bandeira(d.pais)}" alt="" width="20" height="14" loading="lazy">${esc(d.local)}${p && d.local !== p.n ? ' · ' + esc(p.n) : ''}</span>
      <h3>${esc(d.nome)}</h3>
      <p>${esc(d.resumo)}</p>
      <span class="destaque__ir">Ver painel ${icone('i-seta')}</span>
    </div>
  </a>`;
}

/** Preenche as fotos dos cartões (uma chamada em lote à Wikipédia). Falha silenciosa: fica o fundo neutro. */
export async function carregarFotosCartoes(raiz, { signal } = {}) {
  const imgs = [...raiz.querySelectorAll('img[data-wiki]')];
  if (!imgs.length) return;
  try {
    const mapa = await fotosWiki(imgs.map((i) => i.dataset.wiki), { tamanho: 500, signal });
    if (signal && signal.aborted) return;
    imgs.forEach((img) => {
      const f = mapa[img.dataset.wiki];
      if (!f) return;
      img.onload = () => img.classList.add('is-ok');
      img.src = f.src;
    });
  } catch { /* sem fotos: o cartão continua legível */ }
}

export function cardNoticia(n) {
  const resumo = textoPuro(n.resumo, 180);
  const img = n.imagem && /^https:\/\//.test(n.imagem) ? `<img src="${esc(n.imagem)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '';
  const quando = tempoRelativo(n.data);
  return `<article class="card card--tight noticia">
    ${img}
    <h3><a href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">${esc(textoPuro(n.titulo))}<span class="sr-only"> (abre em nova aba)</span></a></h3>
    ${resumo ? `<p>${esc(resumo)}</p>` : ''}
    <div class="noticia__meta"><span class="selo selo--info">${esc(n.fonte)}</span>${quando ? `<time datetime="${esc(n.data)}">${esc(quando)}</time>` : ''}</div>
  </article>`;
}
