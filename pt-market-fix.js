// Velha Guarda Craft - correções de IDs de mercado e nomes PT-PT
(() => {
  const nativeFetch = window.fetch.bind(window);

  // Os ingredientes encantados do dump usam *_LEVEL1/2/3,
  // mas o AODP identifica-os como *_LEVEL1@1, *_LEVEL2@2, *_LEVEL3@3.
  function marketId(id) {
    const s = String(id || "");
    if (/@[0-4]$/.test(s)) return s;
    const m = s.match(/^(.*_LEVEL)([1-4])$/i);
    return m ? `${m[1]}${m[2]}@${m[2]}` : s;
  }

  const TIER_NAMES = {
    2: "Aprendiz",
    3: "Jornaleiro",
    4: "Adept",
    5: "Especialista",
    6: "Mestre",
    7: "Grão-Mestre",
    8: "Ancião"
  };

  const EXACT = {
    "T2_PLANKS": "Tábuas de Pinho", "T3_PLANKS": "Tábuas de Bétula", "T4_PLANKS": "Tábuas de Castanheiro",
    "T5_PLANKS": "Tábuas de Bloodoak", "T6_PLANKS": "Tábuas de Ashenbark", "T7_PLANKS": "Tábuas de Pau-branco", "T8_PLANKS": "Tábuas de Pau-ancião",
    "T2_METALBAR": "Barra de Cobre", "T3_METALBAR": "Barra de Bronze", "T4_METALBAR": "Barra de Aço", "T5_METALBAR": "Barra de Aço de Titânio",
    "T6_METALBAR": "Barra de Aço Rúnica", "T7_METALBAR": "Barra de Aço Meteorítica", "T8_METALBAR": "Barra de Aço Adamantina",
    "T2_LEATHER": "Couro Cru", "T3_LEATHER": "Couro Robusto", "T4_LEATHER": "Couro", "T5_LEATHER": "Couro Reforçado",
    "T6_LEATHER": "Couro Resiliente", "T7_LEATHER": "Couro Espesso", "T8_LEATHER": "Couro Fortificado",
    "T2_CLOTH": "Pano Simples", "T3_CLOTH": "Pano", "T4_CLOTH": "Tecido Fino", "T5_CLOTH": "Tecido Ornado",
    "T6_CLOTH": "Tecido Luxuoso", "T7_CLOTH": "Tecido Opulento", "T8_CLOTH": "Tecido Barroco",
    "T2_ORE": "Minério de Cobre", "T3_ORE": "Minério de Bronze", "T4_ORE": "Minério de Ferro", "T5_ORE": "Minério de Titânio",
    "T6_ORE": "Minério de Rúnio", "T7_ORE": "Minério de Meteorito", "T8_ORE": "Minério de Adamantium",
    "T2_WOOD": "Troncos de Pinheiro", "T3_WOOD": "Troncos de Bétula", "T4_WOOD": "Troncos de Castanheiro",
    "T5_WOOD": "Troncos de Bloodoak", "T6_WOOD": "Troncos de Ashenbark", "T7_WOOD": "Troncos de Pau-branco", "T8_WOOD": "Troncos de Pau-ancião",
    "T2_FIBER": "Fibra de Algodão", "T3_FIBER": "Fibra de Cânhamo", "T4_FIBER": "Fibra de Linho", "T5_FIBER": "Fibra de Seda",
    "T6_FIBER": "Fibra de Lã", "T7_FIBER": "Fibra de Algodão Fantasma", "T8_FIBER": "Fibra de Seda Encantada",
    "T2_STONEBLOCK": "Bloco de Calcário", "T3_STONEBLOCK": "Bloco de Arenito", "T4_STONEBLOCK": "Bloco de Travertino",
    "T5_STONEBLOCK": "Bloco de Granito", "T6_STONEBLOCK": "Bloco de Basalto", "T7_STONEBLOCK": "Bloco de Mármore", "T8_STONEBLOCK": "Bloco de Ardósia"
  };

  const WORDS = [
    [/\bDual Swords\b/gi, "Espadas Duplas"], [/\bBroadsword\b/gi, "Espada Larga"], [/\bClaymore\b/gi, "Claymore"],
    [/\bCarving Sword\b/gi, "Espada de Talha"], [/\bInfinity Blade\b/gi, "Lâmina do Infinito"], [/\bKingmaker\b/gi, "Criador de Reis"],
    [/\bDagger Pair\b/gi, "Par de Adagas"], [/\bDagger\b/gi, "Adaga"], [/\bBloodletter\b/gi, "Sanguinária"],
    [/\bClaws\b/gi, "Garras"], [/\bSpear\b/gi, "Lança"], [/\bPike\b/gi, "Pique"], [/\bGlaive\b/gi, "Gládio"],
    [/\bBow\b/gi, "Arco"], [/\bCrossbow\b/gi, "Besta"], [/\bLight Crossbow\b/gi, "Besta Ligeira"],
    [/\bHammer\b/gi, "Martelo"], [/\bGreat Hammer\b/gi, "Grande Martelo"], [/\bPolehammer\b/gi, "Martelo de Haste"],
    [/\bMace\b/gi, "Maça"], [/\bHeavy Mace\b/gi, "Maça Pesada"], [/\bMorning Star\b/gi, "Estrela da Manhã"],
    [/\bAxe\b/gi, "Machado"], [/\bBattleaxe\b/gi, "Machado de Batalha"], [/\bHalberd\b/gi, "Alabarda"],
    [/\bQuarterstaff\b/gi, "Bastão"], [/\bDouble Bladed Staff\b/gi, "Bastão de Duas Lâminas"],
    [/\bHoly Staff\b/gi, "Cajado Sagrado"], [/\bNature Staff\b/gi, "Cajado da Natureza"], [/\bArcane Staff\b/gi, "Cajado Arcano"],
    [/\bFire Staff\b/gi, "Cajado de Fogo"], [/\bFrost Staff\b/gi, "Cajado de Gelo"], [/\bCursed Staff\b/gi, "Cajado Amaldiçoado"],
    [/\bInfernal Staff\b/gi, "Cajado Infernal"], [/\bWildfire Staff\b/gi, "Cajado do Fogo Selvagem"],
    [/\bShadowcaller\b/gi, "Chamador de Sombras"], [/\bEnigmatic Staff\b/gi, "Cajado Enigmático"],
    [/\bBrawler Gloves\b/gi, "Luvas de Lutador"], [/\bBattle Bracers\b/gi, "Braçadeiras de Batalha"],
    [/\bWar Gloves\b/gi, "Luvas de Guerra"], [/\bSpiked Gauntlets\b/gi, "Manoplas com Espinhos"],
    [/\bMercenary Jacket\b/gi, "Casaco de Mercenário"], [/\bHunter Jacket\b/gi, "Casaco de Caçador"], [/\bAssassin Jacket\b/gi, "Casaco de Assassino"],
    [/\bStalker Jacket\b/gi, "Casaco de Perseguidor"], [/\bHellion Jacket\b/gi, "Casaco de Hellion"],
    [/\bMercenary Hood\b/gi, "Capuz de Mercenário"], [/\bHunter Hood\b/gi, "Capuz de Caçador"], [/\bAssassin Hood\b/gi, "Capuz de Assassino"],
    [/\bMercenary Shoes\b/gi, "Sapatos de Mercenário"], [/\bHunter Shoes\b/gi, "Sapatos de Caçador"], [/\bAssassin Shoes\b/gi, "Sapatos de Assassino"],
    [/\bSoldier Armor\b/gi, "Armadura de Soldado"], [/\bGuardian Armor\b/gi, "Armadura de Guardião"],
    [/\bPlate Helmet\b/gi, "Elmo de Placas"], [/\bPlate Armor\b/gi, "Armadura de Placas"], [/\bPlate Boots\b/gi, "Botas de Placas"],
    [/\bLeather Helmet\b/gi, "Elmo de Couro"], [/\bLeather Armor\b/gi, "Armadura de Couro"], [/\bLeather Shoes\b/gi, "Botas de Couro"],
    [/\bCloth Helmet\b/gi, "Elmo de Pano"], [/\bCloth Armor\b/gi, "Armadura de Pano"], [/\bCloth Shoes\b/gi, "Botas de Pano"],
    [/\bCape\b/gi, "Capa"], [/\bBag\b/gi, "Bolsa"], [/\bShield\b/gi, "Escudo"], [/\bTorch\b/gi, "Tocha"],
    [/\bBook\b/gi, "Livro"], [/\bTome\b/gi, "Tomo"], [/\bOrb\b/gi, "Orbe"], [/\bMistcaller\b/gi, "Chamador de Névoa"],
    [/\bPotion\b/gi, "Poção"], [/\bPoison\b/gi, "Veneno"], [/\bStew\b/gi, "Guisado"], [/\bSoup\b/gi, "Sopa"],
    [/\bOmelette\b/gi, "Omelete"], [/\bPie\b/gi, "Tarte"], [/\bSandwich\b/gi, "Sanduíche"], [/\bSalad\b/gi, "Salada"],
    [/\bHorse\b/gi, "Cavalo"], [/\bOx\b/gi, "Boi"], [/\bDirewolf\b/gi, "Lobo Terrível"], [/\bMammoth\b/gi, "Mamute"],
    [/\bAdept's\b/gi, "do Adepto"], [/\bExpert's\b/gi, "do Especialista"], [/\bMaster's\b/gi, "do Mestre"],
    [/\bGrandmaster's\b/gi, "do Grão-Mestre"], [/\bElder's\b/gi, "do Ancião"], [/\bNovice's\b/gi, "do Novato"], [/\bJourneyman's\b/gi, "do Jornaleiro"]
  ];

  function ptName(item) {
    const id = String(item?.uniqueName || item?.item_id || "");
    const base = id.replace(/@\d+$/, "").replace(/_LEVEL[1-4]$/i, "");
    if (EXACT[base]) {
      const level = id.match(/_LEVEL([1-4])(?:@([1-4]))?$/i);
      if (level) {
        const q = Number(level[1]);
        const adjective = ["", "Incomum", "Raro", "Excecional", "Lendário"][q] || "";
        return `${EXACT[base]} ${adjective}`.trim();
      }
      return EXACT[base];
    }

    let name = String(item?.name || item?.uniqueName || "Item");
    const rank = name.match(/^(Novice's|Journeyman's|Adept's|Expert's|Master's|Grandmaster's|Elder's)\s+(.+)$/i);
    if (rank) {
      let body = rank[2];
      for (const [re, value] of WORDS) body = body.replace(re, value);
      const suffix = {
        "novice's":"do Novato", "journeyman's":"do Jornaleiro", "adept's":"do Adepto",
        "expert's":"do Especialista", "master's":"do Mestre", "grandmaster's":"do Grão-Mestre", "elder's":"do Ancião"
      }[rank[1].toLowerCase()] || "";
      return `${body} ${suffix}`.trim();
    }
    for (const [re, value] of WORDS) name = name.replace(re, value);
    return name;
  }

  window.__vgPtName = ptName;

  window.fetch = async function(input, init) {
    const requestUrl = typeof input === "string" ? input : input?.url || "";

    // Corrige os IDs dos materiais encantados antes de consultar o AODP.
    if (requestUrl.includes("/api/v2/stats/prices/")) {
      const marker = "/api/v2/stats/prices/";
      const start = requestUrl.indexOf(marker) + marker.length;
      const end = requestUrl.indexOf(".json", start);
      if (end > start) {
        const rawIds = requestUrl.slice(start, end).split(",").map(x => decodeURIComponent(x));
        const fixedIds = rawIds.map(marketId);
        const aliases = new Map(fixedIds.map((fixed, i) => [fixed, rawIds[i]]));
        const fixedUrl = requestUrl.slice(0, start) + fixedIds.map(encodeURIComponent).join(",") + requestUrl.slice(end);
        const response = await nativeFetch(fixedUrl, init);
        if (response.ok) {
          const data = await response.clone().json();
          if (Array.isArray(data)) {
            for (const row of data) {
              if (aliases.has(row.item_id)) row.item_id = aliases.get(row.item_id);
            }
            return new Response(JSON.stringify(data), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
          }
        }
        return response;
      }
    }

    // Traduz os nomes vindos do recipes.json sem alterar os IDs usados pela API.
    if (requestUrl.includes("data/recipes.json")) {
      const response = await nativeFetch(input, init);
      if (response.ok) {
        const data = await response.clone().json();
        if (Array.isArray(data)) {
          for (const item of data) item.name = ptName(item);
          return new Response(JSON.stringify(data), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        }
      }
      return response;
    }

    return nativeFetch(input, init);
  };
})();
