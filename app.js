const CITIES=['Fort Sterling','Lymhurst','Bridgewatch','Martlock','Thetford','Caerleon','Brecilien'];
const CITY_BONUS={
'Fort Sterling':{base:18,special:['Hammer','Spear','Holy Staff','Plate Helmet','Cloth Armor']},
'Lymhurst':{base:18,special:['Sword','Bow','Arcane Staff','Leather Helmet','Leather Shoes']},
'Bridgewatch':{base:18,special:['Crossbow','Dagger','Cursed Staff','Plate Armor','Cloth Shoes']},
'Martlock':{base:18,special:['Axe','Quarterstaff','Frost Staff','Plate Shoes','Off-Hand']},
'Thetford':{base:18,special:['Mace','Nature Staff','Fire Staff','Leather Armor','Cloth Helmet']},
'Caerleon':{base:18,special:['Gathering Gear','Tool','Food','War Gloves','Shapeshifter Staff']},
'Brecilien':{base:18,special:['Cape','Bag','Potion']}
};
const API='https://europe.albion-online-data.com/api/v2/stats/prices/';
let recipes=[],items={},prices=new Map(),selected=null;
const $=id=>document.getElementById(id); const fmt=n=>Number.isFinite(n)?Math.round(n).toLocaleString('pt-PT'):'—';
const pct=n=>Number.isFinite(n)?n.toFixed(1)+'%':'—';
function norm(s){return String(s||'').toLowerCase().replace(/[_-]+/g,' ').replace(/[^a-z0-9áàâãéêíóôõúç .]/gi,'')}
function enchant(id){const m=String(id).match(/_LEVEL_?([1-4])$/i);return m?+m[1]:0}
function tier(id){const m=String(id).match(/^T([1-8])(?:_|$)/i);return m?+m[1]:null}
function rrr(prod){return 1-1/(1+prod/100)}
function production(city,recipe,focus){const rule=CITY_BONUS[city];const name=recipe.subcategory||recipe.category||recipe.name;const special=rule.special.some(x=>norm(name).includes(norm(x))||norm(recipe.name).includes(norm(x)))?15:0;return rule.base+special+(focus?59:0)}
function qprice(item,city,quality){const p=prices.get(item);if(!p)return null;return p.get(city+'|'+quality)||null}
async function loadData(){
 try{recipes=await fetch('data/recipes.json',{cache:'no-store'}).then(r=>r.json());items=await fetch('data/items.json',{cache:'no-store'}).then(r=>r.json());
 $('status').textContent=`${recipes.length.toLocaleString('pt-PT')} receitas carregadas. A consultar preços Europe...`; fillFilters(); await refreshPrices();
 }catch(e){$('status').textContent='Erro ao carregar a base. No GitHub, executa o workflow de sincronização.';console.error(e)}
}
function fillFilters(){const cats=[...new Set(recipes.map(r=>r.category).filter(Boolean))].sort();$('category').innerHTML='<option value="">Todas</option>'+cats.map(x=>`<option>${esc(x)}</option>`).join('');}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function wanted(){let a=recipes.slice();const q=norm($('search').value),cat=$('category').value,t=$('tier').value,e=$('enchant').value;if(q)a=a.filter(r=>norm(r.name).includes(q)||norm(r.uniqueName).includes(q));if(cat)a=a.filter(r=>r.category===cat);if(t)a=a.filter(r=>String(r.tier)===t);if(e)a=a.filter(r=>String(r.enchantment)===e);return a}
async function refreshPrices(){
 const ids=[...new Set(wanted().map(r=>r.uniqueName))];prices.clear(); if(!ids.length){render();return}
 const q=+$('quality').value; let last='—';
 for(let i=0;i<ids.length;i+=15){const batch=ids.slice(i,i+15);const url=API+batch.map(encodeURIComponent).join(',')+'.json?locations='+CITIES.map(encodeURIComponent).join(',')+'&qualities='+q;try{const data=await fetch(url).then(r=>r.json());for(const x of data){if(!x.item_id||!x.city)continue;const key=x.item_id; if(!prices.has(key))prices.set(key,new Map()); prices.get(key).set(x.city+'|'+x.quality,{sell:x.sell_price_min,sellDate:x.sell_price_min_date,buy:x.buy_price_max,buyDate:x.buy_price_max_date}); last=x.sell_price_min_date||last}}catch(e){console.warn(e)} $('status').textContent=`Preços: ${Math.min(i+15,ids.length)}/${ids.length} itens consultados...`}
 $('updated').textContent=last==='—'?'—':new Date(last).toLocaleString('pt-PT');render();
}
function calc(r){const quality=+$('quality').value,focus=$('focus').value==='focus',tax=(+$('tax').value||0)/100,station=(+$('station').value||0)/100;let best=null;
 for(const craftCity of CITIES){const prod=production(craftCity,r,focus),rate=rrr(prod);let raw=0,missing=false;for(const m of r.ingredients){const pr=qprice(m.uniqueName,craftCity,quality)||qprice(m.uniqueName,'Caerleon',quality)||null;if(!pr||!pr.sell){missing=true;break}raw+=m.count*pr.sell*(1-rate)}const fee=(r.craftingSilver||0)+raw*station;const saleCities=[];for(const city of CITIES){const p=qprice(r.uniqueName,city,quality);if(p?.sell)saleCities.push({city,price:p.sell,date:p.sellDate})}if(missing||!saleCities.length)continue;const sale=saleCities.sort((a,b)=>b.price-a.price)[0];const net=sale.price*(1-tax);const profit=net-fee;const roi=fee?profit/fee*100:0;const candidate={craftCity,saleCity:sale.city,sale:sale.price,cost:fee,profit,roi,margin:net?sale.price?profit/net*100:0:0,rrr:rate*100,prod,saleDate:sale.date};if(!best||candidate.profit>best.profit)best=candidate}
 return best}
