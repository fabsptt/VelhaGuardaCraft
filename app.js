// ===== Configuração =====
const SERVER_HOST = 'https://europe.albion-online-data.com'; // muda para west (Américas) ou east (Ásia) se a tua guilda jogar noutro servidor
const CHUNK_SIZE = 60; // itens por pedido (limite da API é 4096 caracteres de URL)
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutos

let RECIPES = [];
let state = {
  category: 'all',
  tier: 'all',
  ench: '0',
  search: '',
  cities: ['Caerleon', 'Bridgewatch', 'Lymhurst', 'Martlock', 'FortSterling', 'Thetford', 'Brecilien'],
  sortKey: 'profit',
  sortDir: 'desc',
  prices: {},      // id -> { city -> sell_price_min }
  volumes: {}       // id -> { city -> units }
};

const CITY_LABELS = {
  Caerleon: 'Caerleon', Bridgewatch: 'Bridgewatch', Lymhurst: 'Lymhurst',
  Martlock: 'Martlock', FortSterling: 'Fort Sterling', Thetford: 'Thetford', Brecilien: 'Brecilien'
};

// ===== Arranque =====
init();

async function init() {
  bindFilterChips('filter-category', v => state.category = v);
  bindFilterChips('filter-tier', v => state.tier = v);
  bindFilterChips('filter-ench', v => state.ench = v);
  bindFilterChips('filter-cities', v => toggleCity(v), true);

  document.getElementById('search-box').addEventListener('input', e => {
    state.search = e.target.value.toLowerCase().trim();
    renderProfitTable();
  });

  document.getElementById('btn-fetch').addEventListener('click', fetchAllPrices);
  document.getElementById('btn-clear-cache').addEventListener('click', () => {
    localStorage.removeItem('vg_price_cache');
    setStatus('Cache local apagada.');
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  document.querySelectorAll('#profit-table thead th').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
      } else {
        state.sortKey = key;
        state.sortDir = 'desc';
      }
      document.querySelectorAll('#profit-table thead th').forEach(h => h.classList.remove('sorted'));
      th.classList.add('sorted');
      renderProfitTable();
    });
  });

  setStatus('A carregar base de receitas...');
  try {
    const res = await fetch('recipes.json');
    RECIPES = await res.json();
    setStatus(`${RECIPES.length} receitas carregadas. Clica em "Atualizar Preços".`);
  } catch (e) {
    setStatus('Erro a carregar recipes.json — confirma que o ficheiro está na mesma pasta.');
  }
}

function bindFilterChips(containerId, onSelect, multi) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (multi) {
        chip.classList.toggle('active');
      } else {
        container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      }
      onSelect(chip.dataset.value);
      renderProfitTable();
    });
  });
}

function toggleCity(city) {
  const idx = state.cities.indexOf(city);
  if (idx >= 0) state.cities.splice(idx, 1);
  else state.cities.push(city);
}

function setStatus(msg) {
  document.getElementById('status-line').textContent = msg;
}

// ===== Seleção de receitas ativas segundo filtros =====
function getFilteredRecipes() {
  return RECIPES.filter(r => {
    if (state.category !== 'all' && r.tag !== state.category) return false;
    if (state.tier !== 'all' && String(r.tier) !== state.tier) return false;
    if (state.ench === '0' && r.ench !== 0) return false;
    if (state.search) {
      const name = r.name.toLowerCase();
      if (!name.includes(state.search)) return false;
    }
    return true;
  });
}

// ===== Buscar preços na API =====
async function fetchAllPrices() {
  const recipes = getFilteredRecipes();
  if (recipes.length === 0) {
    setStatus('Nenhum item corresponde aos filtros atuais.');
    return;
  }
  if (state.cities.length === 0) {
    setStatus('Seleciona pelo menos uma cidade.');
    return;
  }

  const idSet = new Set();
  recipes.forEach(r => {
    idSet.add(r.id);
    r.resources.forEach(res => idSet.add(res.id));
  });
  const ids = Array.from(idSet);

  const btn = document.getElementById('btn-fetch');
  btn.disabled = true;
  const progressBar = document.getElementById('progress-bar');
  progressBar.classList.add('active');
  const progressFill = progressBar.querySelector('div');

  const chunks = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) chunks.push(ids.slice(i, i + CHUNK_SIZE));

  const citiesParam = state.cities.join(',');
  let done = 0;
  const priceMap = {};

  setStatus(`A obter preços de ${ids.length} itens em ${chunks.length} pedidos...`);

  for (const chunk of chunks) {
    const idsParam = chunk.join(',');
    try {
      const priceUrl = `${SERVER_HOST}/api/v2/stats/prices/${idsParam}.json?locations=${citiesParam}&qualities=1`;
      const resp = await fetch(priceUrl);
      if (resp.ok) {
        const data = await resp.json();
        data.forEach(row => {
          if (!priceMap[row.item_id]) priceMap[row.item_id] = {};
          if (row.sell_price_min > 0) {
            priceMap[row.item_id][row.city] = row.sell_price_min;
          }
        });
      }
    } catch (e) {
      // ignora falhas de um chunk, continua com os restantes
    }

    done++;
    progressFill.style.width = Math.round((done / chunks.length) * 100) + '%';
    setStatus(`A obter preços... (${done}/${chunks.length} pedidos)`);
    await sleep(120); // pequena pausa entre pedidos para não sobrecarregar a API
  }

  state.prices = priceMap;
  localStorage.setItem('vg_price_cache', JSON.stringify({ ts: Date.now(), prices: priceMap }));

  progressBar.classList.remove('active');
  btn.disabled = false;
  setStatus(`Preços atualizados às ${new Date().toLocaleTimeString('pt-PT')}.`);

  renderProfitTable();
  fetchVolumes(recipes.map(r => r.id).slice(0, 150)); // volume só para os primeiros 150 itens visíveis, para poupar pedidos
}

