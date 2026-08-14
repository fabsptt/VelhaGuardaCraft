const API = "https://europe.albion-online-data.com/api/v2/stats/prices";
const LOCATIONS = ["Bridgewatch","Caerleon","Fort Sterling","Lymhurst","Martlock","Thetford","Brecilien"];
const state = { recipes: [], items: {}, prices: {}, loaded: false };

const $ = s => document.querySelector(s);
const fmt = n => Number.isFinite(n) ? new Intl.NumberFormat("pt-PT").format(Math.round(n)) : "—";
const pct = n => Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";

function tierOf(id){
  const m = String(id).match(/^T([1-8])(?:_|\b)/i); return m ? Number(m[1]) : null;
}
function enchantOf(id){
  const m = String(id).match(/(?:_LEVEL_?|@)([1-4])/i); return m ? Number(m[1]) : 0;
}
function cleanName(id, item){
  if(item?.name) return item.name;
  return String(id).replace(/^T\d+_/, "").replace(/_LEVEL_[1-4]/,"").replace(/_/g," ");
}
function iconUrl(id){ return `https://render.albiononline.com/v1/item/${encodeURIComponent(id)}.png`; }

function rrr(productionBonus, focus=false){
  let bonus = productionBonus + (focus ? 59 : 0);
  return bonus / (100 + bonus);
}
const cityRules = {
  "Fort Sterling": { production:18, categories:["Hammer","Spear","Holy Staff","Plate Helmet","Cloth Armor"], refine:["Wood"] },
  "Lymhurst": { production:18, categories:["Sword","Bow","Arcane Staff","Leather Helmet","Leather Shoes"], refine:["Fiber"] },
  "Bridgewatch": { production:18, categories:["Crossbow","Dagger","Cursed Staff","Plate Armor","Cloth Shoes"], refine:["Stone"] },
  "Martlock": { production:18, categories:["Axe","Quarterstaff","Frost Staff","Plate Shoes","Off-Hand"], refine:["Hide"] },
  "Thetford": { production:18, categories:["Mace","Nature Staff","Fire Staff","Leather Armor","Cloth Helmet"], refine:["Ore"] },
  "Caerleon": { production:18, categories:["War Gloves","Shapeshifter Staff","Gathering Gear","Tools","Food"], refine:[] },
  "Brecilien": { production:18, categories:["Cape","Bag","Potion"], refine:[] }
};

function normalizeCategory(recipe){
  const raw = `${recipe.category||""} ${recipe.subcategory||""} ${recipe.uniqueName||""}`.toLowerCase();
  if(raw.includes("cape")) return "Cape";
  if(raw.includes("bag")) return "Bag";
  if(raw.includes("potion")) return "Potion";
  if(raw.includes("food") || raw.includes("meal")) return "Food";
  if(raw.includes("tool") || raw.includes("gather")) return "Tools";
  if(raw.includes("war_gloves") || raw.includes("war gloves")) return "War Gloves";
  if(raw.includes("shapeshifter")) return "Shapeshifter Staff";
  if(raw.includes("off_") || raw.includes("offhand")) return "Off-Hand";
  if(raw.includes("sword")) return "Sword";
  if(raw.includes("bow")) return "Bow";
  if(raw.includes("arcane")) return "Arcane Staff";
  if(raw.includes("crossbow")) return "Crossbow";
  if(raw.includes("dagger")) return "Dagger";
  if(raw.includes("cursed")) return "Cursed Staff";
  if(raw.includes("axe")) return "Axe";
  if(raw.includes("quarterstaff") || raw.includes("quarter_staff")) return "Quarterstaff";
  if(raw.includes("frost")) return "Frost Staff";
  if(raw.includes("mace")) return "Mace";
  if(raw.includes("nature")) return "Nature Staff";
  if(raw.includes("fire")) return "Fire Staff";
  if(raw.includes("holy")) return "Holy Staff";
  if(raw.includes("spear")) return "Spear";
  if(raw.includes("hammer")) return "Hammer";
  if(raw.includes("plate_shoes")) return "Plate Shoes";
  if(raw.includes("plate_armor")) return "Plate Armor";
  if(raw.includes("plate_helmet")) return "Plate Helmet";
  if(raw.includes("leather_shoes")) return "Leather Shoes";
  if(raw.includes("leather_armor")) return "Leather Armor";
  if(raw.includes("leather_helmet") || raw.includes("leather_head")) return "Leather Helmet";
  if(raw.includes("cloth_shoes")) return "Cloth Shoes";
  if(raw.includes("cloth_armor")) return "Cloth Armor";
  if(raw.includes("cloth_helmet")) return "Cloth Helmet";
  return recipe.category || "Outros";
}
function bestCity(recipe, focus){
  const cat = normalizeCategory(recipe);
  let best = null;
  for(const [city,rule] of Object.entries(cityRules)){
    const specialty = rule.categories.includes(cat) ? 15 : 0;
    const production = rule.production + specialty;
    const returnRate = rrr(production, focus);
    if(!best || returnRate > best.returnRate) best = {city, returnRate, production};
  }
  return best;
}
function priceRecord(itemId, city){
  const rows = state.prices[itemId] || [];
  return rows.find(x => x.city === city || x.location === city);
}
function inputUnitPrice(itemId, city){
  const p = priceRecord(itemId, city);
  if(!p) return null;
  return Number(p.sell_price_min || 0) || Number(p.buy_price_max || 0) || null;
}
function outputSalePrice(itemId, city){
  const p = priceRecord(itemId, city);
  if(!p) return null;
  return Number(p.buy_price_max || 0) || Number(p.sell_price_min || 0) || null;
}
function calc(recipe){
  const focus = $("#focus").value === "focus";
  const craft = bestCity(recipe, focus);
  if(!craft) return null;
  const tax = Number($("#tax").value || 0)/100;
  const station = Number($("#stationFee").value || 0)/100;
  const mats = recipe.ingredients || [];
  let materialCost = 0, missing = 0;
  for(const m of mats){
    const p = inputUnitPrice(m.uniqueName, craft.city);
    if(!p){ missing++; continue; }
    materialCost += p * Number(m.count || 0);
  }
  if(missing) return {missing, craft};
  const effectiveMaterial = materialCost * (1 - craft.returnRate);
  const stationFee = materialCost * station;
  const outputCity = LOCATIONS.map(city => ({city, price:outputSalePrice(recipe.uniqueName, city)}))
    .filter(x => x.price > 0)
    .sort((a,b)=>b.price-a.price)[0];
  if(!outputCity) return {missing:1, craft};
  const qty = Number(recipe.outputCount || 1);
  const revenue = outputCity.price * qty * (1-tax);
  const total = effectiveMaterial + stationFee;
  const profit = revenue - total;
  return { craft, outputCity, materialCost, effectiveMaterial, stationFee, revenue, profit, roi: total ? profit/total*100 : 0, missing:0 };
}

