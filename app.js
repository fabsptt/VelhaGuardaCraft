// VELHA GUARDA CRAFT — catálogo por categorias e famílias
const CITIES = ["Fort Sterling","Lymhurst","Bridgewatch","Martlock","Thetford","Caerleon","Brecilien"];
const PRICE_API = "https://europe.albion-online-data.com/api/v2/stats/prices/";
const IMAGE_API = "https://render.albiononline.com/v1/item/";
const QUALITY_NAMES = {1:"Normal",2:"Boa",3:"Excelente",4:"Excecional",5:"Obra-prima"};

let recipes=[], prices=new Map(), selectedRecipe=null, lastPriceDate=0;
let activeCategory="", activeSubcategory="";

const $ = id => document.getElementById(id);
const fmt = n => Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString("pt-PT") : "—";
const pct = n => Number.isFinite(Number(n)) ? Number(n).toFixed(1)+"%" : "—";
const esc = s => String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const norm = s => String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[_-]+/g," ");

function itemIcon(id, quality=1, size=64){
  return id ? `${IMAGE_API}${encodeURIComponent(String(id))}.png?quality=${quality}&size=${size}` : "";
}
function iconHTML(id, quality=1, size=52, cls="item-icon"){
  if(!id) return "";
  return `<img class="${cls}" loading="lazy" src="${itemIcon(id,quality,size)}" onerror="this.classList.add('icon-error')" alt="">`;
}

/* ---------- CATEGORIAS CORRETAS ---------- */
const FAMILY = [
  ["Espadas", /MAIN_(SWORD|CLAYMORE)|2H_(CLAYMORE|DUALSWORD|DUAL_SWORD|BROADSWORD|CLAYMORE)/i],
  ["Machados", /MAIN_AXE|2H_(AXE|HALBERD)/i],
  ["Maças", /MAIN_MACE|2H_(MACE|INCUBUS_MACE)/i],
  ["Martelos", /MAIN_HAMMER|2H_(HAMMER|POLEHAMMER|GREAT_HAMMER)/i],
  ["Lanças", /MAIN_SPEAR|2H_(SPEAR|PIKE|GLAIVE)/i],
  ["Arcos", /2H_(BOW|WAR_BOW|LONGBOW|WARBOW|BOW_CRYSTAL)/i],
  ["Bestas", /2H_(CROSSBOW|LIGHT_CROSSBOW|HEAVY_CROSSBOW|WEAPON_CROSSBOW)/i],
  ["Adagas", /MAIN_DAGGER|2H_(DAGGER|DAGGER_PAIR|CLAWS|DEMONIC)/i],
  ["Luvas de Guerra", /WAR_GLOVES|BRAWLER|GAUNTLET/i],
  ["Cajados Arcanos", /ARCANESTAFF|ARCANE_STAFF|ARCANE/i],
  ["Cajados Sagrados", /HOLYSTAFF|HOLY_STAFF|HOLY/i],
  ["Cajados da Natureza", /NATURESTAFF|NATURE_STAFF|NATURE/i],
  ["Cajados de Fogo", /FIRESTAFF|FIRE_STAFF|FIRE/i],
  ["Cajados de Gelo", /FROSTSTAFF|FROST_STAFF|FROST/i],
  ["Cajados Amaldiçoados", /CURSEDSTAFF|CURSED_STAFF|CURSED/i],
  ["Cajados Metamorfos", /SHAPESHIFTER/i],
  ["Bastões", /QUARTERSTAFF|QUARTER_STAFF|BLACKMONK|IRONROOT|SOULSCYTHE/i]
];

