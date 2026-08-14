// VELHA GUARDA CRAFT V5
// Preços Europe + imagens oficiais do Render Service + resultados progressivos

const CITIES = [
  "Fort Sterling","Lymhurst","Bridgewatch","Martlock",
  "Thetford","Caerleon","Brecilien"
];

const PRICE_API = "https://europe.albion-online-data.com/api/v2/stats/prices/";
const IMAGE_API = "https://render.albiononline.com/v1/item/";
const QUALITY_NAMES = {
  1:"Normal", 2:"Good", 3:"Outstanding", 4:"Excellent", 5:"Masterpiece"
};

let recipes = [];
let prices = new Map();
let selectedRecipe = null;
let loading = false;
let progress = {done:0,total:0};
let lastPriceDate = 0;

const $ = id => document.getElementById(id);

const fmt = n => Number.isFinite(Number(n))
  ? Math.round(Number(n)).toLocaleString("pt-PT") : "—";

const pct = n => Number.isFinite(Number(n))
  ? Number(n).toFixed(1) + "%" : "—";

const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[m]));

function norm(s) {
  return String(s ?? "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[_-]+/g," ");
}

function itemIcon(id, quality=1, size=64) {
  if (!id) return "";
  const safe = String(id);
  return `${IMAGE_API}${encodeURIComponent(safe)}.png?quality=${quality}&size=${size}`;
}

function iconHTML(id, quality=1, size=52, cls="item-icon") {
  if (!id) return "";
  return `<img class="${cls}" loading="lazy"
    src="${itemIcon(id, quality, size)}"
    onerror="this.classList.add('icon-error')"
    alt="">`;
}

function imageId(recipe, quality) {
  let id = recipe?.uniqueName || "";
  const ench = Number(recipe?.enchantment || 0);
  if (ench > 0 && !id.includes("@")) id += "@" + ench;
  return id;
}

function recipeName(r) {
  return r?.name || r?.uniqueName || "Item";
}

function requestedQuality() {
  return Number($("quality")?.value || 2);
}

function wanted() {
  let list = recipes.slice();
  const q = norm($("search")?.value);
  const cat = $("category")?.value || "";
  const tier = $("tier")?.value || "";
  const ench = $("enchant")?.value || "";

  if (q) list = list.filter(r =>
    norm(r.name).includes(q) || norm(r.uniqueName).includes(q)
  );
  if (cat) list = list.filter(r => String(r.category || "") === cat);
  if (tier) list = list.filter(r => String(r.tier ?? "") === tier);
  if (ench !== "") list = list.filter(r => String(r.enchantment ?? 0) === ench);

  return list;
}

function fillFilters() {
  const cats = [...new Set(recipes.map(r => r.category).filter(Boolean))].sort();
  const tiers = [...new Set(recipes.map(r => r.tier).filter(v => v !== null && v !== undefined && v !== ""))]
    .sort((a,b) => Number(a)-Number(b));

  if ($("category")) {
    $("category").innerHTML =
      `<option value="">Todas</option>` +
      cats.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
  }
  if ($("tier")) {
    $("tier").innerHTML =
      `<option value="">Todos</option>` +
      tiers.map(x => `<option value="${esc(x)}">T${esc(x)}</option>`).join("");
  }
}

function idsNeeded(list) {
  const set = new Set();
  for (const r of list) {
    if (r.uniqueName) set.add(r.uniqueName);
    for (const m of (r.ingredients || [])) if (m.uniqueName) set.add(m.uniqueName);
  }
  return [...set];
}

function storePrice(itemId, row) {
  if (!row?.city) return;
  if (!prices.has(itemId)) prices.set(itemId, new Map());
  prices.get(itemId).set(`${row.city}|${Number(row.quality)||1}`, {
    sell: Number(row.sell_price_min) || 0,
    buy: Number(row.buy_price_max) || 0,
    quality: Number(row.quality) || 1,
    sellDate: row.sell_price_min_date || null,
    buyDate: row.buy_price_max_date || null
  });
  const t = row.sell_price_min_date ? new Date(row.sell_price_min_date).getTime() : 0;
  if (Number.isFinite(t)) lastPriceDate = Math.max(lastPriceDate, t);
}

async function getBatch(ids) {
  if (!ids.length) return;
  // Keep URLs safely below the API's documented 4096-character URL limit.
  const itemList = ids.map(encodeURIComponent).join(",");
  const locations = CITIES.map(encodeURIComponent).join(",");
  const url = `${PRICE_API}${itemList}.json?locations=${locations}&qualities=1,2,3,4,5`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {cache:"no-store"});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const row of data) storePrice(row.item_id, row);
        return;
      }
    } catch (e) {
      console.warn("Preço batch", attempt, e);
      if (attempt < 3) await new Promise(r => setTimeout(r, 700 * attempt));
    }
  }
}

