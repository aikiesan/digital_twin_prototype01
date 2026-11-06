import fs from 'fs';

const SHP_OSM_DIR = 'C:/Users/Lucas/Documents/CP2B/Validacao_dados/02_LITERATURA/PROTOCO_CODIGESTAO/sudeste-260112-free.shp';
const DEM_TIF_PATH = 'C:/Users/Lucas/Documents/CP2B/Validacao_dados/02_LITERATURA/PROTOCO_CODIGESTAO/22S48_ZN/22S48_ZN.tif';

const demFd = fs.openSync(DEM_TIF_PATH, 'r');
const DEM_WIDTH = 5400;
const DEM_HEIGHT = 3600;
const DEM_ORIGIN_LON = -48.0;
const DEM_ORIGIN_LAT = -22.0;
const DEM_PIXEL_SCALE = 0.0002777777777777778;

function sampleDem(lon, lat) {
  const col = Math.max(0, Math.min(DEM_WIDTH - 1, Math.floor((lon - DEM_ORIGIN_LON) / DEM_PIXEL_SCALE)));
  const row = Math.max(0, Math.min(DEM_HEIGHT - 1, Math.floor((DEM_ORIGIN_LAT - lat) / DEM_PIXEL_SCALE)));
  const buf = Buffer.alloc(4);
  fs.readSync(demFd, buf, 0, 4, 8 + (row * DEM_WIDTH + col) * 4);
  const val = buf.readFloatLE(0);
  return (!Number.isFinite(val) || val < 300 || val > 1500) ? 645.0 : Math.round(val * 10) / 10;
}

// BBox do Corredor Campinas (Centro -> John Boyd Dunlop -> Campo Grande / Itajaí)
// lon: [-47.225, -47.040], lat: [-22.975, -22.885]
const bbox = [-47.225, -22.975, -47.040, -22.885];

