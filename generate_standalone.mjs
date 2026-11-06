import fs from 'node:fs';

const data = JSON.parse(
  fs.readFileSync('c:/Users/Lucas/Documents/Digital_Twin_Modelling/src/data/campinasRealData.json', 'utf8')
);

const html = `<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Gêmeo Digital Urbano-Energético | Corredor BRT Campo Grande - Cidade de Campinas/SP</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background: #020617; color: #f1f5f9; overflow: hidden; margin: 0; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
    input[type=range] { accent-color: #38bdf8; }
  </style>
</head>
<body class="w-screen h-screen flex overflow-hidden select-none">
  <!-- SIDEBAR ESQUERDA: SURROGATE MODEL INTERATIVO -->
  <aside class="w-[385px] h-full bg-slate-950/95 border-r border-slate-800/90 flex flex-col z-20 overflow-y-auto">
    <div class="p-4 border-b border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/30">
      <div class="flex items-center justify-between mb-1.5">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          NIPE / UNICAMP · CP2B · CENSO 2022
        </span>
        <span class="text-[10px] font-mono text-sky-400">IBGE 3509502</span>
      </div>
      <h1 class="text-base font-bold text-slate-100">Gêmeo Digital Urbano-Energético</h1>
      <p class="text-xs text-sky-300 font-medium mt-0.5">Corredor BRT Campo Grande · Cidade de Campinas-SP</p>
      <p class="text-[11px] text-slate-400 mt-1 leading-relaxed">
        Malha real de 35 setores censitários (IBGE Censo 2022) ao longo da Av. John Boyd Dunlop (do Centro ao Distrito do Campo Grande).
      </p>
    </div>

    <!-- Presets -->
    <div class="px-4 py-2.5 border-b border-slate-800 bg-slate-900/40 flex gap-1.5">
      <button onclick="setPreset(30, 0, 0, 0)" class="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700">Baseline</button>
      <button onclick="setPreset(70, 60, 55, 50)" class="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-950/70 hover:bg-emerald-900 text-emerald-200 border border-emerald-600/40">Meta CP2B 2030</button>
      <button onclick="setPreset(90, 100, 100, 85)" class="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-sky-950/70 hover:bg-sky-900 text-sky-200 border border-sky-500/40">100% Circular</button>
    </div>

    <div class="p-4 space-y-3.5 flex-1">
      <!-- Slider 1 -->
      <div class="p-3 rounded-xl bg-slate-900/75 border border-slate-800">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs font-semibold text-sky-300">1. Explodir Camadas (Z-Spread)</span>
          <span id="val-zSpread" class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">65%</span>
        </div>
        <p class="text-[11px] text-slate-400 mb-2">Separa verticalmente as 3 dimensões científicas conectadas por linhas guias.</p>
        <input id="sl-zSpread" type="range" min="0" max="100" value="65" class="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer" />
      </div>

      <!-- Slider 2 -->
      <div class="p-3 rounded-xl bg-slate-900/75 border border-slate-800">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs font-semibold text-emerald-300">2. Frota BRT a Biometano (CP2B)</span>
          <span id="val-bio" class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">45%</span>
        </div>
        <p class="text-[11px] text-slate-400 mb-2">Substituição do diesel por biometano de RSU/Esgoto de Campinas (28.064 Nm³/d).</p>
        <input id="sl-bio" type="range" min="0" max="100" value="45" class="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer" style="accent-color:#10b981" />
      </div>

      <!-- Slider 3 -->
      <div class="p-3 rounded-xl bg-slate-900/75 border border-slate-800">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs font-semibold text-teal-300">3. Infraestrutura Verde & APPs</span>
          <span id="val-green" class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300">40%</span>
        </div>
        <p class="text-[11px] text-slate-400 mb-2">Jardins de chuva e arborização urbana; reduz Ilha de Calor em até -3.5°C.</p>
        <input id="sl-green" type="range" min="0" max="100" value="40" class="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer" style="accent-color:#14b8a6" />
      </div>

      <!-- Slider 4 -->
      <div class="p-3 rounded-xl bg-slate-900/75 border border-slate-800">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs font-semibold text-amber-300">4. Transferência Modal (Carro → BRT)</span>
          <span id="val-modal" class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">35%</span>
        </div>
        <p class="text-[11px] text-slate-400 mb-2">Reduz drasticamente o consumo de MJ/dia nos setores periféricos e intermediários.</p>
        <input id="sl-modal" type="range" min="0" max="100" value="35" class="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer" style="accent-color:#f59e0b" />
      </div>
    </div>

    <div class="p-3.5 border-t border-slate-800 bg-slate-900/60 text-[11px] space-y-1.5">
      <div class="font-mono text-[10px] uppercase text-slate-400">Anatomia das 3 Camadas (Campinas-SP)</div>
      <div class="flex justify-between"><span>Nível 2 (Topo): Demanda MJ + MP2.5</span><span class="font-mono text-amber-400">Prismas 3D</span></div>
      <div class="flex justify-between"><span>Nível 1 (Meio): Biometano CP2B & Verde</span><span class="font-mono text-emerald-400">31.525 Nm³/d</span></div>
      <div class="flex justify-between"><span>Nível 0 (Solo): Vulnerabilidade (IVSG)</span><span class="font-mono text-fuchsia-400">49,4% Chefia Fem.</span></div>
    </div>
  </aside>

  <!-- ÁREA 3D E KPIS -->
  <main class="flex-1 h-full relative">
    <!-- 3 KPIs no Topo Direito -->
    <div class="absolute top-4 right-4 z-10 flex gap-3 pointer-events-none">
      <div class="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl px-4 py-3 shadow-xl min-w-[220px]">
        <div class="text-[10px] font-mono text-slate-400">BALANÇO LÍQUIDO DE CARBONO</div>
        <div class="mt-0.5"><span id="kpi-co2" class="text-2xl font-bold font-mono text-slate-100">0</span> <span class="text-xs font-mono text-slate-400">tCO₂eq/ano</span></div>
        <div id="kpi-co2-sub" class="text-[11px] font-mono text-emerald-400 mt-1">Mitigado: 0 t/ano</div>
      </div>
      <div class="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl px-4 py-3 shadow-xl min-w-[220px]">
        <div class="text-[10px] font-mono text-slate-400">REDUÇÃO EXPOSIÇÃO A MP2.5</div>
        <div class="mt-0.5"><span id="kpi-mp25" class="text-2xl font-bold font-mono text-sky-300">0%</span> <span class="text-xs font-mono text-slate-400">pop. vulnerável</span></div>
        <div id="kpi-bio-sub" class="text-[11px] font-mono text-emerald-300 mt-1">Biometano: 0 Nm³/d</div>
      </div>
      <div class="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl px-4 py-3 shadow-xl min-w-[220px]">
        <div class="text-[10px] font-mono text-slate-400">ÍNDICE JUSTIÇA CLIMÁTICA</div>
        <div class="mt-0.5"><span id="kpi-justica" class="text-2xl font-bold font-mono text-fuchsia-300">0</span> <span class="text-xs font-mono text-slate-400">/ 100 pts</span></div>
        <div class="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
          <div id="kpi-justica-bar" class="bg-gradient-to-r from-fuchsia-500 via-sky-400 to-emerald-400 h-full" style="width:50%"></div>
        </div>
      </div>
    </div>

    <!-- Card de Telemetria do Setor Censitário -->
    <div id="telemetry-card" class="absolute bottom-5 right-5 z-20 w-[405px] bg-slate-950/95 backdrop-blur-xl border border-sky-500/50 rounded-2xl p-4 shadow-2xl"></div>

    <div id="canvas-container" class="w-full h-full"></div>
  </main>

  <script>
    const CAMPINAS_DATA = ${JSON.stringify(data)};
    const LON_CENTER = -47.1300, LAT_CENTER = -22.9310, SCALE = 185;

    function projectCoord(lon, lat) {
      const x = (lon - LON_CENTER) * SCALE * Math.cos(LAT_CENTER * Math.PI / 180);
      const z = -(lat - LAT_CENTER) * SCALE;
      return [x, z];
    }

    function lerpHex(h1, h2, f) {
      f = Math.max(0, Math.min(1, f));
      const c1 = parseInt(h1.slice(1), 16), c2 = parseInt(h2.slice(1), 16);
      const r = Math.round(((c1>>16)&255) + (((c2>>16)&255) - ((c1>>16)&255))*f);
      const g = Math.round(((c1>>8)&255) + (((c2>>8)&255) - ((c1>>8)&255))*f);
      const b = Math.round((c1&255) + ((c2&255) - (c1&255))*f);
      return '#' + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
    }

    function getVulnColor(ivsg) {
      const t = Math.max(0, Math.min(1, (ivsg - 0.15) / 0.75));
      if (t < 0.35) return lerpHex('#1e3a8a', '#4f46e5', t / 0.35);
      if (t < 0.7) return lerpHex('#4f46e5', '#c026d3', (t - 0.35) / 0.35);
      return lerpHex('#c026d3', '#f43f5e', (t - 0.7) / 0.3);
    }

    function getEmissColor(mp25) {
      const t = Math.max(0, Math.min(1, (mp25 - 7) / 23));
      if (t < 0.4) return lerpHex('#06b6d4', '#eab308', t / 0.4);
      if (t < 0.75) return lerpHex('#eab308', '#f97316', (t - 0.4) / 0.35);
      return lerpHex('#f97316', '#ef4444', (t - 0.75) / 0.25);
    }

    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020617');
    scene.fog = new THREE.Fog('#020617', 28, 68);

    const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 200);
    camera.position.set(4, 15, 21);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 2.5, 0);

    scene.add(new THREE.AmbientLight('#ffffff', 0.65));
    const dir1 = new THREE.DirectionalLight('#f8fafc', 1.3);
    dir1.position.set(15, 28, 18);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight('#38bdf8', 0.6);
    dir2.position.set(-15, 18, -12);
    scene.add(dir2);

    const grid = new THREE.GridHelper(42, 42, '#1e293b', '#0f172a');
    grid.position.y = -0.06;
    scene.add(grid);

    const layer0 = new THREE.Group();
    const layer1 = new THREE.Group();
    const layer2 = new THREE.Group();
    scene.add(layer0, layer1, layer2);

    // Corredor BRT Campo Grande na Camada 0
    const brtPts = CAMPINAS_DATA.corredor_brt.estacoes.map(st => {
      const [x, z] = projectCoord(st.lon, st.lat);
      return new THREE.Vector3(x, 0.2, z);
    });
    const brtLineGeo = new THREE.BufferGeometry().setFromPoints(brtPts);
    const brtLineMat = new THREE.LineBasicMaterial({ color: '#38bdf8', linewidth: 3 });
    layer0.add(new THREE.Line(brtLineGeo, brtLineMat));

    // Hub CP2B na Camada 1
    const hub = CAMPINAS_DATA.corredor_brt.hubs_biometano[0];
    const [hubX, hubZ] = projectCoord(hub.lon, hub.lat);
    const hubMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 0.55, 24),
      new THREE.MeshStandardMaterial({ color: '#10b981', emissive: '#059669', emissiveIntensity: 0.9 })
    );
    hubMesh.position.set(hubX, 0.3, hubZ);
    layer1.add(hubMesh);

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

      const geo0 = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false });
      geo0.rotateX(-Math.PI / 2);
      const mat0 = new THREE.MeshStandardMaterial({ color: getVulnColor(s.vulnerabilidade_ivsg), roughness: 0.4 });
      const mesh0 = new THREE.Mesh(geo0, mat0);
      mesh0.position.set(cx, 0, cz);
      mesh0.userData = { sectorId: s.id };
      layer0.add(mesh0);

      const geoUnit = new THREE.ExtrudeGeometry(shape, { depth: 1.0, bevelEnabled: false });
      geoUnit.rotateX(-Math.PI / 2);

      const mat1 = new THREE.MeshStandardMaterial({ color: '#10b981', transparent: true, opacity: 0.62 });
      const mesh1 = new THREE.Mesh(geoUnit, mat1);
      mesh1.position.set(cx, 0, cz);
      mesh1.scale.set(0.92, 0.4, 0.92);
      mesh1.userData = { sectorId: s.id };
      layer1.add(mesh1);

      const mat2 = new THREE.MeshStandardMaterial({ color: getEmissColor(s.mp25_ugm3), transparent: true, opacity: 0.88 });
      const mesh2 = new THREE.Mesh(geoUnit, mat2);
      mesh2.position.set(cx, 0, cz);
      mesh2.scale.set(0.78, 1.0, 0.78);
      mesh2.userData = { sectorId: s.id };
      layer2.add(mesh2);

      pickableMeshes.push(mesh0, mesh1, mesh2);

      if (idx % 2 === 0) {
        const start = new THREE.Vector3(cx, 0.25, cz);
        const end = new THREE.Vector3(hubX, 0.35, hubZ);
        const dist = Math.hypot(cx - hubX, cz - hubZ);
        const curve = new THREE.CubicBezierCurve3(
          start,
          new THREE.Vector3((cx*2+hubX)/3, 0.9 + dist*0.14, (cz*2+hubZ)/3),
          new THREE.Vector3((cx+hubX*2)/3, 1.1 + dist*0.14, (cz+hubZ*2)/3),
          end
        );
        const arcGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
        const arcMat = new THREE.LineBasicMaterial({ color: '#10b981', transparent: true, opacity: 0.4 });
        layer1.add(new THREE.Line(arcGeo, arcMat));

        const pMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), new THREE.MeshBasicMaterial({ color: '#4ade80' }));
        layer1.add(pMesh);
        particles.push({ mesh: pMesh, curve, offset: idx * 0.11 });
      }

      sectorObjects.push({ s, cx, cz, mesh0, mesh1, mesh2, mat0, mat1, mat2 });
    });

    const laserCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 12, 20),
      new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.32 })
    );
    scene.add(laserCyl);

    let params = { zSpread: 65, bio: 45, green: 40, modal: 35 };
    let activeSectorId = 18;
    let simulatedSectors = [];

    function updateSimulation() {
      const bio = params.bio / 100, green = params.green / 100, modal = params.modal / 100;
      let totCo2Base = 0, totCo2Sim = 0, totBioCredit = 0, wMp25Base = 0, wMp25Sim = 0, sumJustica = 0, totBioNm3 = 0;

      simulatedSectors = sectorObjects.map((obj) => {
        const s = obj.s;
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
        obj.mat0.color.set(getVulnColor(simIvsg));
        obj.mat0.emissive.set(isFocus ? '#f43f5e' : '#000000');
        obj.mat0.emissiveIntensity = isFocus ? 0.5 : 0;

        obj.mesh1.scale.y = Math.max(0.08, (simCobArb / 45) * 0.95);
        obj.mat1.opacity = isFocus ? 0.9 : 0.58;

        obj.mesh2.scale.y = Math.max(0.18, (simMjTotal / 16000) * 2.2);
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
        <div class="flex justify-between items-start border-b border-slate-800 pb-2 mb-2.5">
          <div>
            <span class="px-2 py-0.5 rounded bg-sky-500/20 text-[10px] font-mono font-bold text-sky-300">IBGE \${active.cd_setor}</span>
            <span class="text-[11px] font-mono text-slate-400 ml-2">km \${active.km_corredor} do BRT</span>
            <h3 class="text-sm font-bold text-slate-100 mt-1">\${active.nome_local}</h3>
            <p class="text-[11px] text-slate-400">Distrito: <strong class="text-slate-200">\${active.distrito}</strong> · Pop: <strong class="text-slate-200">\${active.populacao} hab</strong></p>
          </div>
        </div>
        <div class="space-y-2 text-xs">
          <div class="p-2 rounded-lg bg-fuchsia-950/30 border border-fuchsia-500/30 grid grid-cols-3 gap-2">
            <div><span class="text-[10px] text-slate-400 block">Renda Média</span><span class="font-mono font-bold">R$ \${active.renda_media_rs.toLocaleString('pt-BR')}</span></div>
            <div><span class="text-[10px] text-slate-400 block">Chefia Feminina</span><span class="font-mono font-bold text-fuchsia-300">\${active.pct_chefia_feminina}%</span></div>
            <div><span class="text-[10px] text-slate-400 block">IVSG Simulado</span><span class="font-mono font-bold">\${active.simIvsg}</span></div>
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

    ['zSpread', 'bio', 'green', 'modal'].forEach(k => {
      const el = document.getElementById('sl-' + k);
      el.addEventListener('input', (e) => {
        params[k] = Number(e.target.value);
        document.getElementById('val-' + k).textContent = params[k] + '%';
        updateSimulation();
      });
    });

    window.setPreset = function(z, b, g, m) {
      params = { zSpread: z, bio: b, green: g, modal: m };
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
      const targetS = params.zSpread / 100;
      layer1.position.y += ((0.22 + targetS * 4.4) - layer1.position.y) * 0.1;
      layer2.position.y += ((0.45 + targetS * 9.0) - layer2.position.y) * 0.1;

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
console.log('✓ prototipo-campinas-standalone.html gerado com sucesso!');