function priceFor(itemId, city, quality) {
  const map = prices.get(itemId);
  if (!map) return null;

  const exact = map.get(`${city}|${quality}`);
  if (exact && exact.sell > 0) return {...exact, usedQuality:quality, fallback:false};

  // Fallback only when the requested quality has no sell price.
  for (const q of [2,3,4,5,1]) {
    const p = map.get(`${city}|${q}`);
    if (p && p.sell > 0) return {...p, usedQuality:q, fallback:true};
  }
  return null;
}

function cheapestMaterial(itemId, quality) {
  let best = null;
  for (const city of CITIES) {
    const p = priceFor(itemId, city, quality);
    if (!p) continue;
    if (!best || p.sell < best.price) best = {city, price:p.sell, quality:p.usedQuality, fallback:p.fallback, date:p.sellDate};
  }
  return best;
}

function bestSale(itemId, quality) {
  let best = null;
  for (const city of CITIES) {
    const p = priceFor(itemId, city, quality);
    if (!p) continue;
    if (!best || p.sell > best.price) best = {city, price:p.sell, quality:p.usedQuality, fallback:p.fallback, date:p.sellDate};
  }
  return best;
}

// Conservative city crafting bonuses used by the current project.
// These values are intentionally kept separate from market prices.
const CITY_SPECIAL = {
  "Fort Sterling":["Hammer","Spear","Holy Staff","Plate Helmet","Cloth Armor"],
  "Lymhurst":["Sword","Bow","Arcane Staff","Leather Helmet","Leather Shoes"],
  "Bridgewatch":["Crossbow","Dagger","Cursed Staff","Plate Armor","Cloth Shoes"],
  "Martlock":["Axe","Quarterstaff","Frost Staff","Plate Shoes","Off-Hand"],
  "Thetford":["Mace","Nature Staff","Fire Staff","Leather Armor","Cloth Helmet"],
  "Caerleon":["Gathering Gear","Tool","Food","War Gloves","Shapeshifter Staff"],
  "Brecilien":["Cape","Bag","Potion"]
};

function craftReturnRate(city, r, focus) {
  const name = norm(`${r.name || ""} ${r.category || ""} ${r.subcategory || ""}`);
  const special = (CITY_SPECIAL[city] || []).some(x => name.includes(norm(x)));
  const bonus = 18 + (special ? 15 : 0) + (focus ? 59 : 0);
  return 1 - 1 / (1 + bonus / 100);
}

function calculate(r) {
  if (!r?.ingredients?.length) return null;

  const quality = requestedQuality();
  const tax = (Number($("tax")?.value) || 0) / 100;
  const station = (Number($("station")?.value) || 0) / 100;
  const focus = $("focus")?.value === "focus";
  const out = [];

  for (const craftCity of CITIES) {
    let rawCost = 0;
    let missing = false;
    const materials = [];

    for (const m of r.ingredients) {
      if (!m.uniqueName) continue;
      const qty = Number(m.count) || 0;
      const p = cheapestMaterial(m.uniqueName, quality);

      if (!p) {
        missing = true;
        materials.push({id:m.uniqueName, qty, price:null, city:null, quality:null});
      } else {
        rawCost += qty * p.price;
        materials.push({id:m.uniqueName, qty, price:p.price, city:p.city, quality:p.quality, fallback:p.fallback});
      }
    }

    if (materials.length && materials.every(m => m.price == null)) continue;

    const rrr = craftReturnRate(craftCity, r, focus);
    const effectiveMaterials = rawCost * (1 - rrr);
    const craftingSilver = Number(r.craftingSilver) || 0;
    const stationCost = effectiveMaterials * station;
    const totalCost = effectiveMaterials + craftingSilver + stationCost;

    const sale = bestSale(r.uniqueName, quality);

    if (!sale) {
      out.push({
        craftCity, saleCity:"—", sale:0, cost:totalCost, profit:null, roi:null,
        margin:null, rrr:rrr*100, materials, missing, missingSale:true
      });
      continue;
    }

    const netSale = sale.price * (1 - tax);
    const profit = netSale - totalCost;
    const roi = totalCost > 0 ? profit / totalCost * 100 : 0;
    const margin = netSale > 0 ? profit / netSale * 100 : 0;

    out.push({
      craftCity, saleCity:sale.city, sale:sale.price, cost:totalCost, profit, roi,
      margin, rrr:rrr*100, materials, missing, missingSale:false,
      saleQuality:sale.quality, saleFallback:sale.fallback, saleDate:sale.date
    });
  }

  if (!out.length) return null;
  out.sort((a,b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));
  return out[0];
}

