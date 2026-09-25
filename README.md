# Farol — hub de viagem personalizado

O **Farol** é um hub de viagem em português do Brasil, pensado para quem quer **saber tudo antes de ir**: custos, controle e um lugar para guardar o plano. Tem painel ao vivo do destino (clima, previsão, qualidade do ar, câmbio, feriados, foto e resumo da Wikipédia, pontos turísticos do OpenStreetMap), faixas de preço **estimadas** com atalhos verificados para os sites de reserva, notícias por RSS, um planejador que transforma um briefing em um *caderno de bordo* e um **controle de gastos** por viagem.

**HTML, CSS e JavaScript puros** (módulos ES): sem framework, sem npm, sem build, sem backend. Publicado no GitHub Pages.

**Site:** https://guilhermeromio-netto-prog.github.io/farol-hub/ · **Status ao vivo:** [#/status](https://guilhermeromio-netto-prog.github.io/farol-hub/#/status)

## Páginas (rotas por hash)

| Rota | O que tem |
|---|---|
| `#/` Início | Busca de destinos, contagem regressiva da próxima viagem, **Em alta** (buscas na Wikipédia em português), 32 destinos com foto real, atalhos e notícias. |
| `#/destino/<slug>` ou `#/destino/<lat>,<lon>` | Foto e resumo da Wikipédia, tempo agora, previsão de 16 dias, melhor época, qualidade do ar, país, câmbio, feriados, **O que ver por perto** (OpenStreetMap), **Preços e reservas** (abas Passagens, Hospedagem, Aluguel de carro, Passeios, Seguro viagem), **Dicas de especialista** e compartilhar no WhatsApp. |
| `#/planejar` | Briefing (destino, origem, meio, interesses, texto livre, dias, viajantes, ritmo, orçamento, mês). Aceita `?b=<código>` para refazer um caderno compartilhado. |
| `#/caderno/<id>` | Roteiro sugerido em 3 opções, clima do mês, custos, tempo e logística, checklist, datas da viagem, abas **Preços** e **Gastos**, botões WhatsApp / Compartilhar / Copiar link. |
| `#/precos` | Hub de preços com origem, destino, datas e adultos (códigos IATA preenchidos automaticamente), tabela por região, fontes oficiais e dicas. |
| `#/gastos` | **Minhas viagens**: total planejado e gasto, próximas viagens, nova viagem, conversor de moedas, backup (JSON) e exportação (CSV). |
| `#/gastos/<id>` | Orçamento por categoria, gastos reais (data, categoria, descrição, valor, pago/pendente, moeda estrangeira convertida), barras planejado × gasto, saldo por dia. |
| `#/cadernos` | Cadernos salvos no aparelho. |
| `#/noticias` | Notícias de 4 fontes em português. |
| `#/status` | Teste ao vivo de cada API e feed a partir do seu navegador, última execução da verificação automática e a tabela de fontes. |

## Garantias automáticas

- **`tools/check.py`** (só biblioteca padrão do Python) confere arquivos internos (todos os módulos importados, CSS, fontes), a coerência do `dados.json` (IATA, faixas de preço, marcadores dos links), cada API (status HTTP, cabeçalho CORS, formato), cada feed RSS (precisa ter itens) e o rss2json, cada modelo de link preenchido com um exemplo, a página Civitatis de cada destino, os títulos da Wikipédia e as fontes oficiais. Relatório em português; sai com código 1 se houver **falha**. Limite de requisições (429), captcha ou bloqueio a robôs viram **aviso** (o site trata esses casos).
- **`.github/workflows/checks.yml`** roda o verificador a cada push na `main`, manualmente e todo dia às 06:17 (horário de Brasília). O resumo aparece na página da execução no GitHub Actions.
- **`#/status`** mostra, no seu navegador, OK / limitado / falha para cada serviço, com horário e tempo de resposta.

```bash
python3 tools/check.py                    # arquivos locais + serviços externos
python3 tools/check.py --base https://guilhermeromio-netto-prog.github.io/farol-hub/   # confere também o que está publicado
python3 tools/check.py --so-internos      # sem rede
```

## Fontes e confiabilidade

