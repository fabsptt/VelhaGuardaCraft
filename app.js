// ============================================================
// VELHA GUARDA CRAFT - APP.JS
// Preços Albion com fallback de qualidade e preços parciais
// ============================================================

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

let recipes=[];
let items={};
let prices=new Map();
let loading=false;
let progress={done:0,total:0};
let lastPrice=0;

const $=id=>document.getElementById(id);

const fmt=n=>Number.isFinite(Number(n))
    ? Math.round(Number(n)).toLocaleString('pt-PT')
    :'—';

const pct=n=>Number.isFinite(Number(n))
    ? Number(n).toFixed(1)+'%'
    :'—';

function norm(s){
    return String(s||'')
        .toLowerCase()
        .replace(/[_-]+/g,' ')
        .replace(/[^a-z0-9áàâãéêíóôõúç .]/gi,'');
}

function rrr(p){
    return 1-1/(1+p/100);
}

function production(city,r,focus){
    const rule=CITY_BONUS[city] || {base:0,special:[]};
    const name=r.subcategory||r.category||r.name||'';

    const special=rule.special.some(x=>
        norm(name).includes(norm(x)) ||
        norm(r.name).includes(norm(x))
    ) ? 15 : 0;

    return rule.base+special+(focus?59:0);
}

function qprice(itemId,city,requestedQuality){
    const itemPrices=prices.get(itemId);
    if(!itemPrices) return null;

    const exact=itemPrices.get(city+'|'+requestedQuality);

    if(exact && (exact.sell>0 || exact.buy>0)){
        return {
            ...exact,
            requestedQuality,
            usedQuality:requestedQuality,
            fallback:false
        };
    }

    // Fallback: tenta qualquer qualidade disponível
    const order=[2,3,4,5,1];

    for(const quality of order){
        const p=itemPrices.get(city+'|'+quality);

        if(p && (p.sell>0 || p.buy>0)){
            return {
                ...p,
                requestedQuality,
                usedQuality:quality,
                fallback:true
            };
        }
    }

    return null;
}

function cacheKey(){
    return 'vgcraft-prices-v3';
}

function saveCache(){
    try{
        const o={
            timestamp:Date.now(),
            prices:{}
        };

        for(const [id,m] of prices){
            o.prices[id]=Object.fromEntries(m);
        }

        localStorage.setItem(
            cacheKey(),
            JSON.stringify(o)
        );
    }catch(e){
        console.warn('Cache:',e);
    }
}

function loadCache(){
    try{
        const o=JSON.parse(
            localStorage.getItem(cacheKey())||'null'
        );

        if(!o || Date.now()-o.timestamp>600000) return;

        for(const [id,v] of Object.entries(o.prices||{})){
            prices.set(
                id,
                new Map(Object.entries(v))
            );
        }

        lastPrice=o.timestamp;
    }catch(e){
        console.warn('Cache:',e);
    }
}

