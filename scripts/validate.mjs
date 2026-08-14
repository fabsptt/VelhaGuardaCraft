import fs from 'node:fs/promises';

const recipes = JSON.parse(await fs.readFile('data/recipes.json', 'utf8'));
const errors = [];
const ids = new Set();

for (const r of recipes) {
  if (!r.uniqueName) errors.push('Receita sem uniqueName');
  if (ids.has(r.uniqueName)) errors.push(`Receita duplicada: ${r.uniqueName}`);
  ids.add(r.uniqueName);

  if (!r.ingredients?.length) errors.push(`Sem ingredientes: ${r.uniqueName}`);

  for (const m of r.ingredients || []) {
    if (!m.uniqueName || !(m.count > 0)) {
      errors.push(`Ingrediente inválido: ${r.uniqueName}`);
    }
  }

  if (r.enchantment > 0 && !/_LEVEL[1-4]$/i.test(r.uniqueName)) {
    errors.push(`Enchant inválido: ${r.uniqueName}`);
  }
}

console.log(`Receitas ${recipes.length}; encantadas ${recipes.filter(x => x.enchantment > 0).length}; erros ${errors.length}`);

if (errors.length) {
  console.error(errors.slice(0, 100).join('\n'));
  process.exit(1);
}