| Fonte | O que fornece | Tempo real ou estimativa? |
|---|---|---|
| [Open-Meteo](https://open-meteo.com/) | Previsão de 16 dias, tempo agora, qualidade do ar, clima do último ano e busca de lugares | Tempo real (previsão atualizada a cada hora) e histórico medido |
| [Frankfurter (Banco Central Europeu)](https://frankfurter.dev/) | Câmbio de referência para reais | Diário (dias úteis); taxa comercial, sem spread nem IOF |
| [Nager.Date](https://date.nager.at/) | Feriados nacionais por país | Calendário oficial compilado (não cobre feriados regionais) |
| [OpenStreetMap (Overpass API)](https://www.openstreetmap.org/) | Pontos turísticos perto do destino | Dados colaborativos atualizados continuamente |
| [Wikipédia em português](https://pt.wikipedia.org/) | Resumo e fotos dos destinos | Conteúdo colaborativo (CC BY-SA) |
| [Wikimedia Pageviews](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/) | Seção “Em alta” (visualizações das páginas na Wikipédia em português) | Diário; indica interesse, não reservas nem vendas |
| [BigDataCloud](https://www.bigdatacloud.com/) | Nome do lugar a partir de coordenadas | Tempo real |
| [Feeds RSS (Melhores Destinos, Passageiro de Primeira, g1, Viagem e Turismo) + rss2json](https://rss2json.com/) | Notícias de viagem | Tempo real (conforme publicação de cada site) |
| [Tabela de países (mledoze/countries, ODbL)](https://github.com/mledoze/countries) | Moeda, idiomas e DDI | Estático, incluído no site |
| [Farol (dados.json)]() | Faixas de preço, custos do planejador, dicas por tipo de destino, checklist | Estimativa editorial com data de atualização — não é cotação |
| [Sites de busca (Google Voos, Kayak, Booking, Airbnb, GetYourGuide, Civitatis, Viator e outros)]() | Preço real, ao abrir o link | Tempo real, no site parceiro; o Farol não vê nem guarda preços |
| `dados.json` (Farol) | Faixas de preço por região (passagem, hospedagem, carro, passeio, seguro), dicas por tipo de destino, tabela IATA | **Estimativa** para viajante de classe média (econômico/médio), atualizada em 25/09/2026. **Não é cotação.** |

### Links de reserva (verificados em 25/09/2026)

| Categoria | Site | Como abre |
|---|---|---|
| Passagens | Google Voos | busca pré-preenchida (Origem, destino e datas) |
| Passagens | Kayak | busca pré-preenchida (Aeroportos, datas e adultos) |
| Hospedagem | Booking.com | busca pré-preenchida (Destino, datas, adultos e quartos) |
| Hospedagem | Airbnb | busca pré-preenchida (Destino, datas e adultos) |
| Aluguel de carro | Kayak Carros | busca pré-preenchida (Cidade de retirada e datas) |
| Aluguel de carro | Rentcars | só a página inicial (sem pré-preenchimento) |
| Aluguel de carro | Localiza | só a página inicial (sem pré-preenchimento) · só destinos no Brasil |
| Aluguel de carro | Movida | só a página inicial (sem pré-preenchimento) · só destinos no Brasil |
| Passeios | GetYourGuide | busca pré-preenchida (Busca pelo destino) |
| Passeios | Civitatis | busca pré-preenchida (Página do destino) |
| Passeios | Viator | busca pré-preenchida (Busca pelo destino) |
| Seguro viagem | Seguros Promo (comparador) | só a página inicial (sem pré-preenchimento) |
| Rotas | Google Maps | rota de carro com origem e destino (coordenadas) |

Ficaram de fora por não ser possível verificar o formato do link: Skyscanner e Hoteis.com (captcha), Decolar (bloqueio 403), Trivago (a busca cai numa página genérica) e a busca geral da Civitatis (volta para a página inicial). O Viator confirma o formato (redireciona para a página do destino), mas bloqueia robôs na página final. O Booking.com às vezes responde com desafio anti-robô ao verificador; no navegador abre normalmente.

## Como o roteiro é montado

Não há IA nem servidor: o **roteiro sugerido** é montado no navegador, por regras (`js/planner.js`), com clima real do último ano (Open-Meteo), feriados (Nager.Date) e faixas de custo do `dados.json`. Toda a geração passa por uma única função, `gerarRoteiro()` em `js/gerador.js`: um futuro `js/ia.js` pode substituí-la por uma chamada de API sem mexer nas telas.

## Seus dados

Cadernos, viagens, gastos e tema ficam só no `localStorage` do aparelho. Em **Gastos** há **Exportar backup (JSON)**, **Importar backup** (com validação do formato e confirmação antes de substituir) e **Exportar gastos (CSV)** (separador `;` e vírgula decimal, abre direto no Excel/Planilhas em português). Links de compartilhamento levam só o briefing codificado na URL, nunca seus gastos.

## Rodar localmente

```bash
cd farol-hub
python3 -m http.server 8000
# abra http://localhost:8000
```

## Estrutura

```
index.html                 casca, navegação (topo no desktop; barra inferior + “Mais” no celular), ícones SVG
css/estilo.css             estilos; tokens de design (tema escuro e claro) em :root
fonts/                     Manrope e Fraunces (woff2, auto-hospedadas, font-display: swap)
js/app.js                  roteador por hash, tema, menu Mais
js/api.js                  APIs, cache, 429/timeout e mensagens em PT-BR
js/gerador.js              fronteira do gerador de roteiro (trocável por js/ia.js)
js/planner.js              roteiro por regras
js/links.js                links de reserva pré-preenchidos
js/share.js                WhatsApp, Web Share e códigos ?b=
js/pontos.js               pontos turísticos (OpenStreetMap)
js/store.js                localStorage: cadernos, viagens, gastos, backup, CSV
js/views/*.js              uma tela por arquivo
dados.json                 destinos, aeroportos, preços estimados, dicas, links, APIs, fontes
tools/check.py             verificador de garantias
.github/workflows/         pages.yml (deploy) e checks.yml (verificação)
```

## Acessibilidade e experiência

`lang="pt-BR"`, “Pular para o conteúdo”, landmarks, rótulos em todos os campos, foco visível, abas com setas/Home/End, menu Mais com Esc e setas, diálogo nativo de confirmação, contraste AA nos temas escuro e claro (conferido por script), `prefers-reduced-motion`, sem rolagem horizontal a partir de 360 px.

## Limitações

- Preços são **estimativas**; o preço real está nos sites de reserva.
- “Em alta” mede visualizações na Wikipédia em português (interesse), não vendas. A API da Wikimedia limita requisições; o app guarda cache de 12 h e mostra resultado parcial quando é limitado.
- O Overpass (OpenStreetMap) às vezes demora ou cai; há servidor reserva e mensagem honesta de erro.
- Roteiros sugerem tipos de lugar e atividade, não estabelecimentos.
- Dados ficam só no aparelho (sem conta nem sincronização); use o backup.

---

Feito por **byGui**.
