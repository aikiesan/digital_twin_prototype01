// ============================================================================
// PILOTO 01 - Unicamp + Barão Geraldo (Campinas-SP)
// Extração limpa de ruas, cursos d'água e espelhos d'água do OSM (Geofabrik)
// - SEM simplificação de geometria (todos os vértices preservados)
// - SEM limite de quantidade
// - Recorte exato ao bbox (clipping segmento a segmento)
// - Cota do DEM 30 m guardada como atributo (visual será plano, z = 0)
// ============================================================================
import fs from 'fs';

const OSM_DIR = 'C:/Users/Lucas/Documents/CP2B/Validacao_dados/02_LITERATURA/PROTOCO_CODIGESTAO/sudeste-260112-free.shp';
const DEM_TIF_PATH = 'C:/Users/Lucas/Documents/CP2B/Validacao_dados/02_LITERATURA/PROTOCO_CODIGESTAO/22S48_ZN/22S48_ZN.tif';
const OUT_PATH = 'public/data/pilot01_barao_geraldo.json';

// [minLon, minLat, maxLon, maxLat]
const BBOX = [-47.110, -22.855, -47.040, -22.785];

// ---------------------------------------------------------------- DEM -------
const DEM = { w: 5400, h: 3600, lon0: -48.0, lat0: -22.0, px: 1 / 3600 };
const demFd = fs.openSync(DEM_TIF_PATH, 'r');
const demBuf = Buffer.alloc(4);
function sampleDem(lon, lat) {
  const col = Math.max(0, Math.min(DEM.w - 1, Math.floor((lon - DEM.lon0) / DEM.px)));
  const row = Math.max(0, Math.min(DEM.h - 1, Math.floor((DEM.lat0 - lat) / DEM.px)));
  fs.readSync(demFd, demBuf, 0, 4, 8 + (row * DEM.w + col) * 4);
  const v = demBuf.readFloatLE(0);
  return (!Number.isFinite(v) || v < 300 || v > 1500) ? null : Math.round(v * 10) / 10;
}

// ------------------------------------------------------------ CLIPPING ------
const inside = (x, y) => x >= BBOX[0] && x <= BBOX[2] && y >= BBOX[1] && y <= BBOX[3];

// Liang–Barsky: retorna [t0, t1] ou null
function clipSeg(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - BBOX[0], BBOX[2] - x0, y0 - BBOX[1], BBOX[3] - y0];
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const r = q[i] / p[i];
    if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
    else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [t0, t1];
}

// Recorta uma polilinha no bbox, devolvendo 0..n trechos contínuos
function clipPolyline(pts) {
  const runs = [];
  let cur = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const c = clipSeg(x0, y0, x1, y1);
    if (!c) { if (cur.length > 1) runs.push(cur); cur = []; continue; }
    const a = [x0 + (x1 - x0) * c[0], y0 + (y1 - y0) * c[0]];
    const b = [x0 + (x1 - x0) * c[1], y0 + (y1 - y0) * c[1]];
    if (cur.length === 0) cur.push(a);
    cur.push(b);
    if (c[1] < 1) { if (cur.length > 1) runs.push(cur); cur = []; }
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}

// Sutherland–Hodgman para polígonos (anéis)
function clipRing(ring) {
  const edges = [
    (p) => p[0] >= BBOX[0], (p) => p[0] <= BBOX[2],
    (p) => p[1] >= BBOX[1], (p) => p[1] <= BBOX[3],
  ];
  const isect = (a, b, k) => {
    const [axis, val] = [[0, BBOX[0]], [0, BBOX[2]], [1, BBOX[1]], [1, BBOX[3]]][k];
    const t = (val - a[axis]) / (b[axis] - a[axis]);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  let out = ring;
  for (let k = 0; k < 4 && out.length; k++) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const cur = inp[i], prev = inp[(i + inp.length - 1) % inp.length];
      const cIn = edges[k](cur), pIn = edges[k](prev);
      if (cIn) { if (!pIn) out.push(isect(prev, cur, k)); out.push(cur); }
      else if (pIn) out.push(isect(prev, cur, k));
    }
  }
  return out;
}