function renderRows() {
  const list = wanted().map(r => ({r, c:calculate(r)}));
  const sort = $("sort")?.value || "profit";

  list.sort((a,b) => {
    if (sort === "name") return recipeName(a.r).localeCompare(recipeName(b.r));
    return (Number(b.c?.[sort]) || -Infinity) - (Number(a.c?.[sort]) || -Infinity);
  });

  const priced = list.filter(x => x.c);
  $("count").textContent = list.length.toLocaleString("pt-PT");
  $("priced").textContent = priced.length.toLocaleString("pt-PT");

  const profitable = priced.filter(x => x.c.profit != null);
  const best = profitable.sort((a,b) => b.c.profit - a.c.profit)[0];
  $("best").textContent = best ? fmt(best.c.profit) : "—";
  $("updated").textContent = lastPriceDate ? new Date(lastPriceDate).toLocaleString("pt-PT") : "—";

  $("resultInfo").textContent = `${priced.length} oportunidades com dados`;

  $("rows").innerHTML = list.slice(0, 100).map(({r,c}) => {
    const quality = Number($("quality")?.value || 2);
    const img = iconHTML(imageId(r, quality), quality, 58);
    if (!c) {
      return `<tr><td><div class="item-with-icon">${img}<div><span class="item">${esc(recipeName(r))}</span><span class="sub">${esc(r.uniqueName)}</span></div></div></td>
        <td>T${esc(r.tier ?? "")}${r.enchantment ? "."+r.enchantment : ""}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
        <td><button class="open" data-id="${esc(r.uniqueName)}">Ver</button></td></tr>`;
    }
    const profit = c.profit == null ? `<span class="muted">Sem venda</span>` : `<span class="${c.profit >= 0 ? "profit":"negative"}">${fmt(c.profit)}</span>`;
    return `<tr>
      <td><div class="item-with-icon">${img}<div><span class="item">${esc(recipeName(r))}</span><span class="sub">${esc(r.uniqueName)}</span></div></div></td>
      <td>T${esc(r.tier ?? "")}${r.enchantment ? "."+r.enchantment : ""}</td>
      <td>${esc(c.craftCity)}</td><td>${c.sale ? fmt(c.sale) : "—"}<span class="sub">${esc(c.saleCity)}</span></td>
      <td>${fmt(c.cost)}</td><td>${profit}</td><td>${pct(c.roi)}</td><td>${pct(c.rrr)}</td>
      <td><button class="open" data-id="${esc(r.uniqueName)}">Ver</button></td>
    </tr>`;
  }).join("");

  document.querySelectorAll(".open").forEach(btn => {
    btn.addEventListener("click", () => showDetails(btn.dataset.id));
  });

  if (selectedRecipe) showDetails(selectedRecipe.uniqueName, false);
}

