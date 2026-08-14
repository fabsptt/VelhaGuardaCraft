import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const RAW_ITEMS = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json";
const OUT_ITEMS = path.join(ROOT, "data", "items.json");
const OUT_RECIPES = path.join(ROOT, "data", "recipes.json");

const sleep = ms => new Promise(r => setTimeout(r, ms));

function findKey(obj, names){
  if(!obj || typeof obj !== "object") return undefined;
  const wanted = new Set(names.map(x=>x.toLowerCase()));
  for(const [k,v] of Object.entries(obj)) if(wanted.has(k.toLowerCase())) return v;
}
function first(obj,names){ return findKey(obj,names); }
function asArray(v){ return Array.isArray(v) ? v : (v && typeof v==="object" ? Object.values(v) : []); }

function extractLocalized(item){
  const names=first(item,["localizedNames","localizednames","LocalizedNames"]);
  if(names && typeof names==="object") return names["EN-US"] || names["en-US"] || names["EN"] || Object.values(names)[0] || "";
  return first(item,["name","Name","displayName","DisplayName"]) || "";
}
function extractUnique(item){
  return first(item,["uniqueName","UniqueName","index","Index","id","Id"]);
}
function extractIngredients(item){
  const req=first(item,["craftingRequirements","CraftingRequirements"]);
  if(!req) return {ingredients:[],outputCount:1,valid:false};
  const list=first(req,["craftResourceList","CraftResourceList","resources","Resources"]);
  const ingredients=[];
  for(const x of asArray(list)){
    const id=first(x,["uniqueName","UniqueName","itemId","ItemId","id","Id"]);
    const count=Number(first(x,["count","Count","amount","Amount"]) ?? 0);
    if(id && count>0) ingredients.push({uniqueName:String(id),count});
  }
  const output=Number(first(item,["craftingOutputCount","CraftingOutputCount","outputCount","OutputCount"]) ?? first(req,["outputCount","OutputCount"]) ?? 1);
  return {ingredients,outputCount:output||1,valid:ingredients.length>0};
}
function categoryOf(item){
  return first(item,["shopCategory","ShopCategory","category","Category"]) || "";
}
function subcategoryOf(item){
  return first(item,["shopSubCategory","ShopSubCategory","shopSubcategory","ShopSubcategory","subcategory","Subcategory"]) || "";
}

function walk(value, out=[]){
  if(Array.isArray(value)){ for(const x of value) walk(x,out); return out; }
  if(value && typeof value==="object"){
    if(extractUnique(value)) out.push(value);
    for(const [k,v] of Object.entries(value)){
      if(!["craftingrequirements","craftResourceList"].includes(k.toLowerCase())) walk(v,out);
    }
  }
  return out;
}

const res = await fetch(RAW_ITEMS);
if(!res.ok) throw new Error(`Falha ao descarregar items.json: HTTP ${res.status}`);
const raw = await res.json();
const candidates = walk(raw);
const seen = new Set();
const items = {};
const recipes = [];

for(const item of candidates){
  const unique = String(extractUnique(item) || "");
  if(!unique || seen.has(unique)) continue;
  seen.add(unique);
  const localized = extractLocalized(item);
  const rec = extractIngredients(item);
  items[unique] = {
    name: localized,
    category: categoryOf(item),
    subcategory: subcategoryOf(item),
    tier: String(unique).match(/^T([1-8])(?:_|$)/i)?.[1] || null
  };
  if(rec.valid){
    recipes.push({
      uniqueName: unique,
      name: localized,
      category: categoryOf(item),
      subcategory: subcategoryOf(item),
      outputCount: rec.outputCount,
      ingredients: rec.ingredients,
      source: "ao-bin-dumps",
      validated: true
    });
  }
}

recipes.sort((a,b)=>a.uniqueName.localeCompare(b.uniqueName));
await fs.mkdir(path.dirname(OUT_ITEMS),{recursive:true});
await fs.writeFile(OUT_ITEMS, JSON.stringify(items,null,2)+"\n");
await fs.writeFile(OUT_RECIPES, JSON.stringify(recipes,null,2)+"\n");

console.log(`Itens: ${Object.keys(items).length}`);
console.log(`Receitas com craftingRequirements: ${recipes.length}`);
console.log(`Ficheiros escritos: ${OUT_ITEMS}, ${OUT_RECIPES}`);
