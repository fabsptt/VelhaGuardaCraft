import fs from 'node:fs/promises';
const r=JSON.parse(await fs.readFile('data/recipes.json','utf8'));const ids=new Set(r.map(x=>x.uniqueName));const e=[];
for(const x of r){if(!x.uniqueName||!x.ingredients?.length)e.push(`Sem ingredientes: ${x.uniqueName}`);for(const m of x.ingredients||[])if(!m.uniqueName||!(m.count>0))e.push(`Ingrediente inválido: ${x.uniqueName}`);if(x.enchantment>0&&!/_LEVEL[1-4]$/i.test(x.uniqueName))e.push(`Enchant inválido: ${x.uniqueName}`)}
console.log(`Receitas ${r.length}; encantadas ${r.filter(x=>x.enchantment>0).length}; erros ${e.length}`);if(e.length){console.error(e.slice(0,100).join('\n'));process.exit(1)}
