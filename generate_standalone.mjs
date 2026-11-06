import fs from 'node:fs';

const data = JSON.parse(
  fs.readFileSync('c:/Users/Lucas/Documents/Digital_Twin_Modelling/src/data/campinasRealData.json', 'utf8')
);

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Gêmeo Digital Urbano-Energético 3D | Campinas Basemap + DEM + 1.850 Edifícios OSM + Rede CP2B</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background: #020617; color: #f1f5f9; overflow: hidden; margin: 0; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="w-screen h-screen flex overflow-hidden select-none">
  <!-- SIDEBAR ESQUERDA -->
  <aside class="w-[395px] h-full bg-slate-950/95 border-r border-slate-800/90 flex flex-col z-20 overflow-y-auto">
    <div class="p-4 border-b border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/30">
      <div class="flex items-center justify-between mb-2">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          DOCKER POSTGIS · OSM 3D · CP2B · CENSO 2022
        </span>
        <button id="btn-style" onclick="toggleVisualStyle()" class="px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700">
          ☀ Maquete Clara
        </button>
      </div>
      <h1 class="text-base font-bold text-slate-100">Gêmeo Digital Urbano-Energético 3D</h1>
      <p class="text-xs text-sky-300 font-medium mt-0.5">Campinas-SP (IBGE 3509502) · Corredor BRT Campo Grande</p>
      <p class="text-[11px] text-slate-400 mt-1 leading-snug">
        Basemap OSM (2.200 vias, rios e parques) + DEM 30m (547m–789m) + 1.850 Edifícios 3D OSM + Rede Completa CP2B (30 ETEs SANASA, 40 Indústrias, Delta A e OneBio).
      </p>
    </div>

    <!-- CAMADA HUMANA: QUEM MORA ONDE EM CAMPINAS -->
    <div class="p-3.5 border-b border-slate-800 bg-fuchsia-950/15">
      <div class="flex justify-between items-center mb-2">
        <span class="text-xs font-bold text-fuchsia-300">Camada Humana: Quem Mora Onde em Campinas</span>
        <span class="text-[10px] font-mono text-slate-400">Censo 2022</span>
      </div>
      <div class="grid grid-cols-2 gap-1.5" id="lens-buttons">
        <button onclick="setLens('renda')" data-lens="renda" class="lens-btn px-2.5 py-1.5 rounded-lg text-left text-[11px] font-semibold border bg-fuchsia-600/30 border-fuchsia-400 text-white">Renda Familiar (R$)</button>
        <button onclick="setLens('chefia_feminina')" data-lens="chefia_feminina" class="lens-btn px-2.5 py-1.5 rounded-lg text-left text-[11px] font-semibold border bg-slate-900 border-slate-800 text-slate-300">Mulheres Chefes (%)</button>
        <button onclick="setLens('raca_cor')" data-lens="raca_cor" class="lens-btn px-2.5 py-1.5 rounded-lg text-left text-[11px] font-semibold border bg-slate-900 border-slate-800 text-slate-300">Cor ou Raça (% PPI)</button>
        <button onclick="setLens('verticalizacao')" data-lens="verticalizacao" class="lens-btn px-2.5 py-1.5 rounded-lg text-left text-[11px] font-semibold border bg-slate-900 border-slate-800 text-slate-300">Tipologia Edilícia (%)</button>
        <button onclick="setLens('vulnerabilidade')" data-lens="vulnerabilidade" class="lens-btn col-span-2 px-2.5 py-1.5 rounded-lg text-left text-[11px] font-semibold border bg-slate-900 border-slate-800 text-slate-300">Índice IVSG (Vulnerabilidade Combinada)</button>
      </div>
    </div>

    <!-- Presets -->
    <div class="px-4 py-2 border-b border-slate-800 bg-slate-900/40 flex gap-1.5">
      <button onclick="setPreset(20, 0, 0, 0)" class="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700">Baseline</button>
      <button onclick="setPreset(50, 65, 60, 55)" class="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-950/70 hover:bg-emerald-900 text-emerald-200 border border-emerald-600/40">Meta CP2B 2030</button>
      <button onclick="setPreset(80, 100, 100, 85)" class="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-sky-950/70 hover:bg-sky-900 text-sky-200 border border-sky-500/40">100% Circular</button>
    </div>

    <div class="p-3.5 space-y-2.5 flex-1">
      <div class="p-2.5 rounded-xl bg-slate-900/75 border border-slate-800">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs font-semibold text-sky-300">1. Explodir Camadas (Z-Spread)</span>
          <span id="val-zSpread" class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">30%</span>
        </div>
        <input id="sl-zSpread" type="range" min="0" max="100" value="30" class="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer" />
      </div>

      <div class="p-2.5 rounded-xl bg-slate-900/75 border border-slate-800">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs font-semibold text-indigo-300">Relevo DEM Campinas (22S48_ZN · 547m–789m)</span>
          <span id="val-terrain" class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">70%</span>
        </div>
        <input id="sl-terrain" type="range" min="0" max="100" value="70" class="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer" style="accent-color:#6366f1" />
      </div>

      <div class="p-2.5 rounded-xl bg-slate-900/75 border border-slate-800">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs font-semibold text-emerald-300">2. Frota BRT a Biometano (Rede CP2B)</span>
          <span id="val-bio" class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">55%</span>
        </div>
        <input id="sl-bio" type="range" min="0" max="100" value="55" class="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer" style="accent-color:#10b981" />
      </div>

      <div class="p-2.5 rounded-xl bg-slate-900/75 border border-slate-800">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs font-semibold text-teal-300">3. Infraestrutura Verde & Digestato</span>
          <span id="val-green" class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300">45%</span>
        </div>
        <input id="sl-green" type="range" min="0" max="100" value="45" class="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer" style="accent-color:#14b8a6" />
      </div>

      <div class="p-2.5 rounded-xl bg-slate-900/75 border border-slate-800">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs font-semibold text-amber-300">4. Transferência Modal (Carro → BRT)</span>
          <span id="val-modal" class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">40%</span>
        </div>
        <input id="sl-modal" type="range" min="0" max="100" value="40" class="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer" style="accent-color:#f59e0b" />
      </div>

      <!-- Legenda de Cores dos Edifícios 3D OSM -->
      <div class="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[10px] font-mono space-y-1">
        <div class="text-slate-300 font-bold uppercase">Legenda Edifícios 3D OSM (1.850 Prédios):</div>
        <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-sm bg-slate-100 border border-slate-400"></span><span>Malha Urbana Padrão (Maquete Branca)</span></div>
        <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span><span>Âncoras CP2B / Saúde / Educação / Mitigado</span></div>
        <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-sm bg-amber-400"></span><span>Polos Comerciais / Terminais BRT / Indústrias</span></div>
        <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-sm bg-rose-500"></span><span>Crítico Ilha de Calor / Alta Vulnerabilidade</span></div>
      </div>
    </div>
  </aside>

  <!-- ÁREA 3D E KPIS -->
  <main class="flex-1 h-full relative">
    <!-- TOPO CENTRAL: Orquestrador de Carregamento das 4 Etapas -->
    <div class="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-slate-700/80 shadow-2xl">
      <button onclick="playLoadStages()" class="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-[11px] transition shadow-md">
        ▶ Construir Camadas
      </button>
      <button id="st-btn-1" onclick="setLoadStage(1)" class="px-2.5 py-1 rounded-xl text-left font-mono text-[10px] border bg-slate-900 border-slate-700 text-slate-200">
        <strong>1. Basemap + DEM 30m</strong><br/><span class="text-[9px] text-slate-400">2.200 Vias/Rios OSM</span>
      </button>
      <button id="st-btn-2" onclick="setLoadStage(2)" class="px-2.5 py-1 rounded-xl text-left font-mono text-[10px] border bg-slate-900 border-slate-700 text-slate-200">
        <strong>2. Edifícios 3D OSM</strong><br/><span class="text-[9px] text-slate-400">1.850 Prédios + Censo</span>
      </button>
      <button id="st-btn-3" onclick="setLoadStage(3)" class="px-2.5 py-1 rounded-xl text-left font-mono text-[10px] border bg-slate-900 border-slate-700 text-slate-200">
        <strong>3. Rede CP2B (77 Nós)</strong><br/><span class="text-[9px] text-slate-400">30 ETEs + 40 Ind. + OneBio</span>
      </button>
      <button id="st-btn-4" onclick="setLoadStage(4)" class="px-2.5 py-1 rounded-xl text-left font-mono text-[10px] border bg-sky-500/25 border-sky-400 text-sky-200">
        <strong>4. Simulação V1↔V2↔V3</strong><br/><span class="text-[9px] text-slate-300">Acoplamento Total</span>
      </button>
    </div>

    <!-- TOPO ESQUERDO: Botão Matriz CP2B -->
    <div class="absolute top-16 left-4 z-20">
      <button onclick="toggleCp2bModal()" class="px-3 py-2 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-emerald-500/50 text-xs font-mono text-emerald-300 shadow-xl">
        ⚡ Inventário CP2B Campinas (526,02 GWh/ano · 31.525 Nm³/d · 77 Nós)
      </button>
      <div id="cp2b-modal" class="hidden mt-2 w-[520px] bg-slate-950/95 backdrop-blur-2xl border border-emerald-500/50 rounded-2xl p-4 shadow-2xl text-xs font-mono space-y-2.5">
        <div class="flex justify-between items-center border-b border-slate-800 pb-1.5">
          <span class="text-emerald-400 font-bold">INVENTÁRIO OFICIAL CP2B / NIPE-UNICAMP · CAMPINAS (3509502)</span>
          <button onclick="toggleCp2bModal()" class="text-slate-400 hover:text-white">✕</button>
        </div>
        <div class="grid grid-cols-4 gap-2">
          <div class="p-2 rounded bg-slate-900 border border-slate-800"><div class="text-[9px] text-slate-400">RSU / FORSU</div><div class="text-emerald-400 font-bold">397,9 GWh</div></div>
          <div class="p-2 rounded bg-slate-900 border border-slate-800"><div class="text-[9px] text-slate-400">SILV. + PODA RPO</div><div class="text-teal-300 font-bold">41,2 GWh</div></div>
          <div class="p-2 rounded bg-slate-900 border border-slate-800"><div class="text-[9px] text-slate-400">30 ETEs SANASA</div><div class="text-sky-300 font-bold">2.372 Nm³/d</div></div>
          <div class="p-2 rounded bg-slate-900 border border-slate-800"><div class="text-[9px] text-slate-400">AGRO + 40 IND.</div><div class="text-amber-300 font-bold">86,9 GWh</div></div>
        </div>
        <div class="text-[10px] text-slate-300 space-y-1">
          <div>• <strong>FORSU</strong>: FDE 25,2% · BMP 310 Nm³/tSV | <strong>ORGANICO_RSU</strong>: FDE 20,5% · BMP 270 Nm³/tSV</div>
          <div>• <strong>LODO_PRIMARIO</strong> (ETE Piçarrão / Capivari II / Anhumas): FDE 48,8% · BMP 310 Nm³/tSV</div>
          <div>• <strong>USINA ONEBIO PAULÍNIA (ANP)</strong>: 106.867 Nm³/d biometano | <strong>COMPLEXO DELTA A</strong>: 25.693 Nm³/d</div>
        </div>
      </div>
    </div>

    <!-- TOPO DIREITO: KPIs -->
    <div class="absolute top-16 right-4 z-10 flex flex-col gap-2 pointer-events-none">
      <div class="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl px-4 py-2.5 shadow-xl min-w-[225px]">
        <div class="text-[10px] font-mono text-slate-400">BALANÇO LÍQUIDO DE CARBONO</div>
        <div class="mt-0.5"><span id="kpi-co2" class="text-xl font-bold font-mono text-slate-100">0</span> <span class="text-xs font-mono text-slate-400">tCO₂eq/ano</span></div>
        <div id="kpi-co2-sub" class="text-[10px] font-mono text-emerald-400 mt-0.5">Mitigado: 0 t/ano</div>
      </div>
      <div class="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl px-4 py-2.5 shadow-xl min-w-[225px]">
        <div class="text-[10px] font-mono text-slate-400">REDUÇÃO EXPOSIÇÃO A MP2.5</div>
        <div class="mt-0.5"><span id="kpi-mp25" class="text-xl font-bold font-mono text-sky-300">0%</span> <span class="text-xs font-mono text-slate-400">pop. vulnerável</span></div>
        <div id="kpi-bio-sub" class="text-[10px] font-mono text-emerald-300 mt-0.5">Biometano: 0 Nm³/d</div>
      </div>
      <div class="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl px-4 py-2.5 shadow-xl min-w-[225px]">
        <div class="text-[10px] font-mono text-slate-400">ÍNDICE JUSTIÇA CLIMÁTICA</div>
        <div class="mt-0.5"><span id="kpi-justica" class="text-xl font-bold font-mono text-fuchsia-300">0</span> <span class="text-xs font-mono text-slate-400">/ 100 pts</span></div>
        <div class="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
          <div id="kpi-justica-bar" class="bg-gradient-to-r from-fuchsia-500 via-sky-400 to-emerald-400 h-full" style="width:50%"></div>
        </div>
      </div>
    </div>

    <div id="telemetry-card" class="absolute bottom-5 right-5 z-20 w-[415px] bg-slate-950/95 backdrop-blur-xl border border-sky-500/50 rounded-2xl p-4 shadow-2xl"></div>
    <div id="canvas-container" class="w-full h-full"></div>
  </main>

  <script>
    const CAMPINAS_DATA = ${JSON.stringify(data)};
    const LON_CENTER = -47.1300, LAT_CENTER = -22.9310, SCALE = 185, BASE_ELEV_M = 552.0;

    let params = { zSpread: 30, terrain: 70, bio: 55, green: 45, modal: 40, lens: 'renda', isDaylight: true, loadStage: 4 };
    let activeSectorId = 18;

    function projectCoord(lon, lat) {
      const x = (lon - LON_CENTER) * SCALE * Math.cos(LAT_CENTER * Math.PI / 180);
      const z = -(lat - LAT_CENTER) * SCALE;
      return [x, z];
    }

    function elevToY(elevM) {
      return ((elevM - BASE_ELEV_M) / 110) * 1.45 * (params.terrain / 100);
    }

    function lerpHex(h1, h2, f) {
      f = Math.max(0, Math.min(1, f));
      const c1 = parseInt(h1.slice(1), 16), c2 = parseInt(h2.slice(1), 16);
      const r = Math.round(((c1>>16)&255) + (((c2>>16)&255) - ((c1>>16)&16))*f);
      const r2 = Math.round(((c1>>16)&255) + (((c2>>16)&255) - ((c1>>16)&255))*f);
      const g = Math.round(((c1>>8)&255) + (((c2>>8)&255) - ((c1>>8)&255))*f);
      const b = Math.round((c1&255) + ((c2&255) - (c1&255))*f);
      return '#' + ((1<<24)+(r2<<16)+(g<<8)+b).toString(16).slice(1);
    }

    function getPeopleColor(s, simIvsg) {
      if (params.lens === 'renda') {
        const t = Math.max(0, Math.min(1, (s.renda_media_rs - 1600) / 5200));
        return t < 0.45 ? lerpHex('#e11d48', '#f59e0b', t / 0.45) : lerpHex('#f59e0b', '#0284c7', (t - 0.45) / 0.55);
      }
      if (params.lens === 'chefia_feminina') {
        const t = Math.max(0, Math.min(1, (s.pct_chefia_feminina - 40) / 20));
        return t < 0.5 ? lerpHex('#8b5cf6', '#9333ea', t * 2) : lerpHex('#9333ea', '#e11d48', (t - 0.5) * 2);
      }
      if (params.lens === 'raca_cor') {
        const t = Math.max(0, Math.min(1, (s.pct_negra_indigena - 22) / 48));
        return t < 0.5 ? lerpHex('#38bdf8', '#f59e0b', t * 2) : lerpHex('#f59e0b', '#dc2626', (t - 0.5) * 2);
      }
      if (params.lens === 'verticalizacao') {
        const t = Math.max(0, Math.min(1, s.pct_verticalizacao / 75));
        return t < 0.4 ? lerpHex('#d97706', '#10b981', t / 0.4) : lerpHex('#10b981', '#2563eb', (t - 0.4) / 0.6);
      }
      const t = Math.max(0, Math.min(1, (simIvsg - 0.15) / 0.75));
      return t < 0.5 ? lerpHex('#1e3a8a', '#c026d3', t * 2) : lerpHex('#c026d3', '#f43f5e', (t - 0.5) * 2);
    }

    function getEmissColor(mp25) {
      const t = Math.max(0, Math.min(1, (mp25 - 7) / 23));
      return t < 0.45 ? lerpHex('#06b6d4', '#eab308', t / 0.45) : lerpHex('#eab308', '#ef4444', (t - 0.45) / 0.55);
    }

    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#dbe4ee');
    scene.fog = new THREE.Fog('#dbe4ee', 32, 78);

    const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 240);
    camera.position.set(2.5, 11.5, 17.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 1.5, 0);

    scene.add(new THREE.AmbientLight('#ffffff', 0.92));
    const dir1 = new THREE.DirectionalLight('#fffef5', 1.65);
    dir1.position.set(18, 34, 22);
    dir1.castShadow = true;
    scene.add(dir1);

    const basemapGroup = new THREE.Group();
    const osmBuildingsGroup = new THREE.Group();
    const layer0 = new THREE.Group();
    const layer1 = new THREE.Group();
    const layer2 = new THREE.Group();
    scene.add(basemapGroup, osmBuildingsGroup, layer0, layer1, layer2);

    // 1. Relevo 3D Real de Campinas (SRTM 30m - 22S48_ZN.tif)
    const rel = CAMPINAS_DATA.relevo_3d;
    const [xMin, zMax] = projectCoord(rel.lon_min, rel.lat_min);
    const [xMax, zMin] = projectCoord(rel.lon_max, rel.lat_max);
    const terrainGeo = new THREE.PlaneGeometry(xMax - xMin, zMax - zMin, rel.cols - 1, rel.rows - 1);
    terrainGeo.rotateX(-Math.PI / 2);
    const terrainMat = new THREE.MeshStandardMaterial({ color: '#dde5ed', roughness: 0.85, metalness: 0.04 });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.position.set((xMin + xMax) / 2, 0, (zMin + zMax) / 2);
    terrainMesh.receiveShadow = true;
    basemapGroup.add(terrainMesh);

    function sampleElev(lon, lat) {
      const cIdx = Math.max(0, Math.min(rel.cols - 1, Math.round(((lon - rel.lon_min) / (rel.lon_max - rel.lon_min)) * (rel.cols - 1))));
      const rIdx = Math.max(0, Math.min(rel.rows - 1, Math.round(((rel.lat_max - lat) / (rel.lat_max - rel.lat_min)) * (rel.rows - 1))));
      return (rel.heights_m[rIdx] && rel.heights_m[rIdx][cIdx]) ? rel.heights_m[rIdx][cIdx] : 640;
    }

    // Basemap: Vias OSM, Rios OSM e Gasodutos Comgás/CP2B
    if (CAMPINAS_DATA.basemap) {
      (CAMPINAS_DATA.basemap.roads || []).slice(0, 1100).forEach(r => {
        if (!r.coords || r.coords.length < 2) return;
        const pts = r.coords.map(([lon, lat]) => {
          const [rx, rz] = projectCoord(lon, lat);
          return new THREE.Vector3(rx, elevToY(sampleElev(lon, lat)) - 0.04, rz);
        });
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: r.isBrtCorridor ? '#0284c7' : '#64748b', transparent: true, opacity: r.isBrtCorridor ? 0.9 : 0.48 });
        basemapGroup.add(new THREE.Line(geo, mat));
      });

      (CAMPINAS_DATA.basemap.waterways || []).slice(0, 300).forEach(w => {
        if (!w.coords || w.coords.length < 2) return;
        const pts = w.coords.map(([lon, lat]) => {
          const [wx, wz] = projectCoord(lon, lat);
          return new THREE.Vector3(wx, elevToY(sampleElev(lon, lat)) - 0.05, wz);
        });
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        basemapGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.8 })));
      });

      (CAMPINAS_DATA.basemap.gasPipelines || []).forEach(p => {
        if (!p.coords || p.coords.length < 2) return;
        const pts = p.coords.map(([lon, lat]) => {
          const [px, pz] = projectCoord(lon, lat);
          return new THREE.Vector3(px, elevToY(sampleElev(lon, lat)) + 0.03, pz);
        });
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const isCp2b = p.kind.includes('CP2B');
        layer1.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: isCp2b ? '#10b981' : '#f59e0b', transparent: true, opacity: 0.9 })));
      });
    }

    // 2. Edifícios 3D Reais do OpenStreetMap (1.850 Footprints) ancorados no DEM
    const osmBuildingMaterials = {
      standard: new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.42, metalness: 0.08 }),
      cp2b_green: new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.28, metalness: 0.18 }),
      brt_amber: new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.28, metalness: 0.18 }),
      social_red: new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.28, metalness: 0.18 })
    };
    const edgeMat = new THREE.LineBasicMaterial({ color: '#94a3b8', transparent: true, opacity: 0.45 });

    (CAMPINAS_DATA.osmBuildings3D || []).slice(0, 1350).forEach(b => {
      if (!b.coords || b.coords.length < 4) return;
      const [cx, cz] = projectCoord(b.centroid[0], b.centroid[1]);
      const baseY = elevToY(b.baseElevationM) - 0.04;
      const h = Math.max(0.14, (b.heightM / 32) * 0.95);
      const shape = new THREE.Shape();
      b.coords.forEach(([lon, lat], idx) => {
        const [px, pz] = projectCoord(lon, lat);
        if (idx === 0) shape.moveTo(px - cx, -(pz - cz));
        else shape.lineTo(px - cx, -(pz - cz));
      });
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const mat = osmBuildingMaterials[b.highlightRole] || osmBuildingMaterials.standard;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, baseY, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      osmBuildingsGroup.add(mesh);

      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat);
      edges.position.set(cx, baseY, cz);
      osmBuildingsGroup.add(edges);
    });

    // 3. Nós Reais da Rede CP2B (ETEs SANASA, Usinas Biometano, Indústrias e Terminais BRT)
    const cp2bNodes = (CAMPINAS_DATA.cp2b && CAMPINAS_DATA.cp2b.nodes) ? CAMPINAS_DATA.cp2b.nodes : [];
    cp2bNodes.forEach(node => {
      if (node.coordinates[0] < -47.245 || node.coordinates[0] > -46.965 || node.coordinates[1] < -23.015 || node.coordinates[1] > -22.745) return;
      const [nx, nz] = projectCoord(node.coordinates[0], node.coordinates[1]);
      const ny = elevToY(node.elevationM || 620);
      const isPlant = node.category === 'BIOMETHANE_PLANT' || node.category === 'RESEARCH_HUB';
      const isEte = node.category === 'ETE_SANASA';
      const col = isPlant ? '#059669' : isEte ? '#0284c7' : '#d97706';
      const rad = isPlant ? 0.42 : isEte ? 0.25 : 0.16;
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(rad, rad * 1.15, isPlant ? 0.45 : 0.28, 18),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.4 })
      );
      m.position.set(nx, ny + 0.2, nz);
      layer1.add(m);
    });

    const hub = CAMPINAS_DATA.corredor_brt.hubs_biometano[0];
    const [hubX, hubZ] = projectCoord(hub.lon, hub.lat);

    const sectorObjects = [];
    const pickableMeshes = [];
    const particles = [];

    CAMPINAS_DATA.setores.forEach((s, idx) => {
      const [cx, cz] = projectCoord(s.centroid[0], s.centroid[1]);
      const shape = new THREE.Shape();
      s.polygon.forEach(([lon, lat], i) => {
        const [px, pz] = projectCoord(lon, lat);
        if (i === 0) shape.moveTo(px - cx, -(pz - cz));
        else shape.lineTo(px - cx, -(pz - cz));
      });
      shape.closePath();

      const group0 = new THREE.Group();
      layer0.add(group0);

      const geo0 = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012 });
      geo0.rotateX(-Math.PI / 2);
      const mat0 = new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.55, transparent: true, opacity: 0.72 });
      const mesh0 = new THREE.Mesh(geo0, mat0);
      mesh0.userData = { sectorId: s.id };
      group0.add(mesh0);

      const bldgMeshes = [];
      (s.buildings || []).forEach((b, bIdx) => {
        const [bx, bz] = projectCoord(b.lon, b.lat);
        const h = Math.max(0.12, b.pavimentos * 0.082);
        const w = Math.max(0.11, (b.largura_m / 100) * 1.1);
        const d = Math.max(0.11, (b.profundidade_m / 100) * 1.1);
        const bMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.35 });
        const bMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bMat);
        bMesh.position.set(bx - cx, 0.09 + h / 2, bz - cz);
        bMesh.rotation.y = b.rot_rad;
        bMesh.userData = { sectorId: s.id };
        group0.add(bMesh);
        bldgMeshes.push({ mesh: bMesh, mat: bMat, isAccent: bIdx % 6 === 0 });
        pickableMeshes.push(bMesh);
      });

      const geoUnit = new THREE.ExtrudeGeometry(shape, { depth: 1.0, bevelEnabled: false });
      geoUnit.rotateX(-Math.PI / 2);

      const mat1 = new THREE.MeshStandardMaterial({ color: '#10b981', transparent: true, opacity: 0.55 });
      const mesh1 = new THREE.Mesh(geoUnit, mat1);
      mesh1.scale.set(0.88, 0.35, 0.88);
      mesh1.userData = { sectorId: s.id };
      layer1.add(mesh1);

      const mat2 = new THREE.MeshStandardMaterial({ color: '#f59e0b', transparent: true, opacity: 0.84 });
      const mesh2 = new THREE.Mesh(geoUnit, mat2);
      mesh2.scale.set(0.74, 1.0, 0.74);
      mesh2.userData = { sectorId: s.id };
      layer2.add(mesh2);

      pickableMeshes.push(mesh0, mesh1, mesh2);

      if (idx % 2 === 0) {
        const start = new THREE.Vector3(cx, 0.4, cz);
        const end = new THREE.Vector3(hubX, 0.5, hubZ);
        const dist = Math.hypot(cx - hubX, cz - hubZ);
        const curve = new THREE.CubicBezierCurve3(
          start,
          new THREE.Vector3((cx*2+hubX)/3, 1.1 + dist*0.13, (cz*2+hubZ)/3),
          new THREE.Vector3((cx+hubX*2)/3, 1.2 + dist*0.13, (cz+hubZ*2)/3),
          end
        );
        const arcGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
        const arcMat = new THREE.LineBasicMaterial({ color: '#059669', transparent: true, opacity: 0.45 });
        layer1.add(new THREE.Line(arcGeo, arcMat));

        const pMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), new THREE.MeshBasicMaterial({ color: '#10b981' }));
        layer1.add(pMesh);
        particles.push({ mesh: pMesh, curve, offset: idx * 0.11 });
      }

      sectorObjects.push({ s, cx, cz, group0, mesh0, mesh1, mesh2, mat0, mat1, mat2, bldgMeshes });
    });

    const laserCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 12, 20),
      new THREE.MeshBasicMaterial({ color: '#0284c7', transparent: true, opacity: 0.28 })
    );
    scene.add(laserCyl);

    let simulatedSectors = [];

    function updateTerrainGeometry() {
      const posAttr = terrainGeo.attributes.position;
      for (let r = 0; r < rel.rows; r++) {
        for (let c = 0; c < rel.cols; c++) {
          const idx = r * rel.cols + c;
          posAttr.setY(idx, elevToY(rel.heights_m[r][c]) - 0.12);
        }
      }
      posAttr.needsUpdate = true;
      terrainGeo.computeVertexNormals();
    }

    function updateSimulation() {
      updateTerrainGeometry();
      const bio = params.bio / 100, green = params.green / 100, modal = params.modal / 100;
      const mitigationScore = bio * 0.55 + green * 0.45;
      osmBuildingMaterials.social_red.color.set(mitigationScore > 0.7 ? '#22c55e' : mitigationScore > 0.4 ? '#eab308' : '#ef4444');
      osmBuildingMaterials.brt_amber.color.set(mitigationScore > 0.75 ? '#10b981' : '#eab308');

      osmBuildingsGroup.visible = params.loadStage >= 2;
      layer0.visible = params.loadStage >= 2;
      layer1.visible = params.loadStage >= 3;
      layer2.visible = params.loadStage >= 4 && params.zSpread > 4;

      let totCo2Base = 0, totCo2Sim = 0, totBioCredit = 0, wMp25Base = 0, wMp25Sim = 0, sumJustica = 0, totBioNm3 = 0;

      simulatedSectors = sectorObjects.map((obj) => {
        const s = obj.s;
        const elevY = elevToY(s.elevacao_m);
        obj.group0.position.set(obj.cx, elevY, obj.cz);
        obj.mesh1.position.set(obj.cx, elevY, obj.cz);
        obj.mesh2.position.set(obj.cx, elevY, obj.cz);

        const deficitArb = Math.max(0.2, 1 - s.cobertura_arborea_pct / 40);
        const redUhi = Number((green * 3.5 * (0.72 + 0.28 * deficitArb)).toFixed(2));
        const simDeltaUhi = Number(Math.max(0.4, s.delta_uhi_c - redUhi).toFixed(2));
        const simCobArb = Number(Math.min(55, s.cobertura_arborea_pct + green * 24 * deficitArb).toFixed(1));

        const perifFactor = 0.55 + 0.45 * s.norm_pos;
        const simMjTransp = Math.round(s.mj_transporte_dia * (1 - modal * 0.62 * perifFactor));
        const uhiRatio = simDeltaUhi / Math.max(0.5, s.delta_uhi_c);
        const simKwhResf = Math.round(s.kwh_resfriamento_dia * (0.28 + 0.72 * uhiRatio));
        const simMjTotal = Math.round(simMjTransp + simKwhResf * 3.6);

        const simBioNm3 = Number((s.biometano_nm3_dia * (0.35 + 0.65 * bio + 0.28 * green)).toFixed(1));
        const redMp25 = Math.min(0.78, bio * 0.42 + modal * 0.24 + green * 0.14);
        const simMp25 = Number((s.mp25_ugm3 * (1 - redMp25)).toFixed(1));
        const simCo2 = Math.round(s.co2eq_ton_ano * (1 - modal * 0.44 - bio * 0.31 - green * 0.12));
        const bioOffset = (simBioNm3 * 365 * 1.96) / 1000 + simCobArb * s.area_km2 * 4.5;

        const alivio = bio * 0.28 + green * 0.38 + modal * 0.34;
        const simIvsg = Number(Math.max(0.08, s.vulnerabilidade_ivsg * (1 - alivio * 0.52)).toFixed(3));
        const simJustica = Math.min(98, Math.round((1 - simIvsg) * 65 + alivio * 38));

        const isFocus = s.id === activeSectorId;
        const pCol = getPeopleColor(s, simIvsg);
        obj.mat0.color.set(pCol);
        obj.bldgMeshes.forEach(bm => {
          bm.mat.color.set((isFocus || bm.isAccent) ? pCol : (params.isDaylight ? '#f8fafc' : '#cbd5e1'));
        });

        obj.mesh1.scale.y = Math.max(0.08, (simCobArb / 45) * 0.65);
        obj.mesh2.scale.y = Math.max(0.16, (simMjTotal / 16000) * 2.1);
        obj.mat2.color.set(getEmissColor(simMp25));

        totCo2Base += s.co2eq_ton_ano;
        totCo2Sim += simCo2;
        totBioCredit += bioOffset;
        const w = s.populacao * (0.5 + s.vulnerabilidade_ivsg);
        wMp25Base += s.mp25_ugm3 * w;
        wMp25Sim += simMp25 * w;
        sumJustica += simJustica;
        totBioNm3 += simBioNm3;

        return { ...s, simIvsg, simJustica, simCobArb, simDeltaUhi, redUhi, simMjTransp, simMjTotal, simBioNm3, simMp25, cx: obj.cx, cz: obj.cz };
      });

      const balanco = Math.round(totCo2Sim - totBioCredit);
      const evitadas = Math.round(totCo2Base - balanco);
      const redMp25Pct = (((wMp25Base - wMp25Sim) / wMp25Base) * 100).toFixed(1);
      const justicaMedia = Math.round(sumJustica / simulatedSectors.length);

      document.getElementById('kpi-co2').textContent = balanco.toLocaleString('pt-BR');
      document.getElementById('kpi-co2-sub').textContent = 'Mitigado: -' + evitadas.toLocaleString('pt-BR') + ' tCO₂eq/ano';
      document.getElementById('kpi-mp25').textContent = '-' + redMp25Pct + '%';
      document.getElementById('kpi-bio-sub').textContent = 'Biometano Corredor: ' + Math.round(totBioNm3).toLocaleString('pt-BR') + ' Nm³/d';
      document.getElementById('kpi-justica').textContent = justicaMedia;
      document.getElementById('kpi-justica-bar').style.width = justicaMedia + '%';

      renderTelemetry();
    }

    function renderTelemetry() {
      const active = simulatedSectors.find(x => x.id === activeSectorId) || simulatedSectors[0];
      if (!active) return;
      laserCyl.position.set(active.cx, 5, active.cz);
      document.getElementById('telemetry-card').innerHTML = \`
        <div class="border-b border-slate-800 pb-2 mb-2.5">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded bg-sky-500/20 text-[10px] font-mono font-bold text-sky-300">IBGE \${active.cd_setor}</span>
            <span class="text-[11px] font-mono text-indigo-300">Alt DEM: \${active.elevacao_m}m</span>
            <span class="text-[11px] font-mono text-slate-400">km \${active.km_corredor}</span>
          </div>
          <h3 class="text-sm font-bold text-slate-100 mt-1">\${active.nome_local}</h3>
          <p class="text-[11px] text-fuchsia-300 font-mono mt-0.5">\${active.perfil_social}</p>
        </div>
        <div class="space-y-2 text-xs">
          <div class="p-2 rounded-lg bg-fuchsia-950/30 border border-fuchsia-500/30 grid grid-cols-4 gap-1.5">
            <div><span class="text-[10px] text-slate-400 block">Renda Média</span><span class="font-mono font-bold">R$ \${active.renda_media_rs.toLocaleString('pt-BR')}</span></div>
            <div><span class="text-[10px] text-slate-400 block">Chefia Fem.</span><span class="font-mono font-bold text-fuchsia-300">\${active.pct_chefia_feminina}%</span></div>
            <div><span class="text-[10px] text-slate-400 block">Preta/Parda</span><span class="font-mono font-bold text-amber-200">\${active.pct_negra_indigena}%</span></div>
            <div><span class="text-[10px] text-slate-400 block">Verticaliz.</span><span class="font-mono font-bold text-sky-300">\${active.pct_verticalizacao}%</span></div>
          </div>
          <div class="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 grid grid-cols-3 gap-2">
            <div><span class="text-[10px] text-slate-400 block">Pot. Biometano</span><span class="font-mono font-bold text-emerald-300">\${active.simBioNm3} Nm³/d</span></div>
            <div><span class="text-[10px] text-slate-400 block">Cob. Arbórea</span><span class="font-mono font-bold text-teal-300">\${active.simCobArb}%</span></div>
            <div><span class="text-[10px] text-slate-400 block">RSU Orgânico</span><span class="font-mono font-bold">\${active.rsu_organico_kg_dia} kg/d</span></div>
          </div>
          <div class="p-2 rounded-lg bg-amber-950/30 border border-amber-500/30 grid grid-cols-3 gap-2">
            <div><span class="text-[10px] text-slate-400 block">MJ Transporte</span><span class="font-mono font-bold text-amber-300">\${active.simMjTransp.toLocaleString('pt-BR')} MJ</span></div>
            <div><span class="text-[10px] text-slate-400 block">Delta Ilha Calor</span><span class="font-mono font-bold text-orange-300">+\${active.simDeltaUhi}°C (-\${active.redUhi}°C)</span></div>
            <div><span class="text-[10px] text-slate-400 block">MP2.5 Local</span><span class="font-mono font-bold text-rose-300">\${active.simMp25} µg/m³</span></div>
          </div>
        </div>
      \`;
    }

    window.setLoadStage = function(st) {
      params.loadStage = st;
      for (let i = 1; i <= 4; i++) {
        const btn = document.getElementById('st-btn-' + i);
        btn.className = 'px-2.5 py-1 rounded-xl text-left font-mono text-[10px] border ' +
          (i === st ? 'bg-sky-500/25 border-sky-400 text-sky-200' : 'bg-slate-900 border-slate-700 text-slate-200');
      }
      updateSimulation();
    };

    window.playLoadStages = function() {
      setLoadStage(1);
      setTimeout(() => setLoadStage(2), 1400);
      setTimeout(() => setLoadStage(3), 2800);
      setTimeout(() => setLoadStage(4), 4200);
    };

    window.toggleCp2bModal = function() {
      const el = document.getElementById('cp2b-modal');
      el.classList.toggle('hidden');
    };

    window.setLens = function(lens) {
      params.lens = lens;
      document.querySelectorAll('.lens-btn').forEach(btn => {
        const active = btn.getAttribute('data-lens') === lens;
        btn.className = 'lens-btn ' + (lens === 'vulnerabilidade' && active ? 'col-span-2 ' : (btn.getAttribute('data-lens') === 'vulnerabilidade' ? 'col-span-2 ' : '')) +
          'px-2.5 py-1.5 rounded-lg text-left text-[11px] font-semibold border ' +
          (active ? 'bg-fuchsia-600/30 border-fuchsia-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-300');
      });
      updateSimulation();
    };

    window.toggleVisualStyle = function() {
      params.isDaylight = !params.isDaylight;
      const bg = params.isDaylight ? '#dbe4ee' : '#020617';
      scene.background.set(bg);
      scene.fog.color.set(bg);
      terrainMat.color.set(params.isDaylight ? '#dde5ed' : '#0d1b2a');
      osmBuildingMaterials.standard.color.set(params.isDaylight ? '#f8fafc' : '#cbd5e1');
      document.getElementById('btn-style').textContent = params.isDaylight ? '☀ Maquete Clara' : '🌙 Noturno Lab';
      updateSimulation();
    };

    ['zSpread', 'terrain', 'bio', 'green', 'modal'].forEach(k => {
      const el = document.getElementById('sl-' + k);
      el.addEventListener('input', (e) => {
        params[k] = Number(e.target.value);
        document.getElementById('val-' + k).textContent = params[k] + '%';
        updateSimulation();
      });
    });

    window.setPreset = function(z, b, g, m) {
      params.zSpread = z; params.bio = b; params.green = g; params.modal = m;
      ['zSpread', 'bio', 'green', 'modal'].forEach(k => {
        document.getElementById('sl-' + k).value = params[k];
        document.getElementById('val-' + k).textContent = params[k] + '%';
      });
      updateSimulation();
    };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    renderer.domElement.addEventListener('pointermove', (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(pickableMeshes);
      if (hits.length > 0 && hits[0].object.userData.sectorId) {
        if (activeSectorId !== hits[0].object.userData.sectorId) {
          activeSectorId = hits[0].object.userData.sectorId;
          updateSimulation();
        }
      }
    });

    updateSimulation();

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const effSpread = params.loadStage >= 4 ? (params.zSpread / 100) : 0;
      layer1.position.y += ((0.35 + effSpread * 4.5) - layer1.position.y) * 0.1;
      layer2.position.y += ((0.75 + effSpread * 9.2) - layer2.position.y) * 0.1;

      const speed = 0.2 + (params.bio / 100) * 0.6;
      particles.forEach(p => {
        const u = (t * speed + p.offset) % 1;
        p.mesh.position.copy(p.curve.getPointAt(u));
      });

      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });
  </script>
</body>
</html>`;

fs.writeFileSync('c:/Users/Lucas/Documents/Digital_Twin_Modelling/prototipo-campinas-standalone.html', html, 'utf8');
console.log('✓ prototipo-campinas-standalone.html atualizado com sucesso!');
