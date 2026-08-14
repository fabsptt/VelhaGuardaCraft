# Velha Guarda — Crafting & Mercado Europe

Site estático para GitHub Pages. A base de receitas é sincronizada pelo GitHub Actions a partir do `ao-bin-dumps` e os preços são consultados no Albion Online Data Project — servidor Europe.

## Como publicar
1. Cria um repositório no GitHub.
2. Envia todos estes ficheiros para a raiz.
3. Vai a **Actions → Sincronizar Albion Europe → Run workflow**.
4. Depois de terminar, ativa **Settings → Pages → Deploy from branch → main / root**.
5. O site passa a calcular as oportunidades com os dados gerados em `data/`.

## O que esta versão corrige
- receitas base e encantadas `.1`–`.4`;
- parsing de atributos XML-converted como `@uniquename` e `@count`;
- validação automática para impedir receitas sem ingredientes;
- todas as cidades Europe principais;
- RRR pela fórmula `1 - 1/(1 + ProductionBonus/100)`;
- bónus de cidade + especialização + Focus;
- comparação entre cidade de craft e cidade de venda;
- preço e data da última observação;
- consultas de mercado em lotes para respeitar o limite de URL da API.

## Fontes
- Albion Online Data Project: https://europe.albion-online-data.com/ e https://pow.albion-online-data.com/api
- Albion Online Wiki — Local Production Bonus / Resource Return Rate
- ao-bin-dumps: https://github.com/ao-data/ao-bin-dumps
