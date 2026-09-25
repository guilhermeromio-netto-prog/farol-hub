#!/usr/bin/env python3
"""Farol · verificador de garantias (só biblioteca padrão do Python).

Confere, a partir do dados.json:
  • arquivos internos (index.html, CSS, todos os módulos JS importados, fontes, dados.json) e a
    coerência do dados.json;
  • cada API usada pelo site (status HTTP, cabeçalho CORS, formato da resposta);
  • os feeds RSS (precisam ter <item>) e o conversor rss2json;
  • cada modelo de link de busca preenchido com valores de exemplo, as páginas Civitatis
    de cada destino, os títulos da Wikipédia e as fontes oficiais.

Uso:
  python3 tools/check.py                      # arquivos locais + serviços externos
  python3 tools/check.py --base https://guilhermeromio-netto-prog.github.io/farol-hub/
  python3 tools/check.py --so-internos        # sem rede

Saída: relatório em português. Código de saída 1 se houver alguma FALHA.
Avisos (limite de requisições, captcha, bloqueio a robôs) não reprovam: o site trata esses casos.
Farol · feito por byGui.
"""
import argparse
import concurrent.futures as cf
import datetime as dt
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEM_SITE = 'https://guilhermeromio-netto-prog.github.io'
UA_API = 'FarolCheck/2.0 (+https://github.com/guilhermeromio-netto-prog/farol-hub; verificador de status)'
UA_NAV = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 FarolCheck/2.0'
SINAIS_CAPTCHA = ('captcha', 'px-captcha', 'cf-chl', 'are you a robot', 'access denied', 'perimeterx', 'datadome')

OK, AVISO, FALHA = 'ok', 'aviso', 'falha'
SIMBOLO = {OK: '✔ OK    ', AVISO: '⚠ AVISO ', FALHA: '✖ FALHA '}
resultados = []  # (grupo, nome, estado, detalhe)
_trava = threading.Lock()
_travas_host = {}
_ultimo_host = {}
INTERVALO_HOST = {'www.civitatis.com': 0.6, 'wikimedia.org': 1.0, 'pt.wikipedia.org': 0.3}


def registrar(grupo, nome, estado, detalhe=''):
    with _trava:
        resultados.append((grupo, nome, estado, detalhe))


def _espaco_host(host):
    with _trava:
        tr = _travas_host.setdefault(host, threading.Lock())
    return tr


