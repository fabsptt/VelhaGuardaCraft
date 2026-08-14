# Velha Guarda — Crafting & Mercado

Site para a guilda **Velha Guarda**, Albion Online Europe.

## Arquitectura

- `index.html` — interface
- `style.css` — visual
- `app.js` — cálculo e consulta de preços
- `data/items.json` — catálogo gerado
- `data/recipes.json` — receitas geradas
- `city-bonuses.json` — configuração dos bónus de cidade
- `scripts/sync-data.mjs` — sincronização dos dados do jogo
- `.github/workflows/sync.yml` — actualização automática

## Fonte das receitas

As receitas não são escritas manualmente. O sincronizador descarrega o `formatted/items.json` do repositório `ao-data/ao-bin-dumps` e extrai apenas os itens que possuem `craftingRequirements`.

Isto evita a estratégia antiga de manter uma lista manual que acaba por perder armas, luvas, cajados, lanças, consumíveis ou itens novos.

## Fonte dos preços

Os preços são consultados no Albion Online Data Project usando o host Europe:

`https://europe.albion-online-data.com`

O projecto disponibiliza preços actuais e históricos. Os dados são observados pelos clientes que abrem os mercados no jogo, portanto um preço pode estar sem observações recentes.

## GitHub Pages

1. Cria um repositório público.
2. Envia todos os ficheiros deste projecto.
3. Em **Settings → Pages**, escolhe **GitHub Actions**.
4. O workflow `sync.yml` pode ser executado manualmente e depois a cada 6 horas.
5. O site é estático e pode ser servido pelo GitHub Pages.

### Importante

A primeira execução de `npm run sync` pode alterar bastante os dois ficheiros em `data/`, porque a base é grande. Não apagues receitas manualmente.

## Modelo de cálculo

Para o crafting, o site calcula:

- cidade com especialidade
- Resource Return Rate (RRR)
- custo dos materiais
- custo efectivo após retorno
- taxa da estação configurável
- imposto de mercado configurável
- cidade com melhor preço de venda
- lucro
- ROI

A fórmula usada para o RRR é:

`RRR = ProductionBonus / (100 + ProductionBonus)`

O Focus acrescenta `+59` ao Production Bonus configurado.

Os bónus das cidades estão separados em `city-bonuses.json` para poderem ser actualizados sem mexer no motor de cálculo.
