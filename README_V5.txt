VELHA GUARDA CRAFT V5

Substituir no GitHub:
1. app.js
2. style.css

Não apagar nem substituir:
- data/recipes.json
- data/items.json
- data/city-bonuses.json

O V5 acrescenta:
- imagens dos itens através do Render Service do Albion;
- imagens dos materiais na receita;
- preços Europe em batches pequenos;
- 3 consultas simultâneas para não saturar a API;
- 3 tentativas por batch;
- resultados apresentados progressivamente;
- fallback de qualidade apenas quando a qualidade escolhida não tem preço;
- filtros e cálculo de custo/lucro/ROI;
- nenhum item ou receita é apagado quando não há preço.

IMPORTANTE:
A API do Albion Data Project só tem dados de mercado que foram recolhidos.
Se um item/cidade não tiver dados, o site mostra "Sem preço" em vez de inventar um valor.

Depois do commit:
- abrir o site
- Ctrl+F5
- pesquisar Sword
- carregar ATUALIZAR PREÇOS