const r6 = (v) => Math.round(v * 1e6) / 1e6;
const withElev = (pts) => pts.map(([x, y]) => [r6(x), r6(y), sampleDem(x, y)]);

// --------------------------------------------------------- SHAPEFILE IO -----
function openLayer(name, wantedFields) {
  const base = `${OSM_DIR}/${name}`;
  const shx = fs.readFileSync(base + '.shx');
  const shpFd = fs.openSync(base + '.shp', 'r');
  const dbfFd = fs.openSync(base + '.dbf', 'r');
  const h = Buffer.alloc(32); fs.readSync(dbfFd, h, 0, 32, 0);
  const headerBytes = h.readUInt16LE(8), recordBytes = h.readUInt16LE(10);
  const nf = Math.floor((headerBytes - 33) / 32);
  const fd = Buffer.alloc(nf * 32); fs.readSync(dbfFd, fd, 0, nf * 32, 32);
  const fields = []; let off = 1;
  for (let f = 0; f < nf; f++) {
    const b = fd.subarray(f * 32, f * 32 + 32);
    const z = b.indexOf(0);
    const name = b.subarray(0, z > 0 && z <= 11 ? z : 11).toString('latin1').trim();
    fields.push({ name, len: b[16], off }); off += b[16];
  }
  return {
    n: (shx.length - 100) / 8,
    *records() {
      const hdr = Buffer.alloc(44);
      const rec = Buffer.alloc(recordBytes);
      for (let i = 0; i < this.n; i++) {
        const byteOffset = shx.readInt32BE(100 + i * 8) * 2;
        const byteLen = shx.readInt32BE(104 + i * 8) * 2;
        if (byteLen < 44) continue;
        fs.readSync(shpFd, hdr, 0, 44, byteOffset);
        const type = hdr.readInt32LE(8);
        const minX = hdr.readDoubleLE(12), minY = hdr.readDoubleLE(20);
        const maxX = hdr.readDoubleLE(28), maxY = hdr.readDoubleLE(36);
        if (maxX < BBOX[0] || minX > BBOX[2] || maxY < BBOX[1] || minY > BBOX[3]) continue;
        fs.readSync(dbfFd, rec, 0, recordBytes, headerBytes + i * recordBytes);
        const props = {};
        for (const f of fields) if (wantedFields.includes(f.name))
          props[f.name] = rec.subarray(f.off, f.off + f.len).toString('utf8').trim();
        const g = Buffer.alloc(byteLen);
        fs.readSync(shpFd, g, 0, byteLen, byteOffset + 8);
        const nParts = g.readInt32LE(36), nPts = g.readInt32LE(40);
        const partIdx = [];
        for (let p = 0; p < nParts; p++) partIdx.push(g.readInt32LE(44 + p * 4));
        partIdx.push(nPts);
        const ptsOff = 44 + nParts * 4;
        const parts = [];
        for (let p = 0; p < nParts; p++) {
          const pts = [];
          for (let k = partIdx[p]; k < partIdx[p + 1]; k++)
            pts.push([g.readDoubleLE(ptsOff + k * 16), g.readDoubleLE(ptsOff + k * 16 + 8)]);
          parts.push(pts);
        }
        yield { type, props, parts };
      }
    },
    close() { fs.closeSync(shpFd); fs.closeSync(dbfFd); },
  };
}

// -------------------------------------------------------- CLASSIFICAÇÃO -----
function roadTier(fc) {
  if (/^(motorway|trunk)/.test(fc)) return 'rodovias';
  if (/^primary/.test(fc)) return 'arteriais';
  if (/^(secondary|tertiary)/.test(fc)) return 'coletoras';
  if (['residential', 'living_street', 'unclassified', 'road'].includes(fc)) return 'locais';
  if (fc === 'service') return 'servico';
  if (['footway', 'path', 'pedestrian', 'cycleway', 'steps', 'track', 'bridleway'].includes(fc) || fc.startsWith('track')) return 'pedestres';
  return null;
}