async function fetchVolumes(ids) {
  if (ids.length === 0) return;
  const chunks = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) chunks.push(ids.slice(i, i + CHUNK_SIZE));
  const citiesParam = state.cities.join(',');
  const volumeMap = {};

  for (const chunk of chunks) {
    try {
      const url = `${SERVER_HOST}/api/v2/stats/history/${chunk.join(',')}.json?locations=${citiesParam}&time-scale=24&qualities=1`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        data.forEach(entry => {
          const total = (entry.data || []).reduce((sum, d) => sum + (d.item_count || 0), 0);
          if (!volumeMap[entry.item_id]) volumeMap[entry.item_id] = {};
          volumeMap[entry.item_id][entry.location] = total;
        });
      }
    } catch (e) { /* ignora */ }
    await sleep(120);
  }
  state.volumes = volumeMap;
  renderVolumeTable();
}

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

// ===== Cálculo de rentabilidade =====
function computeRows() {
  const recipes = getFilteredRecipes();
  const rows = [];

  recipes.forEach(r => {
    const sellPrices = state.prices[r.id] || {};
    state.cities.forEach(city => {
      const sell = sellPrices[city];
      if (!sell) return;

      let cost = 0;
      let missing = false;
      r.resources.forEach(res => {
        const p = (state.prices[res.id] || {})[city];
        if (!p) { missing = true; return; }
        cost += p * res.count;
      });
      if (missing || cost === 0) return;

      const profit = sell - cost;
      const roi = (profit / cost) * 100;

      rows.push({
        id: r.id, name: r.name, tier: r.tier, ench: r.ench, city, cost, sell, profit, roi
      });
    });
  });

  return rows;
}

function renderProfitTable() {
  const tbody = document.getElementById('profit-body');
  const rows = computeRows();

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Sem dados ainda — verifica os filtros ou clica em "Atualizar Preços".</td></tr>`;
    return;
  }

  rows.sort((a, b) => {
    let av = a[state.sortKey], bv = b[state.sortKey];
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    if (av < bv) return state.sortDir === 'asc' ? -1 : 1;
    if (av > bv) return state.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  tbody.innerHTML = rows.slice(0, 300).map(row => `
    <tr>
      <td class="item-name">${row.name}${row.ench > 0 ? `<span class="tier-badge">.${row.ench}</span>` : ''}</td>
      <td><span class="tier-badge">T${row.tier}</span></td>
      <td>${CITY_LABELS[row.city] || row.city}</td>
      <td>${fmt(row.cost)}</td>
      <td>${fmt(row.sell)}</td>
      <td class="${row.profit >= 0 ? 'profit-pos' : 'profit-neg'}">${row.profit >= 0 ? '+' : ''}${fmt(row.profit)}</td>
      <td class="${row.roi >= 0 ? 'profit-pos' : 'profit-neg'}">${row.roi.toFixed(1)}%</td>
    </tr>
  `).join('');
}

function renderVolumeTable() {
  const tbody = document.getElementById('volume-body');
  const rows = [];
  Object.keys(state.volumes).forEach(id => {
    const recipe = RECIPES.find(r => r.id === id);
    const name = recipe ? recipe.name : id;
    Object.entries(state.volumes[id]).forEach(([city, units]) => {
      if (units > 0) rows.push({ name, city, units });
    });
  });
  rows.sort((a, b) => b.units - a.units);

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-state">Sem dados de volume suficientes para os itens carregados.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.slice(0, 200).map(row => `
    <tr>
      <td class="item-name">${row.name}</td>
      <td>${CITY_LABELS[row.city] || row.city}</td>
      <td>${row.units}</td>
    </tr>
  `).join('');
}

function fmt(n) {
  return Math.round(n).toLocaleString('pt-PT');
}