function render(){const a=wanted().map(r=>({r,c:calc(r)})).filter(x=>x.c);const sort=$('sort').value;a.sort((x,y)=>sort==='name'?x.r.name.localeCompare(y.r.name):y.c[sort]-x.c[sort]);$('count').textContent=wanted().length.toLocaleString('pt-PT');$('priced').textContent=a.length.toLocaleString('pt-PT');$('best').textContent=a[0]?fmt(a[0].c.profit):'—';$('resultInfo').textContent=`${a.length} oportunidades com preço disponível`;$('rows').innerHTML=a.slice(0,100).map(x=>`<tr><td><span class="item">${esc(x.r.name||x.r.uniqueName)}</span><span class="sub">${esc(x.r.uniqueName)}</span></td><td>T${x.r.tier||'?'}${x.r.enchantment?'.'+x.r.enchantment:'.0'}</td><td>${esc(x.c.craftCity)}</td><td>${esc(x.c.saleCity)}<span class="sub">${fmt(x.c.sale)} / un.</span></td><td class="num">${fmt(x.c.cost)}</td><td class="profit">${fmt(x.c.profit)}</td><td>${pct(x.c.roi)}</td><td>${pct(x.c.rrr)}</td><td><button class="open" data-id="${esc(x.r.uniqueName)}">Ver</button></td></tr>`).join('')||`<tr><td colspan="9" class="empty">Sem dados suficientes. Atualiza preços ou alarga os filtros.</td></tr>`;$('rows').querySelectorAll('.open').forEach(b=>b.onclick=()=>showDetail(b.dataset.id));}
function showDetail(id){const r=recipes.find(x=>x.uniqueName===id);if(!r)return;selected=r;const c=calc(r);$('details').innerHTML=`<div class="panel-head"><div><span class="kicker">RECEITA</span><h2>${esc(r.name||r.uniqueName)}</h2><span class="badge">${esc(r.uniqueName)}</span></div><span>${c?`Melhor: ${esc(c.craftCity)} → ${esc(c.saleCity)}`:'Sem preço suficiente'}</span></div><div class="detail-grid"><div class="box"><h3>MATERIAIS NECESSÁRIOS</h3>${r.ingredients.map(m=>{const name=items[m.uniqueName]?.name||m.uniqueName;return `<div class="material"><span>${esc(name)}<span class="sub">${esc(m.uniqueName)}</span></span><b>${fmt(m.count)}</b></div>`}).join('')}</div><div class="box"><h3>MELHOR CRAFT</h3>${c?`<div class="city"><span>Cidade</span><b>${esc(c.craftCity)}</b></div><div class="city"><span>RRR</span><b>${pct(c.rrr)}</b></div><div class="city"><span>Produção</span><b>${c.prod}%</b></div><div class="city"><span>Custo efetivo</span><b>${fmt(c.cost)}</b></div>`:'<p class="empty">Faltam preços de materiais.</p>'}</div><div class="box"><h3>MELHOR VENDA</h3>${c?`<div class="city"><span>Cidade</span><b>${esc(c.saleCity)}</b></div><div class="city"><span>Venda</span><b>${fmt(c.sale)}</b></div><div class="city"><span>Lucro líquido</span><b class="profit">${fmt(c.profit)}</b></div><div class="city"><span>ROI</span><b>${pct(c.roi)}</b></div><div class="city"><span>Preço observado</span><b>${c.saleDate?new Date(c.saleDate).toLocaleString('pt-PT'):'—'}</b></div>`:'<p class="empty">Sem preço de venda disponível.</p>'}</div></div>`}
$('refresh').onclick=refreshPrices;['search','category','tier','enchant','quality','focus','tax','station','sort'].forEach(id=>$(id).addEventListener('input',()=>id==='quality'||id==='focus'||id==='tax'||id==='station'||id==='search'||id==='category'||id==='tier'||id==='enchant'?render():render()));
loadData();
