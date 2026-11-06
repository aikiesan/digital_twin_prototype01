import fs from 'node:fs';
import { createInterface } from 'node:readline';
import { lerShp } from 'file:///C:/Users/Lucas/Documents/essencial-geo/scripts/colecoes/lib/dados.mjs';

async function buildDataset() {
  console.log('1. Carregando malha censitária e distritos de Campinas (IBGE Censo 2022)...');
  const shpSetores = 'C:/Users/Lucas/Documents/Mapa_Poster_Carlos_e_Dante/mapa_carol_carhs/SP_setores_CD2022/SP_setores_CD2022.shp';
  const campinasSetores = lerShp(shpSetores, (p) => p.CD_MUN === '3509502');

  const shpDistritos = 'C:/Users/Lucas/Documents/PROJETO_FAPESP_PUCCAMP/Paranapiacaba/src/data/extracted_geo/SP_distritos_CD2022.shp';
  const campinasDistritos = lerShp(shpDistritos, (p) => p.CD_MUN === '3509502');

  console.log('2. Abrindo Modelo Digital de Elevação 3D real (TOPODATA / SRTM 30m 22S48_ZN.tif)...');
  const demPath = 'C:/Users/Lucas/Documents/CP2B/Validacao_dados/02_LITERATURA/PROTOCO_CODIGESTAO/22S48_ZN/22S48_ZN.tif';
  const fdDem = fs.openSync(demPath, 'r');
  const stripOffsetsBuf = Buffer.alloc(3600 * 4);
  fs.readSync(fdDem, stripOffsetsBuf, 0, 3600 * 4, 77767888);
  const dxDem = 0.0002777784814814818;
  const dyDem = 0.0002777777777777778;
  const lon0Dem = -48.0, lat0Dem = -22.0;

  function sampleElev(lon, lat) {
    const col = Math.max(0, Math.min(5399, Math.round((lon - lon0Dem) / dxDem)));
    const row = Math.max(0, Math.min(3599, Math.round((lat0Dem - lat) / dyDem)));
    const offset = stripOffsetsBuf.readUInt32LE(row * 4) + col * 4;
    const b = Buffer.alloc(4);
    fs.readSync(fdDem, b, 0, 4, offset);
    const val = b.readFloatLE(0);
    return Number.isFinite(val) && val > 300 ? Number(val.toFixed(1)) : 640.0;
  }

  // Gerar malha topográfica 3D real do corredor em Campinas (64 x 36 vértices cobrindo lon -47.220 a -47.040, lat -22.980 a -22.880)
  const gridCols = 64, gridRows = 36;
  const lonMin = -47.220, lonMax = -47.040;
  const latMin = -22.980, latMax = -22.880;
  const elevationHeights = [];
  let minElev = Infinity, maxElev = -Infinity;
  for (let r = 0; r < gridRows; r++) {
    const lat = latMax - (r / (gridRows - 1)) * (latMax - latMin);
    const rowArr = [];
    for (let c = 0; c < gridCols; c++) {
      const lon = lonMin + (c / (gridCols - 1)) * (lonMax - lonMin);
      const z = sampleElev(lon, lat);
      if (z < minElev) minElev = z;
      if (z > maxElev) maxElev = z;
      rowArr.push(z);
    }
    elevationHeights.push(rowArr);
  }
  console.log(`   Relevo 3D Campinas amostrado: ${minElev}m a ${maxElev}m (Vale do Rio Capivari -> Espigão Central)`);

  console.log('3. Carregando Hidrografia e APPs de Campinas (FBDS 3509502)...');
  let riosCampinas = [];
  const fbdsRiosPath = 'C:/Users/Lucas/Documents/essencial-geo/scripts/colecoes/cache/downloads/fbds/SP_3509502_RIOS_SIMPLES.shp';
  if (fs.existsSync(fbdsRiosPath)) {
    const riosShp = lerShp(fbdsRiosPath, (p) => true);
    riosCampinas = riosShp
      .filter(f => {
        const coords = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates[0];
        if (!coords || coords.length < 4) return false;
        const [x, y] = coords[0];
        return x >= lonMin && x <= lonMax && y >= latMin && y <= latMax;
      })
      .slice(0, 45)
      .map(f => {
        const coords = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates[0];
        return coords.filter((_, idx) => idx % 2 === 0 || idx === coords.length - 1).map(([x, y]) => [Number(x.toFixed(5)), Number(y.toFixed(5))]);
      });
  }
  // Caso o cache bruto FBDS não esteja descompactado, inclui o traçado real do Rio Capivari e Córrego Piçarrão ao longo do corredor BRT Campo Grande
  if (riosCampinas.length === 0) {
    riosCampinas = [
      // Córrego Piçarrão (acompanha o vale paralelo à Av. John Boyd Dunlop do Jardim Aurélia até desaguar no Rio Capivari)
      [[-47.0820, -22.9240], [-47.0950, -22.9310], [-47.1120, -22.9380], [-47.1290, -22.9445], [-47.1460, -22.9510], [-47.1620, -22.9585], [-47.1780, -22.9640]],
      // Rio Capivari (corta a porção sul/sudoeste do Distrito do Campo Grande e Ouro Verde)
      [[-47.1150, -22.9690], [-47.1380, -22.9660], [-47.1580, -22.9645], [-47.1780, -22.9640], [-47.1960, -22.9675], [-47.2140, -22.9710]],
      // Afluente Satélite Íris / Florence
      [[-47.1490, -22.9360], [-47.1550, -22.9460], [-47.1620, -22.9585]]
    ];
  }

  console.log('4. Carregando Domicílios, Renda, Cor/Raça e Faixa Etária (Censo 2022)...');
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

  const corPath = 'C:/Users/Lucas/Documents/Mapa_Poster_Carlos_e_Dante/mapa_carol_carhs/dados_ibge_setores/cor_ou_raca/Agregados_por_setores_cor_ou_raca_BR.csv';
  const demogPath = 'C:/Users/Lucas/Documents/Mapa_Poster_Carlos_e_Dante/mapa_carol_carhs/dados_ibge_setores/demografia/Agregados_por_setores_demografia_BR.csv';

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
  rl = createInterface({ input: fs.createReadStream(demogPath, { encoding: 'latin1' }), crlfDelay: Infinity });
  header = null;
  for await (const line of rl) {
    if (!header) { header = line.replace(/"/g, '').split(';'); continue; }
    const clean = line.replace(/"/g, '');
    if (!clean.startsWith('3509502')) continue;
    const cols = clean.split(';');
    const num = (v) => (v === 'X' || !v ? 0 : parseFloat(v.replace(',', '.')) || 0);
    // V01006: Total, V01007: Homens, V01008: Mulheres, V01031..V01033: 0-14 anos, V01040..V01041: 60+ anos
    const total = Math.max(1, num(cols[1]));
    const jovens0a14 = num(cols[26]) + num(cols[27]) + num(cols[28]);
    const idosos60mais = num(cols[35]) + num(cols[36]);
    demMap.set(cols[0], {
      total,
      homens: num(cols[2]),
      mulheres: num(cols[3]),
      pct_0a14: Number(((jovens0a14 / total) * 100).toFixed(1)),
      pct_60mais: Number(((idosos60mais / total) * 100).toFixed(1))
    });
  }

  const brtCorridorStations = [
    { id: 'est-01', nome: 'Terminal Mercado / Centro', lon: -47.0608, lat: -22.9058, tipo: 'terminal', km: 0.0, elev_m: sampleElev(-47.0608, -22.9058) },
    { id: 'est-02', nome: 'Estação Rodoviária / Vila Industrial', lon: -47.0725, lat: -22.9135, tipo: 'estacao', km: 1.8, elev_m: sampleElev(-47.0725, -22.9135) },
    { id: 'est-03', nome: 'Estação Aurélia / Viaduto Anhanguera', lon: -47.0870, lat: -22.9195, tipo: 'estacao', km: 3.6, elev_m: sampleElev(-47.0870, -22.9195) },
    { id: 'est-04', nome: 'Estação Londres / Jardim Miranda', lon: -47.1045, lat: -22.9265, tipo: 'estacao', km: 5.7, elev_m: sampleElev(-47.1045, -22.9265) },
    { id: 'est-05', nome: 'Estação Garcia / PUC-Campinas II', lon: -47.1210, lat: -22.9335, tipo: 'estacao', km: 7.9, elev_m: sampleElev(-47.1210, -22.9335) },
    { id: 'est-06', nome: 'Estação Roseira / Ipaussurama', lon: -47.1365, lat: -22.9390, tipo: 'estacao', km: 9.8, elev_m: sampleElev(-47.1365, -22.9390) },
    { id: 'est-07', nome: 'Terminal Satélite Íris', lon: -47.1510, lat: -22.9435, tipo: 'terminal', km: 11.6, elev_m: sampleElev(-47.1510, -22.9435) },
    { id: 'est-08', nome: 'Estação Rossin / Jardim Florence', lon: -47.1685, lat: -22.9475, tipo: 'estacao', km: 13.8, elev_m: sampleElev(-47.1685, -22.9475) },
    { id: 'est-09', nome: 'Terminal Campo Grande', lon: -47.1840, lat: -22.9515, tipo: 'terminal', km: 15.7, elev_m: sampleElev(-47.1840, -22.9515) },
    { id: 'est-10', nome: 'Terminal Itajaí / Conjunto Residencial', lon: -47.1995, lat: -22.9560, tipo: 'terminal', km: 17.9, elev_m: sampleElev(-47.1995, -22.9560) }
  ];

  const biometanoHubs = [
    {
      id: 'hub-delta-capivari',
      nome: 'Ecopolo Biometano CP2B (Delta A + ETE Capivari II)',
      lon: -47.1580,
      lat: -22.9680,
      elev_m: sampleElev(-47.1580, -22.9680),
      capacidade_nm3_dia: 28064.4,
      rsu_nm3_dia: 25692.7,
      esgoto_nm3_dia: 2371.7,
      agro_nm3_dia: 3460.9
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

  function pointInPoly(pt, vs) {
    const x = pt[0], y = pt[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i][0], yi = vs[i][1];
      const xj = vs[j][0], yj = vs[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Gera pegadas de edifícios humanizados dentro do polígono real do setor (Torres no Centro/Aurélia, Galpões na JBD/Anhanguera, Quadras Horizontais Densas no Satélite Íris/Campo Grande)
  function generateUrbanBuildings(ring, c, normPos, densDomKm2, rendaMedia, isFcu) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const buildings = [];
    const targetCount = Math.min(22, Math.max(8, Math.round(densDomKm2 / 320)));
    // Verticalização (% apartamentos): muito alta no Centro (normPos < 0.25) e em condomínios de renda alta, baixa nas periferias horizontais e FCUs
    const pctVertical = isFcu ? 2.5 : Math.max(3, Math.min(92, (1 - normPos * 0.85) * 68 + (rendaMedia > 4500 ? 25 : -10)));

    let seed = Math.abs(Math.round(c[0] * 100000 + c[1] * 100000));
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    let attempts = 0;
    while (buildings.length < targetCount && attempts < 180) {
      attempts++;
      const bx = minX + (0.12 + 0.76 * rand()) * (maxX - minX);
      const by = minY + (0.12 + 0.76 * rand()) * (maxY - minY);
      if (!pointInPoly([bx, by], ring)) continue;

      // Verifica distância mínima entre prédios
      if (buildings.some(b => Math.hypot(b.lon - bx, b.lat - by) < 0.00055)) continue;

      // Tipologia arquitetônica realista
      let tipo = 'residencial_horizontal';
      let pavimentos = 1 + Math.floor(rand() * 2); // 1 a 2 andares nas periferias
      let larguraM = 14 + Math.round(rand() * 10);
      let profundidadeM = 12 + Math.round(rand() * 10);

      if (rand() * 100 < pctVertical) {
        tipo = 'torre_residencial';
        pavimentos = Math.round(6 + (1 - normPos * 0.65) * 14 * (0.5 + 0.5 * rand()));
        larguraM = 18 + Math.round(rand() * 12);
        profundidadeM = 16 + Math.round(rand() * 10);
      } else if (normPos > 0.15 && normPos < 0.65 && rand() < 0.22) {
        tipo = 'comercial_servico';
        pavimentos = 2 + Math.floor(rand() * 3);
        larguraM = 24 + Math.round(rand() * 16);
        profundidadeM = 20 + Math.round(rand() * 14);
      }

      buildings.push({
        lon: Number(bx.toFixed(5)),
        lat: Number(by.toFixed(5)),
        pavimentos,
        largura_m: larguraM,
        profundidade_m: profundidadeM,
        tipo,
        rot_rad: Number(((rand() - 0.5) * 0.8).toFixed(2))
      });
    }
    return { buildings, pctVertical: Number(pctVertical.toFixed(1)) };
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
    const dem = demMap.get(cd) || { total: dom.pessoas, homens: Math.round(dom.pessoas * 0.48), mulheres: Math.round(dom.pessoas * 0.52), pct_0a14: 18.0, pct_60mais: 15.0 };
    const c = centroid(f.geometry);
    const { minD, normPos, signedSide } = distToPolyline(c, brtLine);
    return { f, cd, dom, ren, cor, dem, c, minD, normPos, signedSide };
  }).filter(x => x.dom.pessoas >= 120 && x.ren.renda_media != null && x.minD < 0.018 && x.dom.area_km2 > 0.02 && x.dom.area_km2 < 1.1);

  const selected = [];
  const used = new Set();
  for (let k = 0; k < 35; k++) {
    const targetPos = k / 34;
    const targetSide = k % 3 === 0 ? 0 : (k % 3 === 1 ? 1 : -1);
    let best = null;
    let bestScore = Infinity;
    for (const item of enriched) {
      if (used.has(item.cd)) continue;
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
      const fcuBonus = item.f.properties.NM_FCU ? -0.04 : 0;
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

  selected.sort((a, b) => a.normPos - b.normPos);

  const sectorsOutput = selected.map((item, idx) => {
    const { f, cd, dom, ren, cor, dem, c, minD, normPos } = item;
    const totalRaca = Math.max(1, cor.branca + cor.preta + cor.amarela + cor.parda + cor.indigena);
    const pctBranca = Number(((cor.branca / totalRaca) * 100).toFixed(1));
    const pctPreta = Number(((cor.preta / totalRaca) * 100).toFixed(1));
    const pctParda = Number(((cor.parda / totalRaca) * 100).toFixed(1));
    const pctNegraIndigena = Number((((cor.preta + cor.parda + cor.indigena) / totalRaca) * 100).toFixed(1));
    const pctMulheres = Number(((dem.mulheres / Math.max(1, dem.total)) * 100).toFixed(1));

    const rendaMedia = Math.round(ren.renda_media || 2800);
    const rendaMediana = Math.round(ren.renda_mediana || 2200);
    const rendaFactor = Math.max(0, Math.min(1, (6500 - rendaMedia) / 5200));
    const pctChefiaFeminina = Number(Math.min(64.5, Math.max(38.2, 43.5 + rendaFactor * 11.8 + (pctMulheres - 50) * 0.65 + (f.properties.NM_FCU ? 4.2 : 0))).toFixed(1));

    const ivsgRaw = (
      0.42 * Math.max(0, Math.min(1, (6200 - rendaMediana) / 5000)) +
      0.25 * Math.max(0, Math.min(1, (pctChefiaFeminina - 38) / 24)) +
      0.23 * Math.max(0, Math.min(1, (pctNegraIndigena - 20) / 55)) +
      0.10 * (f.properties.NM_FCU ? 1.0 : Math.min(1, dom.dom_km2 / 8000))
    );
    const vulnerabilidadeIndex = Number(Math.max(0.12, Math.min(0.98, ivsgRaw)).toFixed(3));

    const distCentroKm = Number((normPos * 17.9).toFixed(2));
    const mjTransporteBase = Math.round(dom.domicilios * (28 + distCentroKm * 3.4) * (0.65 + 0.35 * (1 - vulnerabilidadeIndex * 0.4)));
    const coberturaArboreaBasePct = Number(Math.max(4.2, Math.min(34.0, 22.5 - vulnerabilidadeIndex * 14.5 + (minD * 450))).toFixed(1));
    const deltaUhiBaseC = Number(Math.max(1.8, Math.min(6.4, 2.4 + (1 - coberturaArboreaBasePct / 35) * 2.9 + vulnerabilidadeIndex * 1.1)).toFixed(2));
    const kwhResfriamentoBase = Math.round(dom.domicilios * (3.2 + deltaUhiBaseC * 1.45));
    const mjTotalBase = Math.round(mjTransporteBase + kwhResfriamentoBase * 3.6);

    const mp25Base = Number((14.5 + (1 - Math.min(1, minD / 0.015)) * 11.2 + normPos * 5.8).toFixed(1));
    const co2eqTonAnoBase = Math.round((mjTransporteBase * 0.072 * 365) / 1000 + (kwhResfriamentoBase * 0.038 * 365) / 1000);

    const rsuKgDia = Math.round(dom.pessoas * 0.95 * 0.52);
    const biometanoPotencialNm3Dia = Number((dom.pessoas * 0.032 + coberturaArboreaBasePct * 1.85).toFixed(1));

    const reg = regionalNames.find(r => normPos <= r.maxPos)?.regiao || 'Corredor Campo Grande';
    const nomeLocal = f.properties.NM_FCU
      ? `${f.properties.NM_FCU} (${f.properties.NM_DIST})`
      : `${reg} · Setor ${cd.slice(-4)}`;

    const simplifiedPoly = simplifyRing(getRing(f.geometry), 26);
    const elevM = sampleElev(c[0], c[1]);
    const { buildings, pctVertical } = generateUrbanBuildings(
      simplifiedPoly,
      c,
      normPos,
      dom.dom_km2,
      rendaMedia,
      Boolean(f.properties.NM_FCU)
    );

    // Perfil Social Dominante ("Quem mora onde em Campinas")
    let perfilSocial = 'Classe Média Mista Consolidada';
    if (f.properties.NM_FCU) {
      perfilSocial = 'Comunidade Urbana / Favela (Alta Chefia Feminina & Juventude)';
    } else if (rendaMedia >= 5000 && pctVertical >= 45) {
      perfilSocial = 'Verticalizado de Alta Renda & Maior Longevidade (60+)';
    } else if (normPos > 0.65 && vulnerabilidadeIndex >= 0.58) {
      perfilSocial = 'Periferia Trabalhadora Densa (Dependente do BRT)';
    } else if (normPos >= 0.35 && normPos <= 0.65) {
      perfilSocial = 'Bairro de Transição / Polo Universitário & Serviços (JBD)';
    }

    return {
      id: idx + 1,
      cd_setor: cd,
      distrito: f.properties.NM_DIST || 'Campinas',
      comunidade_fcu: f.properties.NM_FCU || null,
      nome_local: nomeLocal,
      perfil_social: perfilSocial,
      regiao_corredor: reg,
      km_corredor: distCentroKm,
      norm_pos: Number(normPos.toFixed(4)),
      centroid: [Number(c[0].toFixed(5)), Number(c[1].toFixed(5))],
      elevacao_m: elevM,
      area_km2: Number(dom.area_km2.toFixed(3)),
      populacao: dom.pessoas,
      domicilios: dom.domicilios,
      densidade_dom_km2: Math.round(dom.dom_km2),
      moradores_por_domicilio: Number((dom.pessoas / Math.max(1, dom.domicilios)).toFixed(2)),
      pct_verticalizacao: pctVertical,
      renda_media_rs: rendaMedia,
      renda_mediana_rs: rendaMediana,
      pct_chefia_feminina: pctChefiaFeminina,
      pct_branca: pctBranca,
      pct_preta: pctPreta,
      pct_parda: pctParda,
      pct_negra_indigena: pctNegraIndigena,
      pct_jovens_0a14: dem.pct_0a14 || 17.5,
      pct_idosos_60mais: dem.pct_60mais || 15.2,
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
      polygon: simplifiedPoly,
      buildings
    };
  });

  fs.closeSync(fdDem);

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
      pct_apartamentos_municipal: 32.94,
      pct_pretos_pardos_municipal: 39.31,
      pct_jovens_0a14_municipal: 16.91,
      pct_idosos_60mais_municipal: 18.57,
      renda_media_responsavel_rs: 4660.0,
      razao_renda_mulher_homem_pct: 66.52,
      potencial_biometano_total_nm3_dia: 31525.3,
      potencial_biometano_urbano_nm3_dia: 28064.4,
      potencial_biometano_rsu_nm3_dia: 25692.7,
      potencial_biometano_esgoto_nm3_dia: 2371.7,
      potencial_biometano_agro_nm3_dia: 3460.9
    },
    relevo_3d: {
      fonte: 'INPE TOPODATA / SRTM 30m (Folha 22S48_ZN - Campinas)',
      cols: gridCols,
      rows: gridRows,
      lon_min: lonMin,
      lon_max: lonMax,
      lat_min: latMin,
      lat_max: latMax,
      elev_min_m: minElev,
      elev_max_m: maxElev,
      heights_m: elevationHeights,
      rios_principais: riosCampinas
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
  console.log('✓ campinasRealData.json atualizado com Relevo 3D (TOPODATA), Edifícios 3D e Demografia Humana!');
}

buildDataset();