function showDetails(id, scroll=true) {
  const r = recipes.find(x => x.uniqueName === id);
  if (!r) return;
  selectedRecipe = r;

  const c = calculate(r);
  const q = requestedQuality();
  const icon = iconHTML(imageId(r,q), q, 100, "detail-icon");

  $("details").innerHTML = `
    <div class="recipe-title">
      ${icon}
      <div><span class="kicker">RECEITA</span><h2>${esc(recipeName(r))}</h2>
      <span class="badge">${esc(r.uniqueName)}</span></div>
      <div class="price-state">${c?.sale ? "✓ Preços disponíveis" : "⌛ A aguardar preços"}</div>
    </div>
    <div class="detail-grid">
      <div class="box"><h3>MATERIAIS NECESSÁRIOS</h3>
        ${(r.ingredients||[]).map(m => {
          const p = c?.materials?.find(x => x.id === m.uniqueName);
          const mi = iconHTML(m.uniqueName, q, 42);
          return `<div class="material">
            <div class="item-with-icon">${mi}<div><b>${esc(m.uniqueName)}</b><span class="sub">${p?.city ? "Comprar em "+esc(p.city) : "Preço indisponível"}</span></div></div>
            <div><b>${Number(m.count)||0}</b><span class="sub">${p?.price ? fmt(p.price)+" prata" : "—"}</span></div>
          </div>`;
        }).join("")}
      </div>
      <div class="box"><h3>MELHOR CRAFT</h3>
        ${c ? `<div class="big-number">${esc(c.craftCity)}</div>
          <div class="city"><span>Custo efetivo</span><b>${fmt(c.cost)}</b></div>
          <div class="city"><span>RRR</span><b>${pct(c.rrr)}</b></div>
          <div class="city"><span>Lucro</span><b class="${c.profit >= 0 ? "profit":"negative"}">${c.profit == null ? "—" : fmt(c.profit)}</b></div>` :
          `<div class="empty">Ainda faltam preços.</div>`}
      </div>
      <div class="box"><h3>MELHOR VENDA</h3>
        ${c?.sale ? `<div class="big-number">${esc(c.saleCity)}</div>
          <div class="city"><span>Preço</span><b>${fmt(c.sale)}</b></div>
          <div class="city"><span>ROI</span><b>${pct(c.roi)}</b></div>
          <div class="city"><span>Qualidade</span><b>${esc(QUALITY_NAMES[c.saleQuality] || c.saleQuality)}</b></div>` :
          `<div class="empty">Sem preço de venda.</div>`}
      </div>
    </div>`;
  if (scroll) $("details").scrollIntoView({behavior:"smooth", block:"start"});
}

async function refreshPrices() {
  const ids = idsNeeded(wanted());
  if (!ids.length) return;

  loading = true;
  progress = {done:0,total:ids.length};
  $("status").textContent = `Preços: 0/${ids.length} itens consultados...`;

  // Clear only the live price map; recipes are never touched.
  prices = new Map();
  const batches = [];
  for (let i=0; i<ids.length; i+=12) batches.push(ids.slice(i,i+12));

  let cursor = 0;
  const worker = async () => {
    while (cursor < batches.length) {
      const batch = batches[cursor++];
      await getBatch(batch);
      progress.done = Math.min(progress.done + batch.length, ids.length);
      $("status").textContent = `Preços: ${progress.done}/${ids.length} itens consultados...`;
      renderRows();
    }
  };

  await Promise.all(Array.from({length:Math.min(3,batches.length)}, worker));
  loading = false;
  $("status").textContent = `Preços concluídos: ${progress.done}/${ids.length}.`;
  renderRows();
}

async function loadData() {
  try {
    $("status").textContent = "A carregar receitas...";
    const res = await fetch("data/recipes.json?cache=" + Date.now(), {cache:"no-store"});
    if (!res.ok) throw new Error(`recipes.json HTTP ${res.status}`);
    recipes = await res.json();
    if (!Array.isArray(recipes)) throw new Error("recipes.json não é um array");
    fillFilters();
    renderRows();
    $("status").textContent = `${recipes.length.toLocaleString("pt-PT")} receitas carregadas. Carrega em ATUALIZAR PREÇOS.`;
  } catch (e) {
    console.error(e);
    $("status").textContent = "Erro ao carregar receitas: " + e.message;
  }
}

function bind() {
  $("refresh")?.addEventListener("click", refreshPrices);
  ["search","category","tier","enchant","quality","focus","tax","station","sort"].forEach(id => {
    $(id)?.addEventListener("input", renderRows);
    $(id)?.addEventListener("change", renderRows);
  });
}

bind();
loadData();
