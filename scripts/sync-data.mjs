import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const ITEMS_SOURCE = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json';
const API_BASE = 'https://gameinfo-ams.albiononline.com/api/gameinfo/items';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
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
  if (v && typeof v === 'object') return v['EN-US'] || v['en-US'] || v.EN || Object.values(v)[0] || '';
  return '';
}

function tierFrom(uid, o) {
  const t = attr(o, 'tier', 'Tier');
  if (t != null && t !== '') return Number(t) || null;
  return Number((uid.match(/^T([1-8])(?:_|$)/i) || [])[1] || 0) || null;
}

function enchantmentFromUid(uid) {
  const m = uid.match(/_LEVEL([1-4])$/i);
  return m ? Number(m[1]) : 0;
}

function walk(v, out = []) {
  if (Array.isArray(v)) {
    for (const x of v) walk(x, out);
  } else if (v && typeof v === 'object') {
    out.push(v);
    for (const x of Object.values(v)) walk(x, out);
  }
  return out;
}

function normaliseRequirement(req) {
  const list = attr(
    req,
    'craftResourceList', 'CraftResourceList', 'craftresourcelist',
    'craftResource', 'CraftResource', 'craftresource',
    'resources', 'Resources'
  );

  const ingredients = arr(list).map(r => ({
    uniqueName: str(attr(r, 'uniqueName', 'UniqueName', 'uniquename', 'itemName', 'itemname', 'id', 'Id')),
    count: Number(attr(r, 'count', 'Count', 'amount', 'Amount', 'itemAmount', 'itemamount') || 0) || 0
  })).filter(x => x.uniqueName && x.count > 0);

  if (!ingredients.length) return null;

  return {
    ingredients,
    craftingSilver: Number(attr(req, 'silver', 'Silver') || 0) || 0,
    craftingFocus: Number(attr(req, 'craftingFocus', 'CraftingFocus', 'craftingfocus') || 0) || 0,
    craftingTime: Number(attr(req, 'time', 'Time') || 0) || 0,
    outputCount: Number(attr(req, 'amountCrafted', 'AmountCrafted', 'amountcrafted', 'outputCount', 'OutputCount') || 1) || 1
  };
}

function extractRequirements(payload) {
  const found = [];
  for (const node of walk(payload)) {
    const req = attr(node, 'craftingRequirements', 'CraftingRequirements', 'craftingrequirements');
    for (const r of arr(req)) {
      const normal = normaliseRequirement(r);
      if (normal) found.push(normal);
    }
  }
  return found;
}

async function fetchJson(url, retries = 4) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'VelhaGuardaCraft/3.0' }
      });
      if (res.status === 404) return null;
      if (res.status === 429 || res.status >= 500) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text.trim()) return null;
      let data = JSON.parse(text);
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch {}
      }
      return data;
    } catch (err) {
      lastError = err;
      await sleep(600 * (attempt + 1));
    }
  }
  throw lastError || new Error(`Falha a obter ${url}`);
}

const res = await fetch(ITEMS_SOURCE, { headers: { 'user-agent': 'VelhaGuardaCraft/3.0' } });
if (!res.ok) throw new Error(`HTTP ${res.status} ao descarregar catálogo`);

const raw = await res.json();
const nodes = walk(raw);
const items = {};

for (const item of nodes) {
  const uid = id(item);
  if (!uid) continue;
  if (!items[uid]) {
    items[uid] = {
      name: displayName(item),
      category: str(attr(item, 'shopCategory', 'ShopCategory', 'category', 'Category')),
      subcategory: str(attr(item, 'shopSubCategory', 'ShopSubCategory', 'shopSubcategory', 'ShopSubcategory', 'subcategory', 'Subcategory')),
      tier: tierFrom(uid, item),
      enchantment: enchantmentFromUid(uid)
    };
  }
}

const candidates = Object.keys(items)
  .filter(uid => {
    const t = items[uid].tier;
    return t >= 2 && t <= 8;
  })
  .sort();

const cachePath = path.join(root, 'data/recipe-api-cache.json');
let cache = {};
try { cache = JSON.parse(await fs.readFile(cachePath, 'utf8')); } catch {}

const recipes = new Map();
let processed = 0;
let apiHits = 0;
let failures = 0;

function addRecipe(uid, item, normal, explicitEnchant = null) {
  const enchantment = explicitEnchant ?? enchantmentFromUid(uid);
  const baseUniqueName = uid.replace(/_LEVEL[1-4]$/i, '');
  if (recipes.has(uid)) return;

  recipes.set(uid, {
    uniqueName: uid,
    baseUniqueName,
    name: item.name || uid,
    category: item.category,
    subcategory: item.subcategory,
    tier: item.tier,
    enchantment,
    outputCount: normal.outputCount,
    ingredients: normal.ingredients,
    craftingSilver: normal.craftingSilver,
    craftingFocus: normal.craftingFocus,
    craftingTime: normal.craftingTime,
    source: 'Albion Europe GameInfo API',
    validated: true
  });
}

const concurrency = 5;
let cursor = 0;

async function worker() {
  while (true) {
    const i = cursor++;
    if (i >= candidates.length) return;
    const uid = candidates[i];
    const item = items[uid];

    try {
      let payload = cache[uid];
      if (payload === undefined) {
        payload = await fetchJson(`${API_BASE}/${encodeURIComponent(uid)}/data`);
        cache[uid] = payload ?? null;
        apiHits++;
        if (apiHits % 50 === 0) await fs.writeFile(cachePath, JSON.stringify(cache));
        await sleep(60);
      }

      if (payload) {
        for (const req of extractRequirements(payload)) addRecipe(uid, item, req);

        for (const node of walk(payload)) {
          const level = Number(attr(node, 'enchantmentLevel', 'EnchantmentLevel', 'enchantmentlevel', 'level', 'Level') || 0) || 0;
          if (!level) continue;
          const req = normaliseRequirement(attr(node, 'craftingRequirements', 'CraftingRequirements', 'craftingrequirements'));
          if (!req) continue;
          const levelUid = `${uid.replace(/_LEVEL[1-4]$/i, '')}_LEVEL${level}`;
          addRecipe(levelUid, item, req, level);
        }
      }
    } catch (err) {
      failures++;
      console.warn(`Falhou ${uid}: ${err.message}`);
    }

    processed++;
    if (processed % 100 === 0) {
      console.log(`Progresso ${processed}/${candidates.length} | receitas ${recipes.size} | falhas ${failures}`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));

await fs.mkdir(path.join(root, 'data'), { recursive: true });
await fs.writeFile(cachePath, JSON.stringify(cache));

const recipeList = [...recipes.values()].sort((a, b) => a.uniqueName.localeCompare(b.uniqueName));

await fs.writeFile(path.join(root, 'data/items.json'), JSON.stringify(items, null, 2));
await fs.writeFile(path.join(root, 'data/recipes.json'), JSON.stringify(recipeList, null, 2));

const report = {
  source: 'Albion Europe GameInfo API + ao-bin-dumps item catalogue',
  itemNodes: nodes.length,
  uniqueItems: Object.keys(items).length,
  candidates: candidates.length,
  apiHits,
  failures,
  recipes: recipeList.length,
  enchantedRecipes: recipeList.filter(x => x.enchantment > 0).length,
  generatedAt: new Date().toISOString()
};

await fs.writeFile(path.join(root, 'data/sync-report.json'), JSON.stringify(report, null, 2));
console.log(report);

if (recipeList.length < 1000) {
  throw new Error(`Foram encontradas apenas ${recipeList.length} receitas. A sincronização foi interrompida para proteger a base de dados.`);
}