const TRANSLATIONS = [
  [/\bNovice'?s?\b/gi,"do Novato"],[/\bJourneyman'?s?\b/gi,"do Aprendiz"],
  [/\bAdept'?s?\b/gi,"do Adepto"],[/\bExpert'?s?\b/gi,"do Especialista"],
  [/\bMaster'?s?\b/gi,"do Mestre"],[/\bGrandmaster'?s?\b/gi,"do Grão-Mestre"],
  [/\bElder'?s?\b/gi,"do Ancião"],[/\bSword\b/gi,"Espada"],[/\bDual Swords\b/gi,"Espadas Duplas"],
  [/\bBroadsword\b/gi,"Espada Larga"],[/\bClaymore\b/gi,"Montante"],[/\bClarent Blade\b/gi,"Lâmina Clarent"],
  [/\bCarving Sword\b/gi,"Espada de Talha"],[/\bInfinity Blade\b/gi,"Lâmina do Infinito"],
  [/\bAxe\b/gi,"Machado"],[/\bBattleaxe\b/gi,"Machado de Batalha"],[/\bHalberd\b/gi,"Alabarda"],
  [/\bGreataxe\b/gi,"Grande Machado"],[/\bMace\b/gi,"Maça"],[/\bHammer\b/gi,"Martelo"],
  [/\bPolehammer\b/gi,"Martelo de Guerra"],[/\bSpear\b/gi,"Lança"],[/\bPike\b/gi,"Pique"],
  [/\bGlaive\b/gi,"Gládio"],[/\bBow\b/gi,"Arco"],[/\bWarbow\b/gi,"Arco de Guerra"],
  [/\bLongbow\b/gi,"Arco Longo"],[/\bCrossbow\b/gi,"Besta"],[/\bLight Crossbow\b/gi,"Besta Leve"],
  [/\bHeavy Crossbow\b/gi,"Besta Pesada"],[/\bDagger\b/gi,"Adaga"],[/\bDagger Pair\b/gi,"Par de Adagas"],
  [/\bClaws\b/gi,"Garras"],[/\bWar Gloves\b/gi,"Luvas de Guerra"],[/\bArcane Staff\b/gi,"Cajado Arcano"],
  [/\bHoly Staff\b/gi,"Cajado Sagrado"],[/\bNature Staff\b/gi,"Cajado da Natureza"],
  [/\bFire Staff\b/gi,"Cajado de Fogo"],[/\bFrost Staff\b/gi,"Cajado de Gelo"],
  [/\bCursed Staff\b/gi,"Cajado Amaldiçoado"],[/\bShapeshifter Staff\b/gi,"Cajado Metamorfo"],
  [/\bQuarterstaff\b/gi,"Bastão"],[/\bHelmet\b/gi,"Elmo"],[/\bArmor\b/gi,"Armadura"],
  [/\bChest\b/gi,"Peitoral"],[/\bShoes\b/gi,"Botas"],[/\bBoots\b/gi,"Botas"],
  [/\bCloth\b/gi,"Tecido"],[/\bLeather\b/gi,"Couro"],[/\bPlate\b/gi,"Placas"],
  [/\bHead\b/gi,"Cabeça"],[/\bMain Hand\b/gi,"Mão Principal"],[/\bOff-Hand\b/gi,"Mão Secundária"],
  [/\bCape\b/gi,"Capa"],[/\bBag\b/gi,"Saco"],[/\bTool\b/gi,"Ferramenta"],
  [/\bPickaxe\b/gi,"Picareta"],[/\bStone Hammer\b/gi,"Martelo de Pedra"],
  [/\bSkinning Knife\b/gi,"Faca de Esfolar"],[/\bSickle\b/gi,"Foice"],
  [/\bFishing Rod\b/gi,"Cana de Pesca"],[/\bAxe\b/gi,"Machado"],
  [/\bHorse\b/gi,"Cavalo"],[/\bOx\b/gi,"Boi"],[/\bStag\b/gi,"Veado"],
  [/\bBoar\b/gi,"Javali"],[/\bWolf\b/gi,"Lobo"],[/\bDirewolf\b/gi,"Lobo Terrível"],
  [/\bSwiftclaw\b/gi,"Garra Veloz"],[/\bMoabird\b/gi,"Moabird"],[/\bMammoth\b/gi,"Mamute"],
  [/\bBag\b/gi,"Saco"],[/\bFood\b/gi,"Comida"],[/\bPotion\b/gi,"Poção"],[/\bPoison\b/gi,"Veneno"],
  [/\bPlank\b/gi,"Prancha"],[/\bMetal Bar\b/gi,"Barra de Metal"],[/\bLeather\b/gi,"Couro"],
  [/\bCloth\b/gi,"Tecido"],[/\bStone Block\b/gi,"Bloco de Pedra"],[/\bOre\b/gi,"Minério"],
  [/\bFiber\b/gi,"Fibra"],[/\bHide\b/gi,"Pele"],[/\bWood\b/gi,"Madeira"]
];

function ptName(r){
  let n = String(r?.name || r?.uniqueName || "Item");
  for(const [re,to] of TRANSLATIONS) n=n.replace(re,to);
  return n;
}

function deriveCategory(r){
  const id=String(r?.uniqueName||"").toUpperCase();
  const n=norm(r?.name||"");
  if(/^T[2-8]_MOUNT_/.test(id) || /(^| )mount( |$)|horse|ox|stag|boar|wolf|direwolf|swiftclaw|mammoth/.test(n)) return "Montarias";
  if(/^T[2-8]_(TOOL|GATHERING)/.test(id) || /tool|pickaxe|sickle|skinning|fishing rod|stone hammer/.test(n)) return "Ferramentas";
  if(/^T[2-8]_(HEAD_|ARMOR_|SHOES_)/.test(id) || /helmet|armor|chest|boots|shoes/.test(n)) return "Armaduras";
  if(/^T[2-8]_(MAIN_|2H_)/.test(id) || FAMILY.some(([,re])=>re.test(id))) return "Armas";
  if(/^T[2-8]_OFF_/.test(id) || /offhand|off-hand|shield|torch|book|orb|tome|mistcaller|facebreaker/.test(n)) return "Mãos secundárias";
  if(/^T[2-8]_(CAPE|BAG)_/.test(id) || /cape|bag/.test(n)) return "Acessórios";
  if(/^T[2-8]_FOOD_/.test(id) || /food|stew|soup|omelette|pie|sandwich|salad/.test(n)) return "Comida";
  if(/^T[2-8]_(POTION|POISON)_/.test(id) || /potion|poison|elixir/.test(n)) return "Poções";
  if(/^T[2-8]_(ORE|WOOD|HIDE|FIBER|ROCK)_/.test(id)) return "Recursos";
  if(/(METALBAR|PLANKS|LEATHER|CLOTH|STONEBLOCK)/.test(id)) return "Refinados";
  if(/^T[2-8]_(FURNITURE|BUILDING|GUILD_)/.test(id)) return "Mobília / Construção";
  if(/^T[2-8]_(FARM|SEED|ANIMAL)/.test(id)) return "Agricultura";
  return "Outros";
}

function deriveSubcategory(r){
  const id=String(r?.uniqueName||"").toUpperCase(), cat=r.category;
  if(cat==="Armas"){
    for(const [name,re] of FAMILY) if(re.test(id)) return name;
    return "Outras armas";
  }
  if(cat==="Armaduras"){
    if(id.includes("_HEAD_")) return "Elmos";
    if(id.includes("_ARMOR_")) return "Armaduras de peito";
    if(id.includes("_SHOES_")) return "Botas";
    return "Outras armaduras";
  }
  if(cat==="Montarias"){
    if(id.includes("MOUNT_HORSE")) return "Cavalos";
    if(id.includes("MOUNT_OX")) return "Bois";
    if(id.includes("MOUNT_STAG")) return "Veados";
    if(id.includes("MOUNT_WOLF")) return "Lobos";
    if(id.includes("MOUNT_BOAR")) return "Javalis";
    return "Outras montarias";
  }
  if(cat==="Ferramentas"){
    if(id.includes("AXE")) return "Machados";
    if(id.includes("PICKAXE")) return "Picaretas";
    if(id.includes("SICKLE")) return "Foices";
    if(id.includes("SKINNING")) return "Facas de esfolar";
    if(id.includes("STONE_HAMMER")) return "Martelos de pedra";
    if(id.includes("FISHING")) return "Pesca";
    return "Outras ferramentas";
  }
  if(cat==="Mãos secundárias") return id.includes("SHIELD") ? "Escudos" : id.includes("TORCH") ? "Tochas" : "Outras";
  if(cat==="Acessórios") return id.includes("_CAPE_") ? "Capas" : "Sacos";
  if(cat==="Refinados") return id.includes("METALBAR") ? "Barras de metal" : id.includes("PLANK") ? "Pranchas" : id.includes("LEATHER") ? "Couro" : id.includes("CLOTH") ? "Tecido" : "Blocos de pedra";
  if(cat==="Recursos") return id.includes("ORE") ? "Minério" : id.includes("WOOD") ? "Madeira" : id.includes("HIDE") ? "Peles" : id.includes("FIBER") ? "Fibra" : "Pedra";
  return cat;
}

function deriveTier(r){
  const id=String(r?.uniqueName||"");
  const m=id.match(/(?:^|_)T([2-8])(?:_|$)/i);
  return m ? m[1] : String(r?.tier||"").replace(/^T/i,"");
}
function deriveEnchantment(r){
  if(Number.isInteger(Number(r?.enchantment))) return Number(r.enchantment);
  const id=String(r?.uniqueName||"");
  const m=id.match(/@([0-4])$/) || id.match(/LEVEL([0-4])$/i);
  return m ? Number(m[1]) : 0;
}
function normalizeRecipeMetadata(r){
  const out={...r};
  out.category=deriveCategory(out);
  out.tier=deriveTier(out);
  out.enchantment=deriveEnchantment(out);
  out.subcategory=deriveSubcategory(out);
  return out;
}

function wanted(){
  let list=recipes.slice();
  const tier=$("tier")?.value||"", ench=$("enchant")?.value||"";
  if(activeCategory) list=list.filter(r=>r.category===activeCategory);
  if(activeSubcategory) list=list.filter(r=>r.subcategory===activeSubcategory);
  if(tier) list=list.filter(r=>String(r.tier)===tier);
  if(ench!=="") list=list.filter(r=>String(r.enchantment??0)===ench);
  return list;
}

function fillFilters(){
  const cats=[...new Set(recipes.map(r=>r.category))].sort((a,b)=>a.localeCompare(b,"pt"));
  $("categoryNav").innerHTML=`<button class="nav-btn active" data-cat="">Todos</button>`+
    cats.map(c=>`<button class="nav-btn" data-cat="${esc(c)}">${esc(c)} <span>${recipes.filter(r=>r.category===c).length}</span></button>`).join("");
  $("categoryNav").querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>{
    activeCategory=b.dataset.cat; activeSubcategory=""; updateNav(); renderRows();
  });
  const tiers=[...new Set(recipes.map(r=>r.tier).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  $("tier").innerHTML=`<option value="">Todos os tiers</option>`+tiers.map(t=>`<option value="${esc(t)}">T${esc(t)}</option>`).join("");
  updateNav();
}
function updateNav(){
  document.querySelectorAll("#categoryNav .nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.cat===activeCategory));
  const subs=[...new Set(recipes.filter(r=>!activeCategory||r.category===activeCategory).map(r=>r.subcategory).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt"));
  $("subcategoryNav").innerHTML=`<button class="sub-btn ${!activeSubcategory?"active":""}" data-sub="">Todos</button>`+
    subs.map(s=>`<button class="sub-btn ${s===activeSubcategory?"active":""}" data-sub="${esc(s)}">${esc(s)} <span>${recipes.filter(r=>(!activeCategory||r.category===activeCategory)&&r.subcategory===s).length}</span></button>`).join("");
  $("subcategoryNav").querySelectorAll(".sub-btn").forEach(b=>b.onclick=()=>{activeSubcategory=b.dataset.sub;updateNav();renderRows();});
  $("catalogTitle").textContent=activeSubcategory || activeCategory || "Todas as categorias";
}

/* IDs de mercado: materiais encantados podem existir como @1..@4. */
function marketCandidates(id){
  const s=String(id||"");
  const out=[s];
  if(!s.includes("@")){
    const m=s.match(/LEVEL([1-4])$/i);
    if(m) out.unshift(s.replace(/LEVEL[1-4]$/i,`LEVEL${m[1]}`)+"@"+m[1]);
  }
  return [...new Set(out)];
}
function idsNeeded(list){
  const set=new Set();
  for(const r of list){
    marketCandidates(r.uniqueName).forEach(x=>set.add(x));
    for(const m of r.ingredients||[]) marketCandidates(m.uniqueName).forEach(x=>set.add(x));
  }
  return [...set];
}
function storePrice(itemId,row){
  if(!row?.city)return;
  if(!prices.has(itemId))prices.set(itemId,new Map());
  prices.get(itemId).set(`${row.city}|${Number(row.quality)||1}`,{
    sell:Number(row.sell_price_min)||0,buy:Number(row.buy_price_max)||0,quality:Number(row.quality)||1,
    sellDate:row.sell_price_min_date||null,buyDate:row.buy_price_max_date||null
  });
  const t=row.sell_price_min_date?new Date(row.sell_price_min_date).getTime():0;
  if(Number.isFinite(t))lastPriceDate=Math.max(lastPriceDate,t);
}
async function getBatch(ids){
  if(!ids.length)return;
  const url=`${PRICE_API}${ids.map(encodeURIComponent).join(",")}.json?locations=${CITIES.map(encodeURIComponent).join(",")}&qualities=1,2,3,4,5`;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const res=await fetch(url,{cache:"no-store"});
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const data=await res.json();
      if(Array.isArray(data)){data.forEach(r=>storePrice(r.item_id,r));return;}
    }catch(e){console.warn(e);if(attempt<3)await new Promise(r=>setTimeout(r,500*attempt));}
  }
}
function priceFor(itemId,city,quality){
  for(const candidate of marketCandidates(itemId)){
    const map=prices.get(candidate); if(!map)continue;
    const exact=map.get(`${city}|${quality}`);
    if(exact?.sell>0)return {...exact,usedQuality:quality};
    for(const q of [2,3,4,5,1]){
      const p=map.get(`${city}|${q}`);
      if(p?.sell>0)return {...p,usedQuality:q,fallback:true};
    }
  }
  return null;
}
function cheapestMaterial(id,q){
  let best=null;
  for(const city of CITIES){const p=priceFor(id,city,q);if(p&&(!best||p.sell<best.price))best={city,price:p.sell,quality:p.usedQuality,date:p.sellDate};}
  return best;
}
function bestSale(id,q){
  let best=null;
  for(const city of CITIES){const p=priceFor(id,city,q);if(p&&(!best||p.sell>best.price))best={city,price:p.sell,quality:p.usedQuality,date:p.sellDate};}
  return best;
}

const CITY_SPECIAL={
  "Fort Sterling":["martelo","lança","cajado sagrado"],
  "Lymhurst":["espada","arco","cajado arcano"],
  "Bridgewatch":["besta","adaga","cajado amaldiçoado"],
  "Martlock":["machado","bastão","cajado de gelo"],
  "Thetford":["maça","cajado da natureza","cajado de fogo"],
  "Caerleon":["luvas de guerra","cajado metamorfo"],
  "Brecilien":["capa","saco","poção"]
};
function craftReturnRate(city,r,focus){
  const n=norm(ptName(r)), special=(CITY_SPECIAL[city]||[]).some(x=>n.includes(norm(x)));
  const bonus=18+(special?15:0)+(focus?59:0);
  return 1-1/(1+bonus/100);
}
function calculate(r){
  if(!r?.ingredients?.length)return null;
  const q=Number($("quality")?.value||2),tax=(Number($("tax")?.value)||0)/100,station=(Number($("station")?.value)||0)/100,focus=$("focus")?.value==="focus";
  const out=[];
  for(const craftCity of CITIES){
    let rawCost=0,missing=false,materials=[];
    for(const m of r.ingredients||[]){
      const qty=Number(m.count)||0,p=cheapestMaterial(m.uniqueName,q);
      if(!p){missing=true;materials.push({id:m.uniqueName,qty,price:null,city:null});}
      else{rawCost+=qty*p.price;materials.push({id:m.uniqueName,qty,price:p.price,city:p.city,quality:p.quality});}
    }
    if(materials.length&&materials.every(m=>m.price==null))continue;
    const rrr=craftReturnRate(craftCity,r,focus),effective=rawCost*(1-rrr),crafting=Number(r.craftingSilver)||0,total=effective+crafting+effective*station,sale=bestSale(r.uniqueName,q);
    if(!sale){out.push({craftCity,saleCity:"—",sale:0,cost:total,profit:null,roi:null,margin:null,rrr:rrr*100,materials});continue;}
    const net=sale.price*(1-tax),profit=net-total,roi=total>0?profit/total*100:0,margin=net>0?profit/net*100:0;
    out.push({craftCity,saleCity:sale.city,sale:sale.price,cost:total,profit,roi,margin,rrr:rrr*100,materials,saleQuality:sale.quality,saleDate:sale.date});
  }
  out.sort((a,b)=>(b.profit??-Infinity)-(a.profit??-Infinity));
  return out[0]||null;
}
function renderRows(){
  const list=wanted().map(r=>({r,c:calculate(r)})),sort=$("sort")?.value||"profit";
  list.sort((a,b)=>sort==="name"?ptName(a.r).localeCompare(ptName(b.r),"pt"):(Number(b.c?.[sort])||-Infinity)-(Number(a.c?.[sort])||-Infinity));
  const priced=list.filter(x=>x.c),profitable=priced.filter(x=>x.c.profit!=null),best=profitable.sort((a,b)=>b.c.profit-a.c.profit)[0];
  $("count").textContent=list.length.toLocaleString("pt-PT");$("priced").textContent=priced.length.toLocaleString("pt-PT");
  $("best").textContent=best?fmt(best.c.profit):"—";$("updated").textContent=lastPriceDate?new Date(lastPriceDate).toLocaleString("pt-PT"):"—";
  $("resultInfo").textContent=`${list.length.toLocaleString("pt-PT")} itens nesta categoria`;
  $("rows").innerHTML=list.slice(0,150).map(({r,c})=>{
    const q=Number($("quality")?.value||2),img=iconHTML(r.uniqueName,q,58);
    if(!c)return `<tr><td><div class="item-with-icon">${img}<div><span class="item">${esc(ptName(r))}</span><span class="sub">${esc(r.uniqueName)}</span></div></div></td><td>T${esc(r.tier)}${r.enchantment?".":""}${r.enchantment||""}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td><button class="open" data-id="${esc(r.uniqueName)}">Ver</button></td></tr>`;
    const profit=c.profit==null?`<span class="muted">Sem venda</span>`:`<span class="${c.profit>=0?"profit":"negative"}">${fmt(c.profit)}</span>`;
    return `<tr><td><div class="item-with-icon">${img}<div><span class="item">${esc(ptName(r))}</span><span class="sub">${esc(r.uniqueName)}</span></div></div></td><td>T${esc(r.tier)}${r.enchantment?"."+r.enchantment:""}</td><td>${esc(c.craftCity)}</td><td>${c.sale?fmt(c.sale):"—"}<span class="sub">${esc(c.saleCity)}</span></td><td>${fmt(c.cost)}</td><td>${profit}</td><td>${pct(c.roi)}</td><td>${pct(c.rrr)}</td><td><button class="open" data-id="${esc(r.uniqueName)}">Ver</button></td></tr>`;
  }).join("");
  document.querySelectorAll(".open").forEach(b=>b.onclick=()=>showDetails(b.dataset.id));
  if(selectedRecipe)showDetails(selectedRecipe.uniqueName,false);
}
function showDetails(id,scroll=true){
  const r=recipes.find(x=>x.uniqueName===id);if(!r)return;selectedRecipe=r;
  const c=calculate(r),q=Number($("quality")?.value||2),icon=iconHTML(r.uniqueName,q,100,"detail-icon");
  $("details").innerHTML=`<div class="recipe-title">${icon}<div><span class="kicker">RECEITA</span><h2>${esc(ptName(r))}</h2><span class="badge">${esc(r.uniqueName)}</span></div><div class="price-state">${c?.sale?"✓ Preços disponíveis":"⌛ A aguardar preços"}</div></div>
  <div class="detail-grid"><div class="box"><h3>MATERIAIS NECESSÁRIOS</h3>${(r.ingredients||[]).map(m=>{const p=c?.materials?.find(x=>x.id===m.uniqueName),mi=iconHTML(m.uniqueName,q,42);return `<div class="material"><div class="item-with-icon">${mi}<div><b>${esc(materialName(m.uniqueName))}</b><span class="sub">${p?.city?"Comprar em "+esc(p.city):"Preço indisponível"}</span></div></div><div><b>${Number(m.count)||0}</b><span class="sub">${p?.price?fmt(p.price)+" prata":"—"}</span></div></div>`}).join("")}</div>
  <div class="box"><h3>MELHOR CRAFT</h3>${c?`<div class="big-number">${esc(c.craftCity)}</div><div class="city"><span>Custo efetivo</span><b>${fmt(c.cost)}</b></div><div class="city"><span>RRR</span><b>${pct(c.rrr)}</b></div><div class="city"><span>Lucro</span><b class="${c.profit>=0?"profit":"negative"}">${c.profit==null?"—":fmt(c.profit)}</b></div>`:`<div class="empty">Ainda faltam preços.</div>`}</div>
  <div class="box"><h3>MELHOR VENDA</h3>${c?.sale?`<div class="big-number">${esc(c.saleCity)}</div><div class="city"><span>Preço</span><b>${fmt(c.sale)}</b></div><div class="city"><span>ROI</span><b>${pct(c.roi)}</b></div><div class="city"><span>Qualidade</span><b>${esc(QUALITY_NAMES[c.saleQuality]||c.saleQuality)}</b></div>`:`<div class="empty">Sem preço de venda.</div>`}</div></div>`;
  if(scroll)$("details").scrollIntoView({behavior:"smooth",block:"start"});
}
function materialName(id){
  const fake={name:id,uniqueName:id};
  return ptName(fake);
}
async function refreshPrices(){
  const ids=idsNeeded(wanted());if(!ids.length)return;
  $("status").textContent=`Preços: 0/${ids.length} itens consultados...`;prices=new Map();lastPriceDate=0;
  const batches=[];for(let i=0;i<ids.length;i+=8)batches.push(ids.slice(i,i+8));
  let cursor=0;
  async function worker(){while(cursor<batches.length){const b=batches[cursor++];await getBatch(b);$("status").textContent=`Preços: ${Math.min(cursor*8,ids.length)}/${ids.length} itens consultados...`;renderRows();}}
  await Promise.all(Array.from({length:Math.min(4,batches.length)},worker));
  $("status").textContent=`Preços concluídos para a seleção atual.`;renderRows();
}
async function loadData(){
  try{
    $("status").textContent="A carregar receitas...";
    const res=await fetch("data/recipes.json?cache="+Date.now(),{cache:"no-store"});if(!res.ok)throw new Error(`recipes.json HTTP ${res.status}`);
    recipes=await res.json();if(!Array.isArray(recipes))throw new Error("recipes.json não é um array");
    recipes=recipes.map(normalizeRecipeMetadata);fillFilters();renderRows();
    $("status").textContent=`${recipes.length.toLocaleString("pt-PT")} receitas carregadas. Escolhe uma categoria e carrega em ATUALIZAR PREÇOS.`;
  }catch(e){console.error(e);$("status").textContent="Erro ao carregar receitas: "+e.message;}
}
function bind(){
  $("refresh")?.addEventListener("click",refreshPrices);
  ["tier","enchant","quality","focus","tax","station","sort"].forEach(id=>{$(id)?.addEventListener("input",renderRows);$(id)?.addEventListener("change",renderRows);});
}
bind();loadData();