// --------------------------------------------------------------- RUN --------
console.log(`Recorte Piloto 01 (Unicamp + Barão Geraldo): ${BBOX.join(', ')}`);

const roads = { rodovias: [], arteriais: [], coletoras: [], locais: [], servico: [], pedestres: [] };
const fclassCount = {};
let L = openLayer('gis_osm_roads_free_1', ['osm_id', 'fclass', 'name', 'ref', 'oneway', 'layer', 'bridge', 'tunnel']);
for (const { type, props, parts } of L.records()) {
  if (type !== 3) continue;
  const fc = (props.fclass || '').toLowerCase();
  const tier = roadTier(fc);
  if (!tier) continue;
  fclassCount[fc] = (fclassCount[fc] || 0) + 1;
  for (const part of parts) for (const run of clipPolyline(part)) {
    roads[tier].push({
      id: props.osm_id, name: props.name || '', ref: props.ref || '', fclass: fc,
      oneway: props.oneway || '', layer: Number(props.layer || 0),
      bridge: props.bridge === 'T', tunnel: props.tunnel === 'T',
      coords: withElev(run),
    });
  }
}
L.close();

const waterways = [];
L = openLayer('gis_osm_waterways_free_1', ['osm_id', 'fclass', 'name', 'width']);
for (const { type, props, parts } of L.records()) {
  if (type !== 3) continue;
  for (const part of parts) for (const run of clipPolyline(part))
    waterways.push({ id: props.osm_id, name: props.name || '', fclass: (props.fclass || '').toLowerCase(), coords: withElev(run) });
}
L.close();

// Área do anel (sinal): no shapefile, anéis externos são horários (área < 0 em lon/lat)
const ringArea = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const waterAreas = [];
L = openLayer('gis_osm_water_a_free_1', ['osm_id', 'fclass', 'name']);
for (const { type, props, parts } of L.records()) {
  if (type !== 5) continue;
  for (const ring of parts) {
    if (ringArea(ring) > 0) continue; // ignora furos
    const c = clipRing(ring.slice(0, -1));
    if (c.length >= 3) waterAreas.push({ id: props.osm_id, name: props.name || '', fclass: (props.fclass || '').toLowerCase(), ring: withElev(c) });
  }
}
L.close();
fs.closeSync(demFd);

const out = {
  meta: {
    piloto: 'Piloto 01 - Unicamp + Barão Geraldo',
    municipio: 'Campinas-SP (3509502)',
    bbox: BBOX,
    centro: [(BBOX[0] + BBOX[2]) / 2, (BBOX[1] + BBOX[3]) / 2],
    fonte_vias: 'OpenStreetMap / Geofabrik sudeste-260112 (gis_osm_roads_free_1)',
    fonte_agua: 'OpenStreetMap / Geofabrik (gis_osm_waterways_free_1, gis_osm_water_a_free_1)',
    fonte_cota: 'DEM 22S48_ZN (30 m) - cota em metros como 3º valor de cada coordenada; visual plano',
    gerado_em: new Date().toISOString(),
  },
  roads, waterways, waterAreas,
};
fs.writeFileSync(OUT_PATH, JSON.stringify(out));

console.log('\nVias por categoria:');
for (const [k, v] of Object.entries(roads)) console.log(`  ${k.padEnd(10)} ${String(v.length).padStart(6)} trechos`);
console.log(`Cursos d'água: ${waterways.length} | Espelhos d'água: ${waterAreas.length}`);
console.log('\nfclass encontrados:', JSON.stringify(fclassCount));
const named = new Set(Object.values(roads).flat().map((r) => r.name).filter(Boolean));
console.log(`Ruas com nome distinto: ${named.size}`);
console.log(`Salvo em ${OUT_PATH} (${(fs.statSync(OUT_PATH).size / 1e6).toFixed(2)} MB)`);