function populateFilters(){
  const cats=[...new Set(state.recipes.map(r=>normalizeCategory(r)))].sort();
  const tiers=[...new Set(state.recipes.map(r=>tierOf(r.uniqueName)).filter(Boolean))].sort((a,b)=>a-b);
  const ench=[...new Set(state.recipes.map(r=>enchantOf(r.uniqueName)).filter(x=>x!==null))].sort();
  $("#category").innerHTML='<option value="">Todas</option>'+cats.map(x=>`<option>${x}</option>`).join("");
  $("#tier").innerHTML='<option value="">Todos</option>'+tiers.map(x=>`<option value="${x}">T${x}</option>`).join("");
  $("#enchant").innerHTML='<option value="">Todos</option>'+ench.map(x=>`<option value="${x}">${x===0?"Base":"."+x}</option>`).join("");
}
function render(){
  const q=$("#search").value.trim().toLowerCase();
  const cat=$("#category").value, tier=$("#tier").value, ench=$("#enchant").value, sort=$("#sort").value;
  let rows=[];
  for(const r of state.recipes){
    const name=cleanName(r.uniqueName,r);
    if(q && !`${name} ${r.uniqueName}`.toLowerCase().includes(q)) continue;
    if(cat && normalizeCategory(r)!==cat) continue;
    if(tier && String(tierOf(r.uniqueName))!==tier) continue;
    if(ench && String(enchantOf(r.uniqueName))!==ench) continue;
    const c=calc(r); if(!c || c.missing) continue;
    rows.push({r,c,name});
  }
  rows.sort((a,b)=>{
    if(sort==="roi") return b.c.roi-a.c.roi;
    if(sort==="sale") return b.c.outputCity.price-a.c.outputCity.price;
    if(sort==="name") return a.name.localeCompare(b.name);
    return b.c.profit-a.c.profit;
  });
  const limit=80;
  $("#rows").innerHTML=rows.slice(0,limit).map(({r,c,name})=>{
    const pclass=c.profit>=0?"profit":"loss";
    return `<tr class="data-row" data-id="${escapeHtml(r.uniqueName)}">
      <td><span class="item-name">${escapeHtml(name)}</span><span class="small">${escapeHtml(r.uniqueName)}</span></td>
      <td>T${tierOf(r.uniqueName)??"—"}${enchantOf(r.uniqueName)?`.${enchantOf(r.uniqueName)}`:""}</td>
      <td>${escapeHtml(normalizeCategory(r))}</td>
      <td class="city">${c.craft.city}<span class="small">RRR ${pct(c.craft.returnRate*100)}</span></td>
      <td class="city">${c.outputCity.city}</td>
      <td class="money">${fmt(c.effectiveMaterial+c.stationFee)}</td>
      <td class="money">${fmt(c.revenue)}</td>
      <td class="${pclass}">${c.profit>=0?"+":""}${fmt(c.profit)}</td>
      <td class="${pclass}">${pct(c.roi)}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="9" class="empty">Sem oportunidades com preços suficientes para os filtros escolhidos.</td></tr>`;
  document.querySelectorAll(".data-row").forEach(el=>el.onclick=()=>showDetail(el.dataset.id));
  $("#pricedCount").textContent=rows.length;
}
function showDetail(id){
  const r=state.recipes.find(x=>x.uniqueName===id); if(!r)return;
  const c=calc(r), name=cleanName(id,r);
  const ingredients=(r.ingredients||[]).map(m=>`<div class="recipe-line"><span>${escapeHtml(cleanName(m.uniqueName,state.items[m.uniqueName]))}</span><b>${m.count}</b></div>`).join("");
  $("#detail").innerHTML=`<div class="detail-head"><img src="${iconUrl(id)}" alt=""><div><div class="eyebrow">RECEITA COMPLETA</div><h2>${escapeHtml(name)}</h2><div class="small">${escapeHtml(id)} • produz ${r.outputCount||1}</div></div></div>
  <div class="detail-grid">
    <div class="card"><h3>Materiais necessários</h3>${ingredients||'<div class="empty">Sem ingredientes registados.</div>'}</div>
    <div class="card"><h3>Crafting</h3>
      <div class="recipe-line"><span>Melhor cidade</span><b class="city">${c?.craft?.city||"—"}</b></div>
      <div class="recipe-line"><span>RRR</span><b>${c?pct(c.craft.returnRate*100):"—"}</b></div>
      <div class="recipe-line"><span>Custo materiais</span><b>${c?fmt(c.materialCost):"—"}</b></div>
      <div class="recipe-line"><span>Custo efectivo</span><b>${c?fmt(c.effectiveMaterial+c.stationFee):"—"}</b></div>
    </div>
    <div class="card"><h3>Mercado</h3>
      <div class="recipe-line"><span>Melhor venda rápida</span><b class="city">${c?.outputCity?.city||"—"}</b></div>
      <div class="recipe-line"><span>Receita líquida</span><b>${c?fmt(c.revenue):"—"}</b></div>
      <div class="recipe-line"><span>Lucro</span><b class="${c?.profit>=0?"profit":"loss"}">${c?fmt(c.profit):"—"}</b></div>
      <div class="recipe-line"><span>ROI</span><b>${c?pct(c.roi):"—"}</b></div>
    </div>
  </div>`;
  $("#detail").scrollIntoView({behavior:"smooth",block:"start"});
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

async function loadData(){
  try{
    const [recipesRes, itemsRes] = await Promise.all([fetch("data/recipes.json?"+Date.now()),fetch("data/items.json?"+Date.now())]);
    if(!recipesRes.ok) throw new Error("data/recipes.json não encontrado. Execute o sincronizador.");
    state.recipes=await recipesRes.json();
    state.items=itemsRes.ok?await itemsRes.json():{};
    state.loaded=true;
    $("#recipeCount").textContent=state.recipes.length;
    $("#itemCount").textContent=Object.keys(state.items).length;
    $("#updatedAt").textContent=new Date().toLocaleDateString("pt-PT");
    $("#statusText").textContent=`Base carregada: ${state.recipes.length} receitas.`;
    $(".dot").classList.add("ok");
    populateFilters();
    await refreshPrices();
  }catch(e){
    $("#statusText").textContent=e.message;
    $(".dot").classList.add("bad");
    $("#rows").innerHTML=`<tr><td colspan="9" class="empty">${escapeHtml(e.message)}<br><br>O site está preparado para ser preenchido automaticamente pelo GitHub Actions.</td></tr>`;
  }
}

async function refreshPrices(){
  if(!state.loaded)return;
  $("#statusText").textContent="A consultar preços Europe...";
  const ids=[...new Set(state.recipes.flatMap(r=>[r.uniqueName,...(r.ingredients||[]).map(m=>m.uniqueName)]))];
  state.prices={};
  for(let i=0;i<ids.length;i+=45){
    const batch=ids.slice(i,i+45);
    const url=`${API}/${batch.map(encodeURIComponent).join(",")}.json?locations=${encodeURIComponent(LOCATIONS.join(","))}&qualities=1`;
    try{
      const res=await fetch(url);
      if(res.ok){
        const data=await res.json();
        for(const row of data){
          const id=row.item_id||row.itemId||row.uniqueName;
          if(id) (state.prices[id]??=[]).push(row);
        }
      }
    }catch(err){ console.warn("Falha de preços",err); }
  }
  $("#statusText").textContent="Preços Europe actualizados. Os valores podem variar conforme a última observação do mercado.";
  $(".dot").classList.add("ok");
  render();
}

["search","category","tier","enchant","sort","focus","tax","stationFee"].forEach(id=>$( "#"+id).addEventListener("input",render));
$("#refresh").onclick=refreshPrices;
$("#clear").onclick=()=>{["search","category","tier","enchant"].forEach(id=>$("#"+id).value="");render();};
loadData();
