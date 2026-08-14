# Velha Guarda Crafting — GitHub

## IMPORTANTE
Este ZIP já contém a pasta `scripts/`.

A estrutura correta do repositório é:

- `index.html`
- `app.js`
- `style.css`
- `package.json`
- `scripts/sync-data.mjs`
- `scripts/validate.mjs`
- `data/`
- `.github/workflows/sync.yml`

O erro anterior aconteceu porque o GitHub tinha o workflow e o `package.json`, mas não tinha `scripts/sync-data.mjs`.

### Se fizer upload pelo GitHub
Não entre na pasta `velha_guarda_crafting_final` antes de enviar.
O conteúdo deste ZIP está preparado para ficar diretamente na raiz do repositório.

### Workflow
O GitHub Actions executa:

1. `npm run sync`
2. `npm run validate`
3. grava `data/items.json`, `data/recipes.json` e `data/sync-report.json`

Depois disso, o site usa os dados gerados.