function extractRoadsAndWater() {
  const basePath = `${SHP_OSM_DIR}/gis_osm_roads_free_1`;
  const shxBuf = fs.readFileSync(basePath + '.shx');
  const numRecords = (shxBuf.length - 100) / 8;
  const shpFd = fs.openSync(basePath + '.shp', 'r');
  const dbfFd = fs.openSync(basePath + '.dbf', 'r');

  const dbfHdr = Buffer.alloc(32);
  fs.readSync(dbfFd, dbfHdr, 0, 32, 0);
  const headerBytes = dbfHdr.readUInt16LE(8);
  const recordBytes = dbfHdr.readUInt16LE(10);
  const numFields = Math.floor((headerBytes - 33) / 32);
  const fieldsDescBuf = Buffer.alloc(numFields * 32);
  fs.readSync(dbfFd, fieldsDescBuf, 0, numFields * 32, 32);

  const fields = [];
  let fieldOffset = 1;
  for (let f = 0; f < numFields; f++) {
    const fBuf = fieldsDescBuf.subarray(f * 32, (f + 1) * 32);
    const nameEnd = fBuf.indexOf(0);
    const name = fBuf.subarray(0, nameEnd > 0 && nameEnd <= 11 ? nameEnd : 11).toString('utf8').trim();
    const len = fBuf[16];
    fields.push({ name, len, offset: fieldOffset });
    fieldOffset += len;
  }

  const hdrBuf = Buffer.alloc(44);
  const tiers = {
    highways: [],     // motorway, trunk
    arterials: [],    // primary, busway, Av. John Boyd Dunlop
    collectors: [],   // secondary, tertiary
    localStreets: []  // residential, living_street, unclassified, service
  };

  for (let i = 0; i < numRecords; i++) {
    const offsetWords = shxBuf.readInt32BE(100 + i * 8);
    const contentLenWords = shxBuf.readInt32BE(100 + i * 8 + 4);
    const byteOffset = offsetWords * 2;
    const byteLen = contentLenWords * 2;
    if (byteLen < 36) continue;

    fs.readSync(shpFd, hdrBuf, 0, 44, byteOffset);
    const shapeType = hdrBuf.readInt32LE(8);
    if (shapeType !== 3) continue;

    const minX = hdrBuf.readDoubleLE(12);
    const minY = hdrBuf.readDoubleLE(20);
    const maxX = hdrBuf.readDoubleLE(28);
    const maxY = hdrBuf.readDoubleLE(36);

    if (maxX < bbox[0] || minX > bbox[2] || maxY < bbox[1] || minY > bbox[3]) continue;

    const recBuf = Buffer.alloc(recordBytes);
    fs.readSync(dbfFd, recBuf, 0, recordBytes, headerBytes + i * recordBytes);
    const props = {};
    for (const fld of fields) {
      if (fld.name === 'fclass' || fld.name === 'name' || fld.name === 'osm_id') {
        props[fld.name] = recBuf.subarray(fld.offset, fld.offset + fld.len).toString('utf8').trim();
      }
    }

    const fc = (props.fclass || '').toLowerCase();
    const nm = (props.name || '').toLowerCase();

    let targetTier = null;
    if (fc.startsWith('motorway') || fc.startsWith('trunk')) {
      targetTier = 'highways';
    } else if (fc.startsWith('primary') || fc === 'busway' || nm.includes('john boyd') || nm.includes('ibirapuera') || nm.includes('amoreiras')) {
      targetTier = 'arterials';
    } else if (fc.startsWith('secondary') || fc.startsWith('tertiary')) {
      targetTier = 'collectors';
    } else if (fc === 'residential' || fc === 'living_street' || fc === 'unclassified' || fc === 'service') {
      // Sample local streets along the corridor buffer so we get crisp neighborhood blocks without overloading
      const midLon = (minX + maxX) / 2;
      const midLat = (minY + maxY) / 2;
      const t = Math.max(0, Math.min(1, (-47.055 - midLon) / 0.155));
      const axisLat = -22.905 - t * 0.052;
      if (Math.abs(midLat - axisLat) <= 0.025 && tiers.localStreets.length < 4500) {
        targetTier = 'localStreets';
      }
    }

    if (!targetTier) continue;

    const geomBuf = Buffer.alloc(byteLen);
    fs.readSync(shpFd, geomBuf, 0, byteLen, byteOffset + 8);
    const numParts = geomBuf.readInt32LE(36);
    const numPoints = geomBuf.readInt32LE(40);
    if (numPoints < 2 || numPoints > 5000) continue;

    const ptsOffset = 44 + numParts * 4;
    const coords = [];
    const step = numPoints > 40 ? Math.ceil(numPoints / 30) : 1;
    for (let ptIdx = 0; ptIdx < numPoints; ptIdx += step) {
      const lon = Math.round(geomBuf.readDoubleLE(ptsOffset + ptIdx * 16) * 1e5) / 1e5;
      const lat = Math.round(geomBuf.readDoubleLE(ptsOffset + ptIdx * 16 + 8) * 1e5) / 1e5;
      const elev = sampleDem(lon, lat);
      coords.push([lon, lat, elev]);
    }
    if (coords.length >= 2) {
      tiers[targetTier].push({
        id: props.osm_id,
        name: props.name || '',
        fclass: fc,
        coords
      });
    }
  }

  fs.closeSync(shpFd);
  fs.closeSync(dbfFd);
  return tiers;
}

console.log('Extraindo hierarquia viária completa de Campinas (Rodovias + Arteriais + Coletoras + Ruas Locais Menores)...');
const roadTiers = extractRoadsAndWater();
console.log(`   -> Rodovias (Tier 1): ${roadTiers.highways.length}`);
console.log(`   -> Arteriais & BRT (Tier 2): ${roadTiers.arterials.length}`);
console.log(`   -> Coletoras (Tier 3): ${roadTiers.collectors.length}`);
console.log(`   -> Ruas Locais Menores (Tier 4): ${roadTiers.localStreets.length}`);

const existingData = JSON.parse(fs.readFileSync('src/data/campinasRealData.json', 'utf8'));
const step1Data = {
  relevo_3d: existingData.relevo_3d,
  waterways: existingData.basemap?.waterways || [],
  parks: existingData.basemap?.parks || [],
  roadTiers
};

fs.writeFileSync('public/data/step1_campinas_basemap_roads.json', JSON.stringify(step1Data));
console.log('Salvo em public/data/step1_campinas_basemap_roads.json!');
fs.closeSync(demFd);