function esc(s){
    return String(s??'').replace(
        /[&<>"']/g,
        m=>({
            '&':'&amp;',
            '<':'&lt;',
            '>':'&gt;',
            '"':'&quot;',
            "'":'&#39;'
        }[m])
    );
}

function wanted(){
    let a=recipes.slice();

    const q=norm($('search')?.value);
    const cat=$('category')?.value||'';
    const t=$('tier')?.value||'';
    const e=$('enchant')?.value||'';

    if(q){
        a=a.filter(r=>
            norm(r.name).includes(q) ||
            norm(r.uniqueName).includes(q)
        );
    }

    if(cat){
        a=a.filter(r=>r.category===cat);
    }

    if(t){
        a=a.filter(r=>String(r.tier)===t);
    }

    if(e){
        a=a.filter(r=>String(r.enchantment)===e);
    }

    return a;
}

function fillFilters(){
    const cats=[
        ...new Set(
            recipes
                .map(r=>r.category)
                .filter(Boolean)
        )
    ].sort();

    if($('category')){
        $('category').innerHTML=
            '<option value="">Todas</option>'+
            cats.map(x=>`<option>${esc(x)}</option>`).join('');
    }
}

function idsNeeded(list){
    const s=new Set();

    for(const r of list){
        if(r.uniqueName) s.add(r.uniqueName);

        for(const m of r.ingredients||[]){
            if(m.uniqueName) s.add(m.uniqueName);
        }
    }

    return [...s];
}

async function getBatch(batch){
    if(!batch?.length) return;

    const itemList=batch
        .map(id=>encodeURIComponent(id))
        .join(',');

    const locations=CITIES
        .map(city=>encodeURIComponent(city))
        .join(',');

    // Pedimos todas as qualidades para permitir fallback
    const url=
        API+
        itemList+
        '.json?locations='+
        locations+
        '&qualities=1,2,3,4,5';

    try{
        const response=await fetch(url,{
            cache:'no-store'
        });

        if(!response.ok){
            console.warn(
                'API:',
                response.status,
                response.statusText
            );
            return;
        }

        const data=await response.json();

        if(!Array.isArray(data)) return;

        for(const x of data){

            if(!x.item_id || !x.city) continue;

            if(!prices.has(x.item_id)){
                prices.set(
                    x.item_id,
                    new Map()
                );
            }

            const map=prices.get(x.item_id);
            const quality=Number(x.quality)||1;

            const sell=
                Number(x.sell_price_min)||0;

            const buy=
                Number(x.buy_price_max)||0;

            map.set(
                x.city+'|'+quality,
                {
                    sell,
                    buy,
                    sellDate:x.sell_price_min_date||null,
                    buyDate:x.buy_price_max_date||null,
                    quality
                }
            );

            if(x.sell_price_min_date){
                const time=new Date(
                    x.sell_price_min_date
                ).getTime();

                if(Number.isFinite(time)){
                    lastPrice=Math.max(
                        lastPrice,
                        time
                    );
                }
            }
        }

    }catch(error){
        console.error(
            'Erro preços:',
            error
        );
    }
}

async function refreshPrices(){

    const ids=idsNeeded(wanted());

    if(!ids.length){
        render();
        return;
    }

    loading=true;

    progress={
        done:0,
        total:ids.length
    };

    render();

    const batches=[];

    for(
        let i=0;
        i<ids.length;
        i+=20
    ){
        batches.push(
            ids.slice(i,i+20)
        );
    }

    let cursor=0;

    async function worker(){

        while(true){

            const i=cursor++;

            if(i>=batches.length) return;

            const batch=batches[i];

            await getBatch(batch);

            progress.done=
                Math.min(
                    progress.done+batch.length,
                    ids.length
                );

            if($('status')){
                $('status').textContent=
                    `Preços: ${progress.done.toLocaleString('pt-PT')}/${ids.length.toLocaleString('pt-PT')} itens consultados...`;
            }

            // Mostra resultados logo que chegam
            render();
        }
    }

    await Promise.all(
        Array.from(
            {
                length:Math.min(
                    6,
                    batches.length
                )
            },
            worker
        )
    );

    loading=false;

    saveCache();

    if($('status')){
        $('status').textContent=
            `Preços actualizados. ${ids.length.toLocaleString('pt-PT')} itens analisados.`;
    }

    if($('updated')){
        $('updated').textContent=
            lastPrice
                ? new Date(lastPrice).toLocaleString('pt-PT')
                : '—';
    }

    render();
}

function bestMaterialPrice(
    itemId,
    requestedQuality
){
    let best=null;

    for(const city of CITIES){

        const p=qprice(
            itemId,
            city,
            requestedQuality
        );

        if(!p || !p.sell || p.sell<=0) continue;

        if(!best || p.sell<best.price){

            best={
                itemId,
                city,
                price:p.sell,
                quality:p.usedQuality,
                fallback:p.fallback,
                date:p.sellDate
            };
        }
    }

    return best;
}

function bestSalePrice(
    itemId,
    requestedQuality
){
    let best=null;

    for(const city of CITIES){

        const p=qprice(
            itemId,
            city,
            requestedQuality
        );

        if(!p || !p.sell || p.sell<=0) continue;

        if(!best || p.sell>best.price){

            best={
                city,
                price:p.sell,
                quality:p.usedQuality,
                fallback:p.fallback,
                date:p.sellDate
            };
        }
    }

    return best;
}

function calc(r){

    const requestedQuality=
        Number($('quality')?.value)||1;

    const focus=
        $('focus')?.value==='focus';

    const tax=
        (Number($('tax')?.value)||0)/100;

    const station=
        (Number($('station')?.value)||0)/100;

    if(
        !r ||
        !Array.isArray(r.ingredients) ||
        !r.ingredients.length
    ){
        return null;
    }

    let best=null;

    for(const craftCity of CITIES){

        const productionBonus=
            production(
                craftCity,
                r,
                focus
            );

        const returnRate=
            rrr(productionBonus);

        let materialCost=0;
        let missingMaterial=false;

        const materials=[];

        for(const material of r.ingredients){

            if(!material.uniqueName) continue;

            const price=
                bestMaterialPrice(
                    material.uniqueName,
                    requestedQuality
                );

            const quantity=
                Number(material.count)||0;

            if(!price){

                missingMaterial=true;

                materials.push({
                    itemId:material.uniqueName,
                    quantity,
                    price:null,
                    city:null
                });

                continue;
            }

            const cost=
                quantity*price.price;

            materialCost+=cost;

            materials.push({
                itemId:material.uniqueName,
                quantity,
                price:price.price,
                city:price.city,
                quality:price.quality,
                fallback:price.fallback
            });
        }

        const usableMaterials=
            materials.filter(
                m=>Number.isFinite(m.price)&&m.price>0
            );

        if(!usableMaterials.length) continue;

        const effectiveMaterialCost=
            materialCost*(1-returnRate);

        const craftingSilver=
            Number(r.craftingSilver)||0;

        const stationCost=
            effectiveMaterialCost*station;

        const totalCost=
            effectiveMaterialCost+
            craftingSilver+
            stationCost;

        const sale=
            bestSalePrice(
                r.uniqueName,
                requestedQuality
            );

        if(!sale){

            const candidate={
                craftCity,
                saleCity:'—',
                sale:0,
                cost:totalCost,
                profit:null,
                roi:null,
                margin:null,
                rrr:returnRate*100,
                prod:productionBonus,
                materials,
                missingMaterial,
                missingSale:true
            };

            if(
                !best ||
                best.profit===null
            ){
                best=candidate;
            }

            continue;
        }

        const netSale=
            sale.price*(1-tax);

        const profit=
            netSale-totalCost;

        const roi=
            totalCost>0
                ? profit/totalCost*100
                : 0;

        const margin=
            netSale>0
                ? profit/netSale*100
                : 0;

        const candidate={
            craftCity,
            saleCity:sale.city,
            sale:sale.price,
            cost:totalCost,
            profit,
            roi,
            margin,
            rrr:returnRate*100,
            prod:productionBonus,
            saleQuality:sale.quality,
            saleFallback:sale.fallback,
            saleDate:sale.date,
            materials,
            missingMaterial,
            missingSale:false
        };

        if(
            !best ||
            best.profit===null ||
            profit>best.profit
        ){
            best=candidate;
        }
    }

    return best;
}

function render(){

    const all=wanted();

    const a=all.map(r=>({
        r,
        c:calc(r)
    }));

    const sort=$('sort')?.value||'profit';

    a.sort((x,y)=>{

        if(sort==='name'){
            return String(
                x.r.name||x.r.uniqueName
            ).localeCompare(
                String(
                    y.r.name||y.r.uniqueName
                )
            );
        }

        return (
            Number(y.c?.[sort])||-Infinity
        )-
        (
            Number(x.c?.[sort])||-Infinity
        );
    });

    const priced=a.filter(
        x=>x.c
    );

    if($('count')){
        $('count').textContent=
            all.length.toLocaleString('pt-PT');
    }

    if($('priced')){
        $('priced').textContent=
            priced.length.toLocaleString('pt-PT');
    }

    if($('best')){
        $('best').textContent=
            priced[0]?.c?.profit!=null
                ? fmt(priced[0].c.profit)
                : '—';
    }

    if($('resultInfo')){
        $('resultInfo').textContent=
            loading
                ? `${priced.length} oportunidades calculadas • ${progress.done}/${progress.total} preços carregados`
                : `${priced.length} oportunidades com preço disponível`;
    }

    if(!$('rows')) return;

    $('rows').innerHTML=
        a.slice(0,100).map(x=>{

            const r=x.r;
            const c=x.c;

            if(!c){

                return `
                <tr>
                    <td>
                        <span class="item">
                            ${esc(r.name||r.uniqueName)}
                        </span>
                        <span class="sub">
                            ${esc(r.uniqueName)}
                        </span>
                    </td>
                    <td>
                        T${r.tier||'?'}${r.enchantment?'.'+r.enchantment:'.0'}
                    </td>
                    <td colspan="6">
                        <span class="price-loading">
                            ⏳ A consultar preços...
                        </span>
                    </td>
                    <td>
                        <button
                            class="open"
                            data-id="${esc(r.uniqueName)}">
                            Ver
                        </button>
                    </td>
                </tr>`;
            }

            return `
            <tr>
                <td>
                    <span class="item">
                        ${esc(r.name||r.uniqueName)}
                    </span>
                    <span class="sub">
                        ${esc(r.uniqueName)}
                    </span>
                </td>

                <td>
                    T${r.tier||'?'}${r.enchantment?'.'+r.enchantment:'.0'}
                </td>

                <td>
                    ${esc(c.craftCity)}
                </td>

                <td>
                    ${esc(c.saleCity)}
                    <span class="sub">
                        ${fmt(c.sale)} / un.
                    </span>
                </td>

                <td class="num">
                    ${fmt(c.cost)}
                </td>

                <td class="profit">
                    ${c.profit==null?'—':fmt(c.profit)}
                </td>

                <td>
                    ${c.roi==null?'—':pct(c.roi)}
                </td>

                <td>
                    ${pct(c.rrr)}
                </td>

                <td>
                    <button
                        class="open"
                        data-id="${esc(r.uniqueName)}">
                        Ver
                    </button>
                </td>
            </tr>`;
        }).join('') ||
        `
        <tr>
            <td
                colspan="9"
                class="empty">
                Sem receitas para os filtros.
            </td>
        </tr>
        `;

    $('rows')
        .querySelectorAll('.open')
        .forEach(b=>{
            b.onclick=()=>{
                showDetail(
                    b.dataset.id
                );
            };
        });
}

function showDetail(id){

    const r=recipes.find(
        x=>x.uniqueName===id
    );

    if(!r || !$('details')) return;

    const c=calc(r);

    const q=
        Number($('quality')?.value)||1;

    $('details').innerHTML=`
        <div class="panel-head">

            <div>
                <span class="kicker">
                    RECEITA
                </span>

                <h2>
                    ${esc(r.name||r.uniqueName)}
                </h2>

                <span class="badge">
                    ${esc(r.uniqueName)}
                </span>
            </div>

            <span>
                ${
                    c
                        ? `Melhor: ${esc(c.craftCity)} → ${esc(c.saleCity)}`
                        : '⏳ A aguardar preços'
                }
            </span>

        </div>

        <div class="detail-grid">

            <div class="box">

                <h3>
                    MATERIAIS NECESSÁRIOS
                </h3>

                ${
                    (r.ingredients||[])
                    .map(m=>{

                        const name=
                            items[m.uniqueName]?.name||
                            m.uniqueName;

                        const ps=
                            bestMaterialPrice(
                                m.uniqueName,
                                q
                            );

                        return `
                        <div class="material">

                            <span>
                                ${esc(name)}

                                <span class="sub">
                                    ${esc(m.uniqueName)}
                                </span>
                            </span>

                            <b>
                                ${fmt(m.count)}

                                <span class="sub">
                                    ${
                                        ps
                                            ? `${fmt(ps.price)} • ${esc(ps.city)}`
                                            : '⏳ preço'
                                    }
                                </span>
                            </b>

                        </div>`;
                    })
                    .join('')
                }

            </div>

            <div class="box">

                <h3>
                    MELHOR CRAFT
                </h3>

                ${
                    c
                        ? `
                        <div class="city">
                            <span>Cidade</span>
                            <b>${esc(c.craftCity)}</b>
                        </div>

                        <div class="city">
                            <span>RRR</span>
                            <b>${pct(c.rrr)}</b>
                        </div>

                        <div class="city">
                            <span>Produção</span>
                            <b>${c.prod}%</b>
                        </div>

                        <div class="city">
                            <span>Custo efectivo</span>
                            <b>${fmt(c.cost)}</b>
                        </div>
                        `
                        : `
                        <p class="empty">
                            Ainda faltam preços.
                        </p>
                        `
                }

            </div>

            <div class="box">

                <h3>
                    MELHOR VENDA
                </h3>

                ${
                    c && !c.missingSale
                        ? `
                        <div class="city">
                            <span>Cidade</span>
                            <b>${esc(c.saleCity)}</b>
                        </div>

                        <div class="city">
                            <span>Venda</span>
                            <b>${fmt(c.sale)}</b>
                        </div>

                        <div class="city">
                            <span>Lucro líquido</span>
                            <b class="profit">
                                ${c.profit==null?'—':fmt(c.profit)}
                            </b>
                        </div>

                        <div class="city">
                            <span>ROI</span>
                            <b>${c.roi==null?'—':pct(c.roi)}</b>
                        </div>
                        `
                        : `
                        <p class="empty">
                            Sem preço de venda disponível.
                        </p>
                        `
                }

            </div>

        </div>
    `;
}


// ============================================================
// EVENTOS
// ============================================================

if($('refresh')){

    $('refresh').onclick=()=>{

        prices.clear();

        try{
            localStorage.removeItem(
                cacheKey()
            );
        }catch(e){}

        refreshPrices();
    };
}

[
    'search',
    'category',
    'tier',
    'enchant',
    'focus',
    'tax',
    'station',
    'sort'
].forEach(id=>{

    $(id)?.addEventListener(
        'input',
        render
    );
});

if($('quality')){

    $('quality').addEventListener(
        'change',
        ()=>{
            prices.clear();
            render();
            refreshPrices();
        }
    );
}


// ============================================================
// ARRANQUE
// ============================================================

async function loadData(){

    try{

        recipes=
            await fetch(
                'data/recipes.json',
                {cache:'no-store'}
            ).then(r=>{

                if(!r.ok)
                    throw new Error(
                        'recipes.json: '+r.status
                    );

                return r.json();
            });

        items=
            await fetch(
                'data/items.json',
                {cache:'no-store'}
            ).then(r=>{

                if(!r.ok)
                    throw new Error(
                        'items.json: '+r.status
                    );

                return r.json();
            });

        fillFilters();

        if($('status')){
            $('status').textContent=
                `${recipes.length.toLocaleString('pt-PT')} receitas carregadas. A preparar preços...`;
        }

        loadCache();

        render();

        refreshPrices();

    }catch(e){

        console.error(e);

        if($('status')){
            $('status').textContent=
                'Erro ao carregar recipes.json/items.json.';
        }
    }
}

loadData();
