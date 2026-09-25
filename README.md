# Farol — hub de viagem personalizado

O **Farol** é um hub de viagem em português do Brasil: busca de destinos com painel ao vivo (clima, previsão, qualidade do ar, câmbio em reais, feriados, resumo da Wikipédia), faixas de preço estimadas com atalhos para os sites de reserva, notícias de viagem por RSS e um **planejador** que transforma um briefing em um *caderno de bordo* com três roteiros.

É a versão estática e modernizada do planejador Farol original: **HTML, CSS e JavaScript puros** (módulos ES), sem framework, sem npm, sem etapa de build e sem backend. Publicado no GitHub Pages.

**Site:** https://guilhermeromio-netto-prog.github.io/farol-hub/

## Páginas (rotas por hash)

| Rota | O que tem |
|---|---|
| `#/` Início | Busca de destinos (geocodificação Open-Meteo em português), destinos em destaque, atalhos e últimas notícias. |
| `#/destino/<slug>` ou `#/destino/<lat>,<lon>` | Painel do destino: tempo agora, previsão de 16 dias, nascer/pôr do sol, hora local e fuso, “melhor época e condições” (derivada da previsão e do clima registrado no último ano), qualidade do ar, país (moeda, idiomas, DDI), câmbio para BRL, feriados nacionais dos próximos 6 meses e resumo da Wikipédia. Botões **Planejar viagem para cá** e **Ver preços**. |
| `#/planejar` | Briefing do Farol original: destino, origem, meio (motorhome / avião / carro), interesses, texto livre (até 800 caracteres), dias, viajantes, ritmo, orçamento em reais e mês. Gera um caderno com as opções **Econômico, Equilibrado e Conforto**. |
| `#/caderno/<id>` | O caderno: dia a dia de cada opção, clima do mês (dados reais), estimativa de custos detalhada, tempo e logística, checklist com progresso salvo. |
| `#/precos` | Faixas estimadas por região e por destino em destaque, links preenchidos para Google Voos, Skyscanner, Booking.com, Airbnb e rota no Google Maps, fontes oficiais de visto, passaporte e saúde, dicas de especialista. |
| `#/cadernos` | Cadernos salvos no aparelho (até 20), com abrir e apagar (com confirmação). Apagar remove também o progresso do checklist. |
| `#/noticias` | Notícias de viagem de 4 fontes em português, com filtro por fonte. |

## Como o planejador funciona

Nada de IA nem servidor: o caderno é montado **no navegador, por regras**.

1. Localiza destino e origem (destinos em destaque do `dados.json` ou geocodificação Open-Meteo). Sem origem, assume São Paulo e avisa.
2. Busca o **clima registrado no último ano completo** (arquivo histórico Open-Meteo) e a previsão de 16 dias. Com mês “flexível”, usa o mês mais agradável como referência.
3. Busca os **feriados nacionais** do mês da viagem (Nager.Date).
4. Calcula distância (linha reta × 1,25 para estrada), dias de volante, e monta os três roteiros com os modelos de atividade por interesse do `dados.json`.
5. Estima custos com as faixas por região do `dados.json` — sempre rotuladas como **estimativa**.
6. Gera o checklist por meio de transporte (+ itens internacionais e de clima).

Se um dado real não vier (API fora do ar, destino não encontrado), o caderno diz isso — nada é inventado.

## APIs e fontes (todas sem chave, com CORS liberado)

