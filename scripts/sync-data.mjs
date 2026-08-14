import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const SOURCE = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json';

const str = (v) => v == null ? '' : String(v);
const arr = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);

function attr(o, ...keys) {
  if (!o || typeof o !== 'object') return undefined;
  for (const k of keys) {
    if (k in o) return o[k];
    if (`@${k}` in o) return o[`@${k}`];
  }
  return undefined;
}

function id(o) {
  return str(attr(o, 'uniqueName', 'UniqueName', 'uniquename', 'id', 'Id', 'index', 'Index'));
}

function displayName(o) {
  const v = attr(o, 'localizedNames', 'LocalizedNames', 'name', 'Name', 'displayName', 'DisplayName');
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    return v['EN-US'] || v['en-US'] || v.EN || Object.values(v)[0] || '';
  }
  return '';
}

function tierFrom(uid, o) {
  const t = attr(o, 'tier', 'Tier');
  if (t != null && t !== '') return Number(t) || null;
  return Number((uid.match(/^T([1-8])(?:_|$)/i) || [])[1] || 0) || null;
}

function walk(v, out = []) {
  if (Array.isArray(v)) {
    for (const x of v) walk(x, out);
    return out;
  }
  if (!v || typeof v !== 'object') return out;
  out.push(v);
  for (const x of Object.values(v)) walk(x, out);
  return out;
}

function resourcesFrom(requirement) {
  const resourceNode = attr(
    requirement,
    'craftresource',
    'CraftResource',
    'craftResource',
    'resources',
    'Resources'
  );

  return arr(resourceNode)
    .map(r => ({
      uniqueName: str(attr(r, 'uniquename', 'uniqueName', 'UniqueName', 'itemname', 'itemName', 'id', 'Id')),
      count: Number(attr(r, 'count', 'Count', 'amount', 'Amount', 'itemamount', 'itemAmount') || 0) || 0,
      maxReturnAmount: Number(attr(r, 'maxreturnamount', 'maxReturnAmount', 'MaxReturnAmount') || 0) || 0,
      enchantmentLevel: Number(attr(r, 'enchantmentlevel', 'enchantmentLevel', 'EnchantmentLevel') || 0) || 0
    }))
    .filter(r => r.uniqueName && r.count > 0);
}

function requirementToRecipe(item, requirement, enchantment) {
  const baseUniqueName = id(item);
  if (!baseUniqueName || !requirement) return null;

  const ingredients = resourcesFrom(requirement);
  if (!ingredients.length) return null;

  const uid = enchantment > 0
    ? `${baseUniqueName}_LEVEL${enchantment}`
    : baseUniqueName;

  return {
    uniqueName: uid,
    baseUniqueName,
    name: displayName(item) || baseUniqueName,
    category: str(attr(item, 'shopCategory', 'ShopCategory', 'category', 'Category')),
    subcategory: str(attr(
      item,
      'shopSubCategory',
      'ShopSubCategory',
      'shopSubcategory',
      'ShopSubcategory',
      'subcategory',
      'Subcategory'
    )),
    tier: tierFrom(baseUniqueName, item),
    enchantment,
    outputCount: Number(
      attr(
        requirement,
        'amountcrafted',
        'amountCrafted',
        'AmountCrafted',
        'craftingOutputCount',
        'CraftingOutputCount',
        'outputCount',
        'OutputCount'
      ) ||
      attr(item, 'amountcrafted', 'amountCrafted', 'craftingOutputCount', 'CraftingOutputCount', 'outputCount', 'OutputCount') ||
      1
    ) || 1,
    ingredients,
    craftingSilver: Number(attr(requirement, 'silver', 'Silver') || 0) || 0,
    craftingFocus: Number(attr(requirement, 'craftingfocus', 'craftingFocus', 'CraftingFocus') || 0) || 0,
    craftingTime: Number(attr(requirement, 'time', 'Time') || 0) || 0,
    source: 'ao-bin-dumps/formatted/items.json',
    validated: true
  };
}

const res = await fetch(SOURCE, {
  headers: { 'user-agent': 'VelhaGuardaCraft/2.1' }
});
if (!res.ok) throw new Error(`HTTP ${res.status} ao descarregar ${SOURCE}`);

const raw = await res.json();
const nodes = walk(raw);

const items = {};
const recipes = [];
const seen = new Set();

for (const item of nodes) {
  const uid = id(item);
  if (!uid) continue;

  // Keep the item catalogue.
  if (!items[uid]) {
    items[uid] = {
      name: displayName(item),
      category: str(attr(item, 'shopCategory', 'ShopCategory', 'category', 'Category')),
      subcategory: str(attr(
        item,
        'shopSubCategory',
        'ShopSubCategory',
        'shopSubcategory',
        'ShopSubcategory',
        'subcategory',
        'Subcategory'
      )),
      tier: tierFrom(uid, item)
    };
  }

  // IMPORTANT:
  // craftingrequirements can be an object OR an array.
  // craftresource can also be an object OR an array.
  // This is the part the previous synchronizer was skipping.
  const requirements = arr(attr(
    item,
    'craftingrequirements',
    'CraftingRequirements',
    'craftingRequirements'
  ));

  for (const requirement of requirements) {
    const recipe = requirementToRecipe(item, requirement, 0);
    if (recipe && !seen.has(recipe.uniqueName)) {
      seen.add(recipe.uniqueName);
      recipes.push(recipe);
    }
  }

  const enchantmentsNode = attr(item, 'enchantments', 'Enchantments');
  const enchantments = enchantmentsNode
    ? arr(attr(enchantmentsNode, 'enchantment', 'Enchantment'))
    : [];

  for (const enchantment of enchantments) {
    const level = Number(attr(
      enchantment,
      'enchantmentlevel',
      'enchantmentLevel',
      'EnchantmentLevel',
      'level',
      'Level'
    ) || 0) || 0;

    if (!level) continue;

    const enchantRequirements = arr(attr(
      enchantment,
      'craftingrequirements',
      'CraftingRequirements',
      'craftingRequirements'
    ));

    for (const requirement of enchantRequirements) {
      const recipe = requirementToRecipe(item, requirement, level);
      if (recipe && !seen.has(recipe.uniqueName)) {
        seen.add(recipe.uniqueName);
        recipes.push(recipe);
      }
    }
  }
}

recipes.sort((a, b) => a.uniqueName.localeCompare(b.uniqueName));

await fs.mkdir(path.join(root, 'data'), { recursive: true });

await fs.writeFile(
  path.join(root, 'data/items.json'),
  JSON.stringify(items, null, 2)
);

await fs.writeFile(
  path.join(root, 'data/recipes.json'),
  JSON.stringify(recipes, null, 2)
);

const report = {
  source: SOURCE,
  itemNodes: nodes.length,
  uniqueItems: Object.keys(items).length,
  recipes: recipes.length,
  enchantedRecipes: recipes.filter(x => x.enchantment > 0).length,
  generatedAt: new Date().toISOString()
};

await fs.writeFile(
  path.join(root, 'data/sync-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(report);

// Safety guard: never publish an empty/incomplete recipe database.
if (recipes.length < 100) {
  throw new Error(
    `Foram encontradas apenas ${recipes.length} receitas. ` +
    `A sincronização foi interrompida para não publicar uma base incompleta.`
  );
}
