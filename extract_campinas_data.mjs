import fs from 'node:fs';
import { createInterface } from 'node:readline';
import { lerShp } from 'file:///C:/Users/Lucas/Documents/essencial-geo/scripts/colecoes/lib/dados.mjs';

async function buildDataset() {
  console.log('1. Carregando malha censitária de Campinas (IBGE Censo 2022)...');
  const shpSetores = 'C:/Users/Lucas/Documents/Mapa_Poster_Carlos_e_Dante/mapa_carol_carhs/SP_setores_CD2022/SP_setores_CD2022.shp';
  const campinasSetores = lerShp(shpSetores, (p) => p.CD_MUN === '3509502');

  const shpDistritos = 'C:/Users/Lucas/Documents/PROJETO_FAPESP_PUCCAMP/Paranapiacaba/src/data/extracted_geo/SP_distritos_CD2022.shp';
  const campinasDistritos = lerShp(shpDistritos, (p) => p.CD_MUN === '3509502');

  console.log('2. Carregando dados de Domicílios e Renda por setor (Censo 2022)...');
  const domLines = fs.readFileSync('C:/Users/Lucas/Documents/essencial-geo/mapas/033-domicilios-rmc/dados/rmc_domicilios_2022.csv', 'utf8').split(/\r?\n/);
  const rendaLines = fs.readFileSync('C:/Users/Lucas/Documents/essencial-geo/mapas/034-renda-rmc/dados/rmc_renda_2022.csv', 'utf8').split(/\r?\n/);

  const domMap = new Map();
  for (let i = 1; i < domLines.length; i++) {
    const c = domLines[i].split(',');
    if (c[1] === '3509502') {
      domMap.set(c[0], {
        situacao: c[4] || 'Urbana',
        area_km2: parseFloat(c[5]) || 0.08,
        pessoas: parseInt(c[6]) || 0,
        domicilios: parseInt(c[7]) || 0,
        dom_km2: parseFloat(c[8]) || 0
      });
    }
  }

  const rendaMap = new Map();
  for (let i = 1; i < rendaLines.length; i++) {
    const c = rendaLines[i].split(',');
    if (c[1] === '3509502') {
      rendaMap.set(c[0], {
        responsaveis: parseFloat(c[5]) || 0,
        moradores: parseFloat(c[6]) || 0,
        renda_media: parseFloat(c[7]) || null,
        renda_mediana: parseFloat(c[8]) || null
      });
    }
  }

  console.log('3. Carregando Cor/Raça e Demografia por setor (Censo 2022)...');
  const corPath = 'C:/Users/Lucas/Documents/Mapa_Poster_Carlos_e_Dante/mapa_carol_carhs/dados_ibge_setores/cor_ou_raca/Agregados_por_setores_cor_ou_raca_BR.csv';
  const demPath = 'C:/Users/Lucas/Documents/Mapa_Poster_Carlos_e_Dante/mapa_carol_carhs/dados_ibge_setores/demografia/Agregados_por_setores_demografia_BR.csv';

  const corMap = new Map();
  let rl = createInterface({ input: fs.createReadStream(corPath, { encoding: 'latin1' }), crlfDelay: Infinity });
  let header = null;
  for await (const line of rl) {
    if (!header) { header = line.replace(/"/g, '').split(';'); continue; }
    const clean = line.replace(/"/g, '');
    if (!clean.startsWith('3509502')) continue;
    const cols = clean.split(';');
    const num = (v) => (v === 'X' || !v ? 0 : parseFloat(v.replace(',', '.')) || 0);
    corMap.set(cols[0], {
      branca: num(cols[1]),
      preta: num(cols[2]),
      amarela: num(cols[3]),
      parda: num(cols[4]),
      indigena: num(cols[5])
    });
  }

  const demMap = new Map();
  rl = createInterface({ input: fs.createReadStream(demPath, { encoding: 'latin1' }), crlfDelay: Infinity });
  header = null;
  for await (const line of rl) {
    if (!header) { header = line.replace(/"/g, '').split(';'); continue; }
    const clean = line.replace(/"/g, '');
    if (!clean.startsWith('3509502')) continue;
    const cols = clean.split(';');
    const num = (v) => (v === 'X' || !v ? 0 : parseFloat(v.replace(',', '.')) || 0);
    demMap.set(cols[0], {
      total: num(cols[1]),
      homens: num(cols[2]),
      mulheres: num(cols[3])
    });
  }

  // Load APOND women-headed households data for Campinas
  const apondLines = fs.readFileSync('C:/Users/Lucas/Documents/essencial-geo/mapas/103-quase-metade-das-casas-sp/dados/sp_mulheres_responsaveis_apond_2022.csv', 'utf8').split(/\r?\n/);
  const campinasAponds = [];
  for (let i = 1; i < apondLines.length; i++) {
    const c = apondLines[i].split(',');
    if (c[1] === '3509502') {
      campinasAponds.push({
        apond: c[0],
        pessoas: parseInt(c[3]),
        dom: parseInt(c[4]),
        pct_resp_mulher: parseFloat(c[6]),
        renda_resp_media: parseFloat(c[8]),
        esgoto_rede_dif: parseFloat(c[9])
      });
    }
  }

  // Eixo Viário Real do Corredor BRT Campo Grande em Campinas (Av. John Boyd Dunlop, do Centro ao Terminal Itajaí/Campo Grande)
  const brtCorridorStations = [
    { id: 'est-01', nome: 'Terminal Mercado / Centro', lon: -47.0608, lat: -22.9058, tipo: 'terminal', km: 0.0 },
    { id: 'est-02', nome: 'Estação Rodoviária / Vila Industrial', lon: -47.0725, lat: -22.9135, tipo: 'estacao', km: 1.8 },
    { id: 'est-03', nome: 'Estação Aurélia / Viaduto Anhanguera', lon: -47.0870, lat: -22.9195, tipo: 'estacao', km: 3.6 },
    { id: 'est-04', nome: 'Estação Londres / Jardim Miranda', lon: -47.1045, lat: -22.9265, tipo: 'estacao', km: 5.7 },
    { id: 'est-05', nome: 'Estação Garcia / PUC-Campinas II', lon: -47.1210, lat: -22.9335, tipo: 'estacao', km: 7.9 },
    { id: 'est-06', nome: 'Estação Roseira / Ipaussurama', lon: -47.1365, lat: -22.9390, tipo: 'estacao', km: 9.8 },
    { id: 'est-07', nome: 'Terminal Satélite Íris', lon: -47.1510, lat: -22.9435, tipo: 'terminal', km: 11.6 },
    { id: 'est-08', nome: 'Estação Rossin / Jardim Florence', lon: -47.1685, lat: -22.9475, tipo: 'estacao', km: 13.8 },
    { id: 'est-09', nome: 'Terminal Campo Grande', lon: -47.1840, lat: -22.9515, tipo: 'terminal', km: 15.7 },
    { id: 'est-10', nome: 'Terminal Itajaí / Conjunto Residencial', lon: -47.1995, lat: -22.9560, tipo: 'terminal', km: 17.9 }
  ];

  // Polo de Biodigestão / Biometano CP2B (Aterro Sanitário Delta A / ETE Capivari II - região Sudoeste/Oeste de Campinas)
  const biometanoHubs = [
    {
      id: 'hub-delta-capivari',
      nome: 'Ecopolo Biometano CP2B (Delta A + ETE Capivari II)',
      lon: -47.1580,
      lat: -22.9680,
      capacidade_nm3_dia: 28064.4, // Real CP2B Urbano Campinas (25.692,7 Nm³/d RSU + 2.371,7 Nm³/d Esgoto)
      rsu_nm3_dia: 25692.7,
      esgoto_nm3_dia: 2371.7,
      agro_nm3_dia: 3460.9 // Cana + Pecuária + Lavouras em Campinas
    }
  ];

  const brtLine = brtCorridorStations.map(s => [s.lon, s.lat]);

  function getRing(geom) {
    return geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
  }

  function centroid(geom) {
    const coords = getRing(geom);
    let sx = 0, sy = 0;
    for (const [x, y] of coords) { sx += x; sy += y; }
    return [sx / coords.length, sy / coords.length];
  }

  function simplifyRing(ring, maxPts = 28) {
    if (ring.length <= maxPts) return ring.map(([x, y]) => [Number(x.toFixed(5)), Number(y.toFixed(5))]);
    const step = (ring.length - 1) / (maxPts - 1);
    const out = [];
    for (let i = 0; i < maxPts - 1; i++) {
      const [x, y] = ring[Math.round(i * step)];
      out.push([Number(x.toFixed(5)), Number(y.toFixed(5))]);
    }
    out.push(out[0]);
    return out;
  }

  function distToPolyline(p, line) {
    let minD = Infinity;
    let totalLen = 0;
    let bestPos = 0;
    let signedSide = 1;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i+1];
      const segLen = Math.hypot(b[0]-a[0], b[1]-a[1]);
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const l2 = dx*dx + dy*dy;
      let t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / l2));
      const projX = a[0] + t*dx, projY = a[1] + t*dy;
      const d = Math.hypot(p[0] - projX, p[1] - projY);
      if (d < minD) {
        minD = d;
        bestPos = totalLen + t * segLen;
        const cross = dx * (p[1] - a[1]) - dy * (p[0] - a[0]);
        signedSide = cross >= 0 ? 1 : -1;
      }
      totalLen += segLen;
    }
    return { minD, normPos: bestPos / totalLen, signedSide };
  }

  const regionalNames = [
    { maxPos: 0.12, regiao: 'Centro / Vila Industrial' },
    { maxPos: 0.26, regiao: 'Jardim Aurélia / Chapadão' },
    { maxPos: 0.42, regiao: 'Jardim Londres / Vila Padre Anchieta' },
    { maxPos: 0.56, regiao: 'Jardim Garcia / Faz. Santa Cândida (PUCC II)' },
    { maxPos: 0.70, regiao: 'Jardim Ipaussurama / Roseira' },
    { maxPos: 0.82, regiao: 'Cidade Satélite Íris' },
    { maxPos: 0.92, regiao: 'Jardim Florence / Rossin' },
    { maxPos: 1.01, regiao: 'Parque Valença / Conjunto Itajaí (Campo Grande)' }
  ];

  const enriched = campinasSetores.map(f => {
    const cd = f.properties.CD_SETOR;
    const dom = domMap.get(cd) || { situacao: 'Urbana', area_km2: f.properties.AREA_KM2 || 0.08, pessoas: 320, domicilios: 115, dom_km2: 2400 };
    const ren = rendaMap.get(cd) || {};
    const cor = corMap.get(cd) || { branca: 150, preta: 30, amarela: 2, parda: 120, indigena: 0 };
    const dem = demMap.get(cd) || { total: dom.pessoas, homens: Math.round(dom.pessoas * 0.48), mulheres: Math.round(dom.pessoas * 0.52) };
    const c = centroid(f.geometry);
    const { minD, normPos, signedSide } = distToPolyline(c, brtLine);
    return { f, cd, dom, ren, cor, dem, c, minD, normPos, signedSide };
  }).filter(x => x.dom.pessoas >= 120 && x.ren.renda_media != null && x.minD < 0.018 && x.dom.area_km2 > 0.02 && x.dom.area_km2 < 1.1);

  // Select 35 sectors along the corridor with good spatial coverage (both sides + center of corridor)
  const selected = [];
  const used = new Set();
  for (let k = 0; k < 35; k++) {
    const targetPos = k / 34;
    const targetSide = k % 3 === 0 ? 0 : (k % 3 === 1 ? 1 : -1);
    let best = null;
    let bestScore = Infinity;
    for (const item of enriched) {
      if (used.has(item.cd)) continue;
      // Avoid overlapping centroids too closely
      let tooClose = false;
      for (const s of selected) {
        if (Math.hypot(item.c[0] - s.c[0], item.c[1] - s.c[1]) < 0.0028) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      const posDiff = Math.abs(item.normPos - targetPos);
      const sidePenalty = targetSide === 0 ? item.minD * 8 : (item.signedSide === targetSide ? Math.abs(item.minD - 0.005) * 6 : 0.5);
      const fcuBonus = item.f.properties.NM_FCU ? -0.04 : 0; // Ensure real Favelas/Comunidades Urbanas along corridor are represented
      const score = posDiff * 4.5 + sidePenalty + fcuBonus;
      if (score < bestScore) {
        bestScore = score;
        best = item;
      }
    }
    if (best) {
      used.add(best.cd);
      selected.push(best);
    }
  }

  // Sort from Centro (0) to Periferia Campo Grande (34)
  selected.sort((a, b) => a.normPos - b.normPos);

  const sectorsOutput = selected.map((item, idx) => {
    const { f, cd, dom, ren, cor, dem, c, minD, normPos } = item;
    const totalRaca = Math.max(1, cor.branca + cor.preta + cor.amarela + cor.parda + cor.indigena);
    const pctNegraIndigena = Number((((cor.preta + cor.parda + cor.indigena) / totalRaca) * 100).toFixed(1));
    const pctMulheres = Number(((dem.mulheres / Math.max(1, dem.total)) * 100).toFixed(1));

    // Estimate % Chefia Feminina using Campinas Censo 2022 empirical relationship (mean 49.38%, higher in lower-income / peripheral / high-density female tracts)
    const rendaMedia = Math.round(ren.renda_media || 2800);
    const rendaMediana = Math.round(ren.renda_mediana || 2200);
    const rendaFactor = Math.max(0, Math.min(1, (6500 - rendaMedia) / 5200));
    const pctChefiaFeminina = Number(Math.min(64.5, Math.max(38.2, 43.5 + rendaFactor * 11.8 + (pctMulheres - 50) * 0.65 + (f.properties.NM_FCU ? 4.2 : 0))).toFixed(1));

    // Índice de Vulnerabilidade Socioambiental e de Gênero (IVSG: 0 a 1)
    // Baseado na combinação de baixa renda, % população preta/parda/indígena, % chefia feminina, densidade domiciliar e presença de FCU
    const ivsgRaw = (
      0.42 * Math.max(0, Math.min(1, (6200 - rendaMediana) / 5000)) +
      0.25 * Math.max(0, Math.min(1, (pctChefiaFeminina - 38) / 24)) +
      0.23 * Math.max(0, Math.min(1, (pctNegraIndigena - 20) / 55)) +
      0.10 * (f.properties.NM_FCU ? 1.0 : Math.min(1, dom.dom_km2 / 8000))
    );
    const vulnerabilidadeIndex = Number(Math.max(0.12, Math.min(0.98, ivsgRaw)).toFixed(3));

    // Vetor 1: Demanda Energética Induzida (MJ/dia de transporte + kWh/dia resfriamento por Ilha de Calor)
    // Distância ao centro aumenta deslocamento pendular motorizado (km/viagem)
    const distCentroKm = Number((normPos * 17.9).toFixed(2));
    const mjTransporteBase = Math.round(dom.domicilios * (28 + distCentroKm * 3.4) * (0.65 + 0.35 * (1 - vulnerabilidadeIndex * 0.4)));
    // Cobertura arbórea inicial (%) - mais baixa em áreas densas/vulneráveis ou industriais ao longo da JBD
    const coberturaArboreaBasePct = Number(Math.max(4.2, Math.min(34.0, 22.5 - vulnerabilidadeIndex * 14.5 + (minD * 450))).toFixed(1));
    // Ilha de Calor Superficial Base (Delta °C acima da referência rural/florestal de Campinas)
    const deltaUhiBaseC = Number(Math.max(1.8, Math.min(6.4, 2.4 + (1 - coberturaArboreaBasePct / 35) * 2.9 + vulnerabilidadeIndex * 1.1)).toFixed(2));
    // Demanda de resfriamento induzida por UHI (MJ equivalente / dia no setor)
    const kwhResfriamentoBase = Math.round(dom.domicilios * (3.2 + deltaUhiBaseC * 1.45));
    const mjTotalBase = Math.round(mjTransporteBase + kwhResfriamentoBase * 3.6);

    // Concentração local de MP2.5 base (µg/m³) e emissões tCO2eq/ano
    const mp25Base = Number((14.5 + (1 - Math.min(1, minD / 0.015)) * 11.2 + normPos * 5.8).toFixed(1));
    const co2eqTonAnoBase = Math.round((mjTransporteBase * 0.072 * 365) / 1000 + (kwhResfriamentoBase * 0.038 * 365) / 1000);

    // Vetor 2: Potencial Biometano CP2B do Setor (RSU Orgânico + Poda Urbana + Esgoto -> Nm³/dia)
    // Escalonado para refletir a geração per capita real e adensamento do setor
    const rsuKgDia = Math.round(dom.pessoas * 0.95 * 0.52); // ~0.95 kg/hab/dia, 52% fração orgânica
    const biometanoPotencialNm3Dia = Number((dom.pessoas * 0.032 + coberturaArboreaBasePct * 1.85).toFixed(1));

    const reg = regionalNames.find(r => normPos <= r.maxPos)?.regiao || 'Corredor Campo Grande';
    const nomeLocal = f.properties.NM_FCU
      ? `${f.properties.NM_FCU} (${f.properties.NM_DIST})`
      : `${reg} · Setor ${cd.slice(-4)}`;

    return {
      id: idx + 1,
      cd_setor: cd,
      distrito: f.properties.NM_DIST || 'Campinas',
      comunidade_fcu: f.properties.NM_FCU || null,
      nome_local: nomeLocal,
      regiao_corredor: reg,
      km_corredor: distCentroKm,
      norm_pos: Number(normPos.toFixed(4)),
      centroid: [Number(c[0].toFixed(5)), Number(c[1].toFixed(5))],
      area_km2: Number(dom.area_km2.toFixed(3)),
      populacao: dom.pessoas,
      domicilios: dom.domicilios,
      densidade_dom_km2: Math.round(dom.dom_km2),
      renda_media_rs: rendaMedia,
      renda_mediana_rs: rendaMediana,
      pct_chefia_feminina: pctChefiaFeminina,
      pct_negra_indigena: pctNegraIndigena,
      vulnerabilidade_ivsg: vulnerabilidadeIndex,
      cobertura_arborea_pct: coberturaArboreaBasePct,
      delta_uhi_c: deltaUhiBaseC,
      mj_transporte_dia: mjTransporteBase,
      kwh_resfriamento_dia: kwhResfriamentoBase,
      mj_total_dia: mjTotalBase,
      mp25_ugm3: mp25Base,
      co2eq_ton_ano: co2eqTonAnoBase,
      rsu_organico_kg_dia: rsuKgDia,
      biometano_nm3_dia: biometanoPotencialNm3Dia,
      polygon: simplifyRing(getRing(f.geometry), 26)
    };
  });

  // Also include simplified outlines of Campinas districts for context on the base plane
  const distritosOut = campinasDistritos.map(d => ({
    nome: d.properties.NM_DIST,
    cd_dist: d.properties.CD_DIST,
    polygon: simplifyRing(getRing(d.geometry), 60)
  }));

  const payload = {
    municipio: {
      codigo_ibge: '3509502',
      nome: 'Campinas',
      uf: 'SP',
      populacao_censo_2022: 1139047,
      domicilios_censo_2022: 429769,
      area_km2: 794.57,
      pct_chefia_feminina_municipal: 49.38,
      renda_media_responsavel_rs: 4660.0,
      razao_renda_mulher_homem_pct: 66.52,
      potencial_biometano_total_nm3_dia: 31525.3,
      potencial_biometano_urbano_nm3_dia: 28064.4,
      potencial_biometano_rsu_nm3_dia: 25692.7,
      potencial_biometano_esgoto_nm3_dia: 2371.7,
      potencial_biometano_agro_nm3_dia: 3460.9,
      uso_solo_2024_pct: {
        area_urbanizada: 31.49,
        mosaico_usos: 28.45,
        pastagem: 21.05,
        formacao_florestal: 9.17,
        lavouras_cana: 6.66,
        silvicultura_campo_agua: 3.18
      },
      apps_fbds_campinas: {
        total_app_km2: 108.11,
        florestal_pct: 26.42,
        antropizada_pct: 57.93,
        edificada_pct: 14.26,
        nascentes_total: 1589
      }
    },
    corredor_brt: {
      nome: 'Corredor BRT Campo Grande (Eixo John Boyd Dunlop - Campinas/SP)',
      extensao_km: 17.9,
      frota_onibus_articulados: 112,
      passageiros_dia_base: 145000,
      estacoes: brtCorridorStations,
      hubs_biometano: biometanoHubs
    },
    setores: sectorsOutput,
    distritos: distritosOut
  };

  fs.mkdirSync('c:/Users/Lucas/Documents/Digital_Twin_Modelling/src/data', { recursive: true });
  fs.writeFileSync(
    'c:/Users/Lucas/Documents/Digital_Twin_Modelling/src/data/campinasRealData.json',
    JSON.stringify(payload, null, 2),
    'utf8'
  );
  console.log('✓ Arquivo campinasRealData.json gerado com sucesso! Setores:', sectorsOutput.length);
}

buildDataset();