- [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) — busca de lugares (`language=pt`)
- [Open-Meteo Forecast](https://open-meteo.com/en/docs) — tempo atual, previsão de 16 dias, nascer/pôr do sol, fuso
- [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) — índice europeu, PM2,5, PM10, UV
- [Open-Meteo Historical Weather](https://open-meteo.com/en/docs/historical-weather-api) — clima registrado no último ano (melhor época)
- [Frankfurter](https://frankfurter.dev/) — câmbio de referência do Banco Central Europeu para BRL (`api.frankfurter.dev/v1`; o antigo `api.frankfurter.app` redireciona para lá). Moedas fora da lista do BCE mostram um aviso claro.
- [Nager.Date](https://date.nager.at/) — feriados nacionais (países não cobertos mostram aviso)
- [Wikipédia em português — REST API](https://pt.wikipedia.org/api/rest_v1/) — resumo do lugar
- [BigDataCloud reverse geocode (client)](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api) — nome e país quando o destino chega só por coordenadas
- [flagcdn.com](https://flagcdn.com/) — imagens de bandeiras
- Notícias (RSS): [Melhores Destinos](https://www.melhoresdestinos.com.br/), [Passageiro de Primeira](https://passageirodeprimeira.com/), [g1 Turismo e Viagem](https://g1.globo.com/turismo-e-viagem/), [Viagem e Turismo](https://viagemeturismo.abril.com.br/) — lidas via [rss2json.com](https://rss2json.com/) (o Passageiro de Primeira é lido direto, pois libera CORS; o conversor é plano B)

**Sobre REST Countries:** a API `restcountries.com/v3.1` foi desativada e a v5 exige chave. Por isso moeda, idiomas e DDI vêm de uma tabela embutida no `dados.json`, derivada do projeto [mledoze/countries](https://github.com/mledoze/countries) (licença ODbL), com nomes em português gerados pelo `Intl` do navegador.

Todas as respostas ficam em cache curto no `sessionStorage` (10 min a 24 h, conforme a fonte).

## Custos: são estimativas

As faixas do `dados.json` são **estimativas gerais em reais para 2026**, baseadas em conhecimento geral de mercado, **não cotações**. A interface sempre avisa “Faixas estimadas — confira o preço real” e oferece links para os sites de reserva.

Regras de visto e entrada **não** são informadas pelo app: ele aponta para as fontes oficiais (Portal Consular do Itamaraty, Polícia Federal, Anvisa/gov.br, Ministério da Saúde, ANAC).

## Rodar localmente

Qualquer servidor estático serve (os módulos ES não funcionam abrindo o arquivo direto com `file://`):

```bash
cd farol-hub
python3 -m http.server 8000
# abra http://localhost:8000
```

## Estrutura

```
index.html            casca da página, navegação, rodapé, ícones SVG
css/estilo.css        estilos; tokens de design em :root
js/app.js             roteador por hash + View Transitions
js/api.js             chamadas às APIs, cache e mensagens de erro em PT-BR
js/planner.js         gerador do caderno (regras + clima real)
js/clima.js           interpretação de clima, melhor época, mala
js/store.js           localStorage (cadernos e checklist)
js/ui.js              utilidades, toasts, skeletons, diálogo
js/views/*.js         uma tela por arquivo
dados.json            destaques, atividades, custos, checklists, fontes, feeds, países
.github/workflows/pages.yml   deploy no GitHub Pages
```

## Acessibilidade e experiência

`lang="pt-BR"`, link “Pular para o conteúdo”, landmarks semânticos, rótulos em todos os campos, foco visível (`:focus-visible`), abas com setas/Home/End, confirmação de exclusão em diálogo nativo, contraste AA no tema escuro, `prefers-reduced-motion` respeitado, navegação no topo (desktop) e barra inferior fixa (celular), skeletons durante carregamentos e toasts para avisos.

## Limitações

- Roteiros são gerados por regras: sugerem **tipos** de lugar e atividade, não estabelecimentos específicos.
- “Melhor época” usa um único ano de registro, não uma média climatológica de 30 anos.
- Distâncias são estimadas em linha reta (× 1,25 para estrada); use o link do Google Maps para a rota real.
- Temporada alta/baixa é uma tendência geral; os feriados são dados reais.
- O leitor de RSS depende do serviço gratuito rss2json.com (limite diário); se ele cair, a página mostra erro honesto.
- Cadernos ficam só no navegador do aparelho (sem conta, sem sincronização).

---

Feito por **byGui**.