def requisitar(url, metodo='GET', corpo=None, cabecalhos=None, ua=UA_API, tentativas=3, tempo=25, ler=400_000):
    """Devolve dict(status, headers, corpo, url_final, erro). Repete com espera em erro de rede, 5xx e 429."""
    host = urllib.parse.urlsplit(url).hostname or ''
    ultimo = None
    for n in range(tentativas):
        cab = {'User-Agent': ua, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.5', 'Accept': '*/*'}
        cab.update(cabecalhos or {})
        dados = corpo.encode('utf-8') if isinstance(corpo, str) else corpo
        req = urllib.request.Request(url, data=dados, method=metodo, headers=cab)
        tr = _espaco_host(host)
        with tr:
            espera = INTERVALO_HOST.get(host, 0) - (time.time() - _ultimo_host.get(host, 0))
            if espera > 0:
                time.sleep(espera)
            try:
                with urllib.request.urlopen(req, timeout=tempo) as r:
                    res = {'status': r.status, 'headers': {k.lower(): v for k, v in r.headers.items()},
                           'corpo': r.read(ler), 'url_final': r.geturl(), 'erro': None}
            except urllib.error.HTTPError as e:
                try:
                    txt = e.read(ler)
                except Exception:
                    txt = b''
                res = {'status': e.code, 'headers': {k.lower(): v for k, v in (e.headers or {}).items()},
                       'corpo': txt, 'url_final': e.geturl() if hasattr(e, 'geturl') else url, 'erro': None}
            except Exception as e:  # DNS, timeout, TLS
                res = {'status': 0, 'headers': {}, 'corpo': b'', 'url_final': url, 'erro': f'{type(e).__name__}: {e}'}
            finally:
                _ultimo_host[host] = time.time()
        ultimo = res
        repetir = res['status'] == 0 or res['status'] >= 500 or res['status'] == 429
        if not repetir or n == tentativas - 1:
            break
        ra = res['headers'].get('retry-after', '')
        time.sleep(min(int(ra), 20) if ra.isdigit() else (2, 5, 9)[n])
    return ultimo


def texto(res):
    return res['corpo'].decode('utf-8', 'replace')


def descrever(res):
    return res['erro'] if res['status'] == 0 else f'HTTP {res["status"]}'


def cors_ok(res):
    acao = res['headers'].get('access-control-allow-origin', '')
    return acao == '*' or acao.rstrip('/') == ORIGEM_SITE


# ---------------------------------------------------------------- internos
def arquivos_internos(dados_txt, base):
    grupo = 'Arquivos do site'
    locais = set(['index.html', 'dados.json'])
    html = open(os.path.join(RAIZ, 'index.html'), encoding='utf-8').read()
    for ref in re.findall(r'(?:href|src)="([^"#]+)"', html):
        if not re.match(r'^(https?:|mailto:|data:|//)', ref) and ref not in ('./', '/'):
            locais.add(ref.lstrip('./'))
    # módulos JS (imports estáticos e dinâmicos) a partir de js/app.js
    fila = [p for p in list(locais) if p.endswith('.js')]
    vistos = set()
    while fila:
        f = fila.pop()
        if f in vistos:
            continue
        vistos.add(f)
        caminho = os.path.join(RAIZ, f)
        if not os.path.exists(caminho):
            continue
        src = open(caminho, encoding='utf-8').read()
        for imp in re.findall(r'''(?:from\s+|import\s*\(\s*|import\s+)['"](\.{1,2}/[^'"]+)['"]''', src):
            alvo = os.path.normpath(os.path.join(os.path.dirname(f), imp)).replace(os.sep, '/')
            locais.add(alvo)
            fila.append(alvo)
    for css in [p for p in list(locais) if p.endswith('.css')]:
        caminho = os.path.join(RAIZ, css)
        if os.path.exists(caminho):
            for u in re.findall(r'url\(["\']?([^)"\']+)["\']?\)', open(caminho, encoding='utf-8').read()):
                if not u.startswith(('data:', 'http', '#')):
                    locais.add(os.path.normpath(os.path.join(os.path.dirname(css), u)).replace(os.sep, '/'))
    for f in sorted(locais):
        caminho = os.path.join(RAIZ, f)
        if not os.path.exists(caminho):
            registrar(grupo, f, FALHA, 'arquivo referenciado não existe no repositório')
            continue
        tam = os.path.getsize(caminho)
        if base:
            res = requisitar(urllib.parse.urljoin(base, f), ua=UA_API, tentativas=2, ler=50_000_000)
            if res['status'] != 200:
                registrar(grupo, f, FALHA, f'publicado: {descrever(res)}')
                continue
            if f.endswith(('.js', '.css', '.json', '.html')) and len(res['corpo']) != tam:
                registrar(grupo, f, AVISO, f'publicado com {len(res["corpo"])} bytes, local tem {tam} (deploy pendente?)')
                continue
        registrar(grupo, f, OK, f'{tam / 1024:.1f} KB' + (' · publicado' if base else ''))
    # peso de fontes e imagens
    for f in sorted(locais):
        if f.endswith(('.woff2', '.png', '.jpg', '.webp', '.svg')) and os.path.exists(os.path.join(RAIZ, f)):
            if os.path.getsize(os.path.join(RAIZ, f)) > 200 * 1024:
                registrar(grupo, f, AVISO, 'arquivo acima de 200 KB')
    return locais


def coerencia_dados(d):
    grupo = 'Coerência do dados.json'
    problemas = []
    iatas = {a['iata'] for a in d.get('aeroportos', [])}
    for x in d.get('destaques', []):
        for campo in ('slug', 'nome', 'lat', 'lon', 'wiki', 'tipo'):
            if x.get(campo) in (None, ''):
                problemas.append(f'destaque {x.get("slug")}: sem "{campo}"')
        if x.get('iata') and x['iata'] not in iatas:
            problemas.append(f'destaque {x["slug"]}: IATA {x["iata"]} fora da tabela de aeroportos')
        if x.get('tipo') and x['tipo'] not in d.get('dicasPorTipo', {}):
            problemas.append(f'destaque {x["slug"]}: tipo "{x["tipo"]}" sem dicas')
    for o in d.get('origens', []):
        if o.get('iata') and o['iata'] not in iatas:
            problemas.append(f'origem {o["nome"]}: IATA {o["iata"]} fora da tabela')
    precos = d.get('precos', {})
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', str(precos.get('atualizadoEm', ''))):
        problemas.append('precos.atualizadoEm ausente ou fora do formato AAAA-MM-DD')
    for reg in d.get('custos', {}):
        faixas = precos.get('regioes', {}).get(reg)
        if not faixas:
            problemas.append(f'precos: região de custo "{reg}" sem faixas')
            continue
        for u in precos.get('unidades', []):
            for nivel in ('economico', 'medio'):
                v = (faixas.get(u) or {}).get(nivel)
                if not (isinstance(v, list) and len(v) == 2 and 0 < v[0] <= v[1]):
                    problemas.append(f'precos.{reg}.{u}.{nivel}: faixa inválida {v!r}')
    ex = d.get('links', {}).get('exemplo', {})
    modelos = [it for c in d.get('links', {}).get('categorias', []) for it in c.get('itens', [])] + [d.get('links', {}).get('rota', {})]
    for it in modelos:
        for k in re.findall(r'\{(\w+)\}', it.get('modelo', '')):
            if k not in ex:
                problemas.append(f'link {it.get("id")}: marcador {{{k}}} sem valor de exemplo')
    for a in d.get('apis', []):
        if not a.get('url', '').startswith('https://'):
            problemas.append(f'api {a.get("id")}: URL sem https')
    if problemas:
        for p in problemas:
            registrar(grupo, 'dados.json', FALHA, p)
    else:
        registrar(grupo, 'dados.json', OK, f'{len(d.get("destaques", []))} destaques, {len(iatas)} aeroportos, '
                  f'{len(modelos)} modelos de link, preços de {precos.get("atualizadoEm")}')
    # idade da estimativa de preços
    try:
        idade = (dt.date.today() - dt.date.fromisoformat(precos['atualizadoEm'])).days
        if idade > 180:
            registrar(grupo, 'precos.atualizadoEm', AVISO, f'estimativas com {idade} dias; revise as faixas')
    except Exception:
        pass


# ---------------------------------------------------------------- externos
def checar_api(a):
    grupo = 'APIs'
    cab = {'Origin': ORIGEM_SITE, 'Accept': 'application/json'}
    if a.get('metodo') == 'POST':
        cab['Content-Type'] = 'application/x-www-form-urlencoded'
        res = requisitar(a['url'], 'POST', 'data=' + urllib.parse.quote(a['corpo']), cab, tempo=40)
    else:
        res = requisitar(a['url'], cabecalhos=cab)
    nome = a['nome']
    if res['status'] == 429:
        return registrar(grupo, nome, AVISO, 'limite de requisições (429) — o site mostra aviso e usa cache')
    if res['status'] != 200:
        return (a['id'], res, nome)
    try:
        j = json.loads(texto(res))
    except Exception:
        return registrar(grupo, nome, FALHA, 'resposta não é JSON')
    esp = a.get('espera')
    if esp == 'lista':
        valido = isinstance(j, list) and len(j) > 0
    else:
        valido = isinstance(j, dict) and j.get(esp) not in (None, [], {})
    if not valido:
        return registrar(grupo, nome, FALHA, f'JSON sem o campo esperado "{esp}"')
    if not cors_ok(res):
        return registrar(grupo, nome, FALHA, 'sem Access-Control-Allow-Origin para o site (o navegador bloquearia)')
    registrar(grupo, nome, OK, 'HTTP 200 · CORS ok · formato ok')


def checar_apis(d):
    pendentes = {}
    with cf.ThreadPoolExecutor(6) as ex:
        for r in ex.map(checar_api, d['apis']):
            if r:
                pendentes[r[0]] = r
    # Overpass tem servidor reserva: uma queda isolada vira aviso.
    for id_, (_, res, nome) in pendentes.items():
        par = {'overpass': 'overpass-reserva', 'overpass-reserva': 'overpass'}.get(id_)
        if par and par not in pendentes:
            registrar('APIs', nome, AVISO, f'{descrever(res)} — o site usa o servidor reserva')
        else:
            registrar('APIs', nome, FALHA, descrever(res))


def checar_feed(f):
    grupo = 'Feeds de notícias'
    res = requisitar(f['url'], cabecalhos={'Origin': ORIGEM_SITE}, ua=UA_NAV)
    itens = len(re.findall(r'<item[\s>]', texto(res))) if res['status'] == 200 else 0
    if res['status'] != 200 or itens == 0:
        registrar(grupo, f['nome'], AVISO, f'feed direto: {descrever(res)}, {itens} itens — o site mostra erro só nesse feed')
        return False
    if f.get('cors'):
        if not cors_ok(res):
            registrar(grupo, f['nome'], AVISO, f'{itens} itens, mas o CORS sumiu — o site cai para o rss2json')
        else:
            registrar(grupo, f['nome'], OK, f'{itens} itens · CORS direto ok')
        return True
    conv = requisitar('https://api.rss2json.com/v1/api.json?rss_url=' + urllib.parse.quote(f['url'], safe=''),
                      cabecalhos={'Origin': ORIGEM_SITE})
    try:
        j = json.loads(texto(conv)) if conv['status'] == 200 else {}
    except Exception:
        j = {}
    if conv['status'] == 429:
        registrar(grupo, f['nome'], AVISO, f'{itens} itens no feed; rss2json limitou (429)')
    elif j.get('status') == 'ok' and j.get('items'):
        registrar(grupo, f['nome'], OK, f'{itens} itens no feed · {len(j["items"])} via rss2json')
    else:
        registrar(grupo, f['nome'], AVISO, f'{itens} itens no feed, mas rss2json respondeu {descrever(conv)} {j.get("message", "")}'.strip())
    return True


def checar_feeds(d):
    with cf.ThreadPoolExecutor(4) as ex:
        ok = list(ex.map(checar_feed, d.get('feeds', [])))
    if ok and not any(ok):
        registrar('Feeds de notícias', 'todos os feeds', FALHA, 'nenhum feed respondeu com itens')


def checar_link(grupo, nome, url, exigir_caminho=None):
    res = requisitar(url, ua=UA_NAV, tentativas=2, ler=300_000)
    st = res['status']
    corpo = texto(res).lower()
    final = res['url_final'] or url
    if st == 0:
        return registrar(grupo, nome, FALHA, f'{res["erro"]} · {url}')
    if st in (404, 410):
        return registrar(grupo, nome, FALHA, f'HTTP {st} · {url}')
    if st in (401, 403, 429, 202) or any(s in corpo[:200_000] for s in SINAIS_CAPTCHA) and st != 200:
        return registrar(grupo, nome, AVISO, f'não verificável por robô (HTTP {st}, bloqueio/captcha) · {url}')
    if st >= 500:
        return registrar(grupo, nome, AVISO, f'HTTP {st} (instável no momento) · {url}')
    if exigir_caminho and exigir_caminho not in urllib.parse.urlsplit(final).path:
        return registrar(grupo, nome, FALHA, f'redirecionou para {final} (página do destino não existe mais)')
    registrar(grupo, nome, OK, f'HTTP {st}' + (f' → {final[:90]}' if final.rstrip('/') != url.rstrip('/') else ''))


def preencher(modelo, v):
    return re.sub(r'\{(\w+)\}', lambda m: urllib.parse.quote(str(v.get(m.group(1), '')), safe=''), modelo)


def checar_links(d):
    ex = d['links']['exemplo']
    tarefas = []
    for cat in d['links']['categorias']:
        for it in cat['itens']:
            tarefas.append(('Links de busca · ' + cat['nome'], it['nome'], preencher(it['modelo'], ex), None))
    r = d['links']['rota']
    tarefas.append(('Links de busca · Rotas', r['nome'], preencher(r['modelo'], ex), None))
    for x in d['destaques']:
        if x.get('civitatis'):
            tarefas.append(('Civitatis por destino', x['nome'], f'https://www.civitatis.com/br/{x["civitatis"]}/', '/' + x['civitatis']))
    for o in d.get('fontes', {}).get('oficiais', []):
        tarefas.append(('Fontes oficiais', o['nome'], o['url'], None))
    for fd in d.get('fontes', {}).get('dados', []):
        if fd.get('url'):
            tarefas.append(('Sites das fontes de dados', fd['nome'], fd['url'], None))
    tarefas.append(('Imagens', 'Bandeiras (flagcdn)', 'https://flagcdn.com/w40/br.png', None))
    with cf.ThreadPoolExecutor(8) as pool:
        list(pool.map(lambda t: checar_link(*t), tarefas))


def checar_wiki(d):
    grupo = 'Wikipédia (fotos dos destinos)'
    titulos = [x['wiki'] for x in d['destaques'] if x.get('wiki')]
    faltando, sem_foto = [], []
    for i in range(0, len(titulos), 40):
        lote = titulos[i:i + 40]
        url = ('https://pt.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=320'
               '&redirects=1&format=json&formatversion=2&titles=' + urllib.parse.quote('|'.join(t.replace('_', ' ') for t in lote)))
        res = requisitar(url)
        if res['status'] != 200:
            return registrar(grupo, 'API de imagens', AVISO if res['status'] == 429 else FALHA, descrever(res))
        q = json.loads(texto(res)).get('query', {})
        for p in q.get('pages', []):
            if p.get('missing'):
                faltando.append(p.get('title'))
            elif not p.get('thumbnail'):
                sem_foto.append(p.get('title'))
    if faltando:
        registrar(grupo, 'títulos', FALHA, 'páginas inexistentes: ' + ', '.join(faltando))
    else:
        registrar(grupo, 'títulos', OK, f'{len(titulos)} páginas existem')
    if sem_foto:
        registrar(grupo, 'fotos', AVISO, 'sem foto principal (o cartão fica sem imagem): ' + ', '.join(sem_foto))
    else:
        registrar(grupo, 'fotos', OK, 'todas têm foto principal')


def checar_github():
    url = 'https://api.github.com/repos/guilhermeromio-netto-prog/farol-hub/actions/workflows/checks.yml/runs?per_page=1'
    res = requisitar(url, cabecalhos={'Accept': 'application/vnd.github+json', 'Origin': ORIGEM_SITE}, tentativas=1)
    if res['status'] == 200:
        registrar('APIs', 'GitHub · última verificação', OK if cors_ok(res) else FALHA, 'HTTP 200' + ('' if cors_ok(res) else ' sem CORS'))
    else:
        motivo = ('workflow checks.yml ainda não existe' if res['status'] == 404 else
                  'limite da API sem token (60/h por IP)' if res['status'] in (403, 429) else 'indisponível')
        registrar('APIs', 'GitHub · última verificação', AVISO, f'{descrever(res)} — {motivo}')


# ---------------------------------------------------------------- relatório
def relatorio(inicio, base):
    try:
        from zoneinfo import ZoneInfo
        agora = dt.datetime.now(ZoneInfo('America/Sao_Paulo'))
    except Exception:
        agora = dt.datetime.now(dt.timezone(dt.timedelta(hours=-3)))
    cont = {OK: 0, AVISO: 0, FALHA: 0}
    linhas = [f'Farol · verificação de garantias — {agora:%d/%m/%Y %H:%M} (horário de Brasília)',
              f'Arquivos: {"publicados em " + base if base else "repositório local"}', '']
    md = [f'## Farol · verificação de garantias', f'{agora:%d/%m/%Y %H:%M} (horário de Brasília)', '']
    grupos = []
    for g, *_ in resultados:
        if g not in grupos:
            grupos.append(g)
    for g in grupos:
        itens = [r for r in resultados if r[0] == g]
        linhas.append(f'■ {g}')
        md += [f'### {g}', '', '| Estado | Item | Detalhe |', '|---|---|---|']
        for _, nome, est, det in sorted(itens, key=lambda r: ({FALHA: 0, AVISO: 1, OK: 2}[r[2]], r[1])):
            cont[est] += 1
            linhas.append(f'  {SIMBOLO[est]} {nome}' + (f' — {det}' if det else ''))
            md.append(f'| {SIMBOLO[est].strip()} | {nome} | {det.replace("|", "/")} |')
        linhas.append('')
        md.append('')
    resumo = f'Resumo: {cont[OK]} ok · {cont[AVISO]} aviso(s) · {cont[FALHA]} falha(s) · {time.time() - inicio:.0f}s'
    linhas.append(resumo)
    linhas.append('Resultado: ' + ('REPROVADO — corrija as falhas acima.' if cont[FALHA] else 'APROVADO.'))
    print('\n'.join(linhas))
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as fh:
            fh.write('\n'.join(md + [f'**{resumo}**', '']))
    return cont[FALHA]


def main():
    ap = argparse.ArgumentParser(description='Verifica links, APIs e arquivos do Farol.')
    ap.add_argument('--base', help='URL publicada para conferir os arquivos (ex.: a do GitHub Pages)')
    ap.add_argument('--so-internos', action='store_true', help='não acessa serviços externos')
    a = ap.parse_args()
    base = a.base.rstrip('/') + '/' if a.base else None
    inicio = time.time()
    try:
        dados_txt = open(os.path.join(RAIZ, 'dados.json'), encoding='utf-8').read()
        d = json.loads(dados_txt)
    except Exception as e:
        print(f'✖ FALHA  dados.json ilegível: {e}')
        return 1
    arquivos_internos(dados_txt, base)
    coerencia_dados(d)
    if not a.so_internos:
        checar_apis(d)
        checar_github()
        checar_feeds(d)
        checar_wiki(d)
        checar_links(d)
    return 1 if relatorio(inicio, base) else 0


if __name__ == '__main__':
    sys.exit(main())
