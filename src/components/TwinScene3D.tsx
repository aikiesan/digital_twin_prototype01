import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Cp2bNode, OsmBuilding3D, SectorSimulated, SimulationParams } from '../types';
import {
  projectCoord,
  elevToSceneY,
  getPeopleLayerColor,
  getEmissionsColor,
} from '../simulationEngine';
import campinasData from '../data/campinasRealData.json';
import { BlenderGlbBridge } from './BlenderGlbBridge';

interface TwinScene3DProps {
  sectors: SectorSimulated[];
  params: SimulationParams;
  selectedSectorId: number | null;
  hoveredSectorId: number | null;
  selectedCp2bNode: Cp2bNode | null;
  onSelectSector: (id: number | null) => void;
  onHoverSector: (id: number | null) => void;
  onSelectCp2bNode: (node: Cp2bNode | null) => void;
}

function createPolygonShape(polygon: [number, number][], cx: number, cz: number): THREE.Shape {
  const shape = new THREE.Shape();
  polygon.forEach(([lon, lat], idx) => {
    const [px, pz] = projectCoord(lon, lat);
    const lx = px - cx;
    const ly = -(pz - cz);
    if (idx === 0) shape.moveTo(lx, ly);
    else shape.lineTo(lx, ly);
  });
  shape.closePath();
  return shape;
}

// ============================================================================
// ETAPA 1: BASEMAP CARTOGRÁFICO DE CAMPINAS + MODELO DIGITAL DE ELEVAÇÃO (DEM 30m)
// Inclui Relevo 22S48_ZN.tif (547m-789m), 2.200 Vias OSM, Rios (Capivari/Piçarrão/Anhumas),
// Espelhos d'Água e 450 Parques/Florestas Urbanas
// ============================================================================
const CampinasBasemapAndDem: React.FC<{
  terrainExaggeration: number;
  isDaylight: boolean;
  showPipelines: boolean;
}> = ({ terrainExaggeration, isDaylight, showPipelines }) => {
  const relevo = campinasData.relevo_3d;
  const basemap = (campinasData as unknown as {
    basemap?: {
      roads: { osmId: string; name: string; fclass: string; isBrtCorridor: boolean; coords: [number, number][] }[];
      waterways: { osmId: string; name: string; fclass: string; coords: [number, number][] }[];
      waterBodies: { osmId: string; name: string; fclass: string; coords: [number, number][] }[];
      parks: { osmId: string; name: string; fclass: string; coords: [number, number][] }[];
      gasPipelines: { name: string; operator: string; kind: string; coords: [number, number][] }[];
    };
  }).basemap;

  const sampleGridElev = (lon: number, lat: number) => {
    const cols = relevo.cols;
    const rows = relevo.rows;
    const cIdx = Math.max(0, Math.min(cols - 1, Math.round(((lon - relevo.lon_min) / (relevo.lon_max - relevo.lon_min)) * (cols - 1))));
    const rIdx = Math.max(0, Math.min(rows - 1, Math.round(((relevo.lat_max - lat) / (relevo.lat_max - relevo.lat_min)) * (rows - 1))));
    return relevo.heights_m[rIdx]?.[cIdx] ?? 640;
  };

  const { terrainGeo, cx, cz, contourLines, roadLines, brtRoadLines, waterwayLines, pipelineLines, parkMeshes, waterMeshes } = useMemo(() => {
    const cols = relevo.cols;
    const rows = relevo.rows;
    const [xMin, zMax] = projectCoord(relevo.lon_min, relevo.lat_min);
    const [xMax, zMin] = projectCoord(relevo.lon_max, relevo.lat_max);
    const width = xMax - xMin;
    const depth = zMax - zMin;
    const centerX = (xMin + xMax) / 2;
    const centerZ = (zMin + zMax) / 2;

    const geo = new THREE.PlaneGeometry(width, depth, cols - 1, rows - 1);
    geo.rotateX(-Math.PI / 2);

    const posAttr = geo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    // Paleta arquitetônica limpa inspirada nas 2 imagens de referência (solo cinza-azulado claro em daylight)
    const cLow = new THREE.Color(isDaylight ? '#cbd5e1' : '#091322');
    const cMid = new THREE.Color(isDaylight ? '#e2e8f0' : '#0f1d33');
    const cHigh = new THREE.Color(isDaylight ? '#f1f5f9' : '#172a46');

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const elevM = relevo.heights_m[r][c];
        const y = elevToSceneY(elevM, terrainExaggeration) - 0.12;
        posAttr.setY(idx, y);

        const t = Math.max(0, Math.min(1, (elevM - relevo.elev_min_m) / (relevo.elev_max_m - relevo.elev_min_m)));
        const col = t < 0.5 ? cLow.clone().lerp(cMid, t * 2) : cMid.clone().lerp(cHigh, (t - 0.5) * 2);
        colors[idx * 3] = col.r;
        colors[idx * 3 + 1] = col.g;
        colors[idx * 3 + 2] = col.b;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    // Contornos topográficos (Stacked SVG Slices)
    const contours: THREE.Vector3[][] = [];
    for (let r = 2; r < rows - 2; r += 3) {
      const linePts: THREE.Vector3[] = [];
      const lat = relevo.lat_max - (r / (rows - 1)) * (relevo.lat_max - relevo.lat_min);
      for (let c = 0; c < cols; c++) {
        const lon = relevo.lon_min + (c / (cols - 1)) * (relevo.lon_max - relevo.lon_min);
        const [px, pz] = projectCoord(lon, lat);
        const y = elevToSceneY(relevo.heights_m[r][c], terrainExaggeration) - 0.09;
        linePts.push(new THREE.Vector3(px, y, pz));
      }
      contours.push(linePts);
    }

    // Malha Viária OSM Real de Campinas
    const roads: THREE.Vector3[][] = [];
    const brtRoads: THREE.Vector3[][] = [];
    (basemap?.roads || []).slice(0, 1400).forEach((r) => {
      if (!r.coords || r.coords.length < 2) return;
      const pts = r.coords.map(([lon, lat]) => {
        const [rx, rz] = projectCoord(lon, lat);
        const elev = sampleGridElev(lon, lat);
        return new THREE.Vector3(rx, elevToSceneY(elev, terrainExaggeration) - 0.04, rz);
      });
      if (r.isBrtCorridor) brtRoads.push(pts);
      else roads.push(pts);
    });

    // Hidrografia OSM Real (Rio Capivari, Ribeirão Piçarrão, Anhumas, Atibaia)
    const waterways: THREE.Vector3[][] = [];
    (basemap?.waterways || []).slice(0, 350).forEach((w) => {
      if (!w.coords || w.coords.length < 2) return;
      const pts = w.coords.map(([lon, lat]) => {
        const [wx, wz] = projectCoord(lon, lat);
        const elev = sampleGridElev(lon, lat);
        return new THREE.Vector3(wx, elevToSceneY(elev, terrainExaggeration) - 0.05, wz);
      });
      waterways.push(pts);
    });

    // Gasodutos Comgás, GASBOL e Anel de Biometano CP2B
    const pipes: { kind: string; name: string; pts: THREE.Vector3[] }[] = [];
    (basemap?.gasPipelines || []).forEach((p) => {
      if (!p.coords || p.coords.length < 2) return;
      const pts = p.coords.map(([lon, lat]) => {
        const [px, pz] = projectCoord(lon, lat);
        const elev = sampleGridElev(lon, lat);
        return new THREE.Vector3(px, elevToSceneY(elev, terrainExaggeration) + 0.03, pz);
      });
      pipes.push({ kind: p.kind, name: p.name, pts });
    });

    // Parques e Áreas Verdes OSM sobre o DEM (como o parque à esquerda na imagem 2 de referência)
    const pMeshes: { geo: THREE.ShapeGeometry; x: number; y: number; z: number }[] = [];
    (basemap?.parks || []).slice(0, 220).forEach((p) => {
      if (!p.coords || p.coords.length < 4) return;
      const [lon0, lat0] = p.coords[0];
      const [px0, pz0] = projectCoord(lon0, lat0);
      const elev = sampleGridElev(lon0, lat0);
      const shape = createPolygonShape(p.coords, px0, pz0);
      const sGeo = new THREE.ShapeGeometry(shape);
      sGeo.rotateX(-Math.PI / 2);
      pMeshes.push({
        geo: sGeo,
        x: px0,
        y: elevToSceneY(elev, terrainExaggeration) - 0.07,
        z: pz0,
      });
    });

    // Espelhos d'água OSM (Lagoa do Taquaral, Lago do Café, Represas)
    const wMeshes: { geo: THREE.ShapeGeometry; x: number; y: number; z: number }[] = [];
    (basemap?.waterBodies || []).slice(0, 120).forEach((w) => {
      if (!w.coords || w.coords.length < 4) return;
      const [lon0, lat0] = w.coords[0];
      const [wx0, wz0] = projectCoord(lon0, lat0);
      const elev = sampleGridElev(lon0, lat0);
      const shape = createPolygonShape(w.coords, wx0, wz0);
      const sGeo = new THREE.ShapeGeometry(shape);
      sGeo.rotateX(-Math.PI / 2);
      wMeshes.push({
        geo: sGeo,
        x: wx0,
        y: elevToSceneY(elev, terrainExaggeration) - 0.06,
        z: wz0,
      });
    });

    return {
      terrainGeo: geo,
      cx: centerX,
      cz: centerZ,
      contourLines: contours,
      roadLines: roads,
      brtRoadLines: brtRoads,
      waterwayLines: waterways,
      pipelineLines: pipes,
      parkMeshes: pMeshes,
      waterMeshes: wMeshes,
    };
  }, [relevo, basemap, terrainExaggeration, isDaylight]);

  return (
    <group>
      {/* Placa Topográfica 3D do DEM 22S48_ZN.tif */}
      <mesh geometry={terrainGeo} position={[cx, 0, cz]} receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.85}
          metalness={0.04}
        />
      </mesh>

      {/* Parques e Matas Urbanas OSM sobre o Basemap */}
      {parkMeshes.map((pm, idx) => (
        <mesh key={`park-${idx}`} geometry={pm.geo} position={[pm.x, pm.y, pm.z]} receiveShadow>
          <meshStandardMaterial
            color={isDaylight ? '#bbf7d0' : '#064e3b'}
            roughness={0.9}
            transparent
            opacity={isDaylight ? 0.88 : 0.65}
          />
        </mesh>
      ))}

      {/* Espelhos d'Água OSM sobre o Basemap */}
      {waterMeshes.map((wm, idx) => (
        <mesh key={`water-body-${idx}`} geometry={wm.geo} position={[wm.x, wm.y, wm.z]}>
          <meshStandardMaterial
            color={isDaylight ? '#7dd3fc' : '#0284c7'}
            roughness={0.2}
            metalness={0.3}
          />
        </mesh>
      ))}

      {/* Contornos Altimétricos Vetoriais (SRTM 30m) */}
      {contourLines.map((pts, i) => (
        <Line
          key={`contour-${i}`}
          points={pts}
          color={isDaylight ? '#94a3b8' : '#1e3a5f'}
          lineWidth={0.75}
          transparent
          opacity={isDaylight ? 0.35 : 0.3}
        />
      ))}

      {/* Rios e Córregos OSM (Rio Capivari, Ribeirão Piçarrão, Anhumas) */}
      {waterwayLines.map((pts, i) => (
        <Line
          key={`waterway-${i}`}
          points={pts}
          color={isDaylight ? '#38bdf8' : '#0ea5e9'}
          lineWidth={2.0}
          transparent
          opacity={0.82}
        />
      ))}

      {/* Malha Viária Arterial e Coletora de Campinas (OSM Roads) */}
      {roadLines.map((pts, i) => (
        <Line
          key={`osm-road-${i}`}
          points={pts}
          color={isDaylight ? '#64748b' : '#334155'}
          lineWidth={1.1}
          transparent
          opacity={isDaylight ? 0.55 : 0.45}
        />
      ))}

      {/* Eixos Viários do Corredor BRT (Av. John Boyd Dunlop / Av. Ibirapuera) */}
      {brtRoadLines.map((pts, i) => (
        <Line
          key={`osm-brt-road-${i}`}
          points={pts}
          color={isDaylight ? '#0284c7' : '#38bdf8'}
          lineWidth={3.2}
          transparent
          opacity={0.9}
        />
      ))}

      {/* Rede de Gasodutos Comgás, GASBOL e Anel Dedicado Biometano CP2B */}
      {showPipelines &&
        pipelineLines.map((pipe, i) => {
          const isCp2bRing = pipe.kind.includes('CP2B');
          return (
            <Line
              key={`pipe-${i}`}
              points={pipe.pts}
              color={isCp2bRing ? '#10b981' : '#f59e0b'}
              lineWidth={isCp2bRing ? 3.5 : 2.0}
              dashed={!isCp2bRing}
              dashScale={5}
              dashSize={0.4}
              transparent
              opacity={0.9}
            />
          );
        })}
    </group>
  );
};

// ============================================================================
// ETAPA 2: EDIFÍCIOS 3D REAIS DO OPENSTREETMAP (1.850 FOOTPRINTS) ANCORADOS NO DEM
// Estilo "White Clay Architectural City" com Edifícios Âncora em Verde/Âmbar/Vermelho
// e Pins Vetoriais SVG Empilhados (como nas 2 imagens de referência)
// ============================================================================
const CampinasOsmBuildings3DLayer: React.FC<{
  terrainExaggeration: number;
  biomethaneFleet: number;
  greenInfra: number;
  isDaylight: boolean;
  onSelectSector: (id: number | null) => void;
}> = ({ terrainExaggeration, biomethaneFleet, greenInfra, isDaylight }) => {
  const osmBuildings = ((campinasData as unknown as { osmBuildings3D?: OsmBuilding3D[] }).osmBuildings3D) || [];

  // Agrupa os 1.850 polígonos reais do OSM em malhas 3D extrudadas sobre o DEM
  const buildingMeshes = useMemo(() => {
    return osmBuildings.slice(0, 1450).map((b) => {
      const [cx, cz] = projectCoord(b.centroid[0], b.centroid[1]);
      const baseY = elevToSceneY(b.baseElevationM, terrainExaggeration) - 0.04;
      // Escala de altura arquitetônica proporcional ao relevo e gabarito real (levels * 3.2m)
      const sceneHeight = Math.max(0.14, (b.heightM / 32) * 0.95);

      const shape = createPolygonShape(b.coords, cx, cz);
      const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
        depth: sceneHeight,
        bevelEnabled: false,
      });
      extrudeGeo.rotateX(-Math.PI / 2);

      const edgesGeo = new THREE.EdgesGeometry(extrudeGeo, 25);

      return {
        ...b,
        cx,
        cz,
        baseY,
        sceneHeight,
        extrudeGeo,
        edgesGeo,
      };
    });
  }, [osmBuildings, terrainExaggeration]);

  // Seleciona os edifícios âncora para exibir os Pins Vetoriais SVG sobre os telhados (igual à imagem 2 de referência!)
  const calloutPins = useMemo(() => {
    return buildingMeshes.filter((b, idx) => {
      if (b.highlightRole !== 'standard' && idx % 6 === 0) return true;
      if (b.name && b.name.length > 3 && idx % 9 === 0) return true;
      return false;
    }).slice(0, 28);
  }, [buildingMeshes]);

  const mitigationScore = (biomethaneFleet * 0.55 + greenInfra * 0.45) / 100;

  return (
    <group>
      {buildingMeshes.map((b) => {
        // Cor dinâmica: edifícios críticos (vermelhos) convertem-se para âmbar e verde conforme o CP2B + Infra Verde avançam!
        let fillColor = isDaylight ? '#f8fafc' : '#cbd5e1'; // White clay padrão
        if (b.highlightRole === 'cp2b_green') {
          fillColor = '#22c55e'; // Verde Esmeralda CP2B
        } else if (b.highlightRole === 'brt_amber') {
          fillColor = mitigationScore > 0.75 ? '#10b981' : '#eab308'; // Âmbar Dourado -> Verde
        } else if (b.highlightRole === 'social_red') {
          fillColor = mitigationScore > 0.7 ? '#22c55e' : mitigationScore > 0.4 ? '#eab308' : '#ef4444'; // Vermelho Crítico -> Âmbar -> Verde
        }

        return (
          <group key={b.osmId} position={[b.cx, b.baseY, b.cz]}>
            <mesh geometry={b.extrudeGeo} castShadow receiveShadow>
              <meshStandardMaterial
                color={fillColor}
                roughness={b.highlightRole === 'standard' ? 0.42 : 0.28}
                metalness={b.highlightRole === 'standard' ? 0.08 : 0.18}
              />
            </mesh>
            <lineSegments geometry={b.edgesGeo}>
              <lineBasicMaterial
                color={b.highlightRole === 'standard' ? (isDaylight ? '#94a3b8' : '#475569') : '#0f172a'}
                transparent
                opacity={b.highlightRole === 'standard' ? 0.45 : 0.7}
              />
            </lineSegments>
          </group>
        );
      })}

      {/* PINS VETORIAIS SVG EM HASTES VERTICAIS SOBRE OS EDIFÍCIOS (Estética idêntica à Imagem 2 de referência) */}
      {calloutPins.map((b) => {
        const role =
          b.highlightRole === 'social_red' && mitigationScore > 0.65
            ? 'cp2b_green'
            : b.highlightRole;
        const badgeBg =
          role === 'cp2b_green'
            ? 'bg-emerald-500 border-white text-white'
            : role === 'brt_amber'
            ? 'bg-amber-400 border-slate-900 text-slate-950'
            : role === 'social_red'
            ? 'bg-rose-600 border-white text-white'
            : 'bg-sky-500 border-white text-white';

        const iconSymbol =
          role === 'cp2b_green' ? '✓' : role === 'brt_amber' ? '⚡' : role === 'social_red' ? '!' : '🏢';

        const stemH = b.sceneHeight + 0.35;

        return (
          <group key={`pin-${b.osmId}`} position={[b.cx, b.baseY, b.cz]}>
            {/* Haste vertical fina preta/escura saindo do topo do edifício */}
            <Line
              points={[
                new THREE.Vector3(0, b.sceneHeight, 0),
                new THREE.Vector3(0, stemH, 0),
              ]}
              color={isDaylight ? '#1e293b' : '#e2e8f0'}
              lineWidth={1.6}
            />
            <Html position={[0, stemH + 0.05, 0]} center distanceFactor={22}>
              <div
                title={`${b.name || b.type} · ${b.levels} pavimentos · Alt. base DEM: ${b.baseElevationM}m`}
                className={`w-5 h-5 rounded-full border-2 shadow-md flex items-center justify-center text-[10px] font-black select-none pointer-events-auto cursor-pointer hover:scale-125 transition-transform ${badgeBg}`}
              >
                {iconSymbol}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

// ============================================================================
// ETAPA 3: REDE COMPLETA CP2B (30 ETEs SANASA + 40 INDÚSTRIAS + DELTA A + ONEBIO + UNICAMP)
// Conectando fisicamente e matematicamente V1 (Transporte/Energia) <-> V2 (CP2B) <-> V3 (Pessoas)
// ============================================================================
const Cp2bCompleteNetworkLayer: React.FC<{
  sectors: SectorSimulated[];
  layer1Y: number;
  terrainExaggeration: number;
  biomethaneFleet: number;
  greenInfra: number;
  selectedSectorId: number | null;
  hoveredSectorId: number | null;
  selectedCp2bNode: Cp2bNode | null;
  onSelectCp2bNode: (node: Cp2bNode | null) => void;
  isDaylight: boolean;
}> = ({
  sectors,
  layer1Y,
  terrainExaggeration,
  biomethaneFleet,
  greenInfra,
  selectedSectorId,
  hoveredSectorId,
  selectedCp2bNode,
  onSelectCp2bNode,
  isDaylight,
}) => {
  const cp2bNodes = (((campinasData as unknown as { cp2b?: { nodes: Cp2bNode[] } }).cp2b?.nodes) || []).filter(
    (n) =>
      n.coordinates[0] >= -47.245 &&
      n.coordinates[0] <= -46.965 &&
      n.coordinates[1] >= -23.015 &&
      n.coordinates[1] <= -22.745
  );

  const deltaANode = cp2bNodes.find((n) => n.nodeId === 'CP2B_DELTA_A') || cp2bNodes[0];
  const [hubX, hubZ] = useMemo(
    () => projectCoord(deltaANode?.coordinates[0] || -47.1472, deltaANode?.coordinates[1] || -22.9165),
    [deltaANode]
  );
  const hubTerrainY = elevToSceneY(deltaANode?.elevationM || 615, terrainExaggeration);

  const majorEtesAndPlants = useMemo(() => {
    return cp2bNodes.filter(
      (n) =>
        n.category === 'BIOMETHANE_PLANT' ||
        n.category === 'RESEARCH_HUB' ||
        n.category === 'BRT_BIOMETHANE_STATION' ||
        (n.category === 'ETE_SANASA' && n.biogasNm3Day >= 1000) ||
        (n.category === 'INDUSTRIAL_CODIGESTION' && n.biogasNm3Day >= 80)
    );
  }, [cp2bNodes]);

  // Arcos 3D: Setores Censitários (RSU + Poda + Esgoto) -> ETEs SANASA / Complexo Delta A -> Terminais BRT
  const { rsuCurves, brtReturnCurves } = useMemo(() => {
    const rsu = sectors
      .filter((_, idx) => idx % 2 === 0 || sectors[idx].id === selectedSectorId || sectors[idx].id === hoveredSectorId)
      .map((s) => {
        const [sx, sz] = projectCoord(s.centroid[0], s.centroid[1]);
        const sy = elevToSceneY(s.elevacao_m, terrainExaggeration);
        const start = new THREE.Vector3(sx, layer1Y + sy + 0.25, sz);
        const end = new THREE.Vector3(hubX, layer1Y + hubTerrainY + 0.45, hubZ);
        const midX = (sx + hubX) / 2;
        const midZ = (sz + hubZ) / 2;
        const dist = Math.hypot(sx - hubX, sz - hubZ);
        const ctrl1 = new THREE.Vector3(
          sx + (midX - sx) * 0.5,
          layer1Y + sy + 0.85 + dist * 0.12,
          sz + (midZ - sz) * 0.5
        );
        const ctrl2 = new THREE.Vector3(
          hubX + (midX - hubX) * 0.5,
          layer1Y + hubTerrainY + 1.05 + dist * 0.12,
          hubZ + (midZ - hubZ) * 0.5
        );
        const curve = new THREE.CubicBezierCurve3(start, ctrl1, ctrl2, end);
        return {
          sectorId: s.id,
          curve,
          points: curve.getPoints(26),
        };
      });

    const brtNodes = majorEtesAndPlants.filter((n) => n.category === 'BRT_BIOMETHANE_STATION' || n.category === 'ETE_SANASA');
    const brt = brtNodes.map((st, idx) => {
      const [tx, tz] = projectCoord(st.coordinates[0], st.coordinates[1]);
      const stElevY = elevToSceneY(st.elevationM, terrainExaggeration);
      const start = new THREE.Vector3(hubX, layer1Y + hubTerrainY + 0.48, hubZ);
      const end = new THREE.Vector3(tx, layer1Y + stElevY + 0.28, tz);
      const dist = Math.hypot(tx - hubX, tz - hubZ);
      const ctrl1 = new THREE.Vector3(
        hubX + (tx - hubX) * 0.35,
        layer1Y + hubTerrainY + 1.15 + dist * 0.1,
        hubZ + (tz - hubZ) * 0.35
      );
      const ctrl2 = new THREE.Vector3(
        hubX + (tx - hubX) * 0.75,
        layer1Y + stElevY + 1.1,
        hubZ + (tz - hubZ) * 0.75
      );
      const curve = new THREE.CubicBezierCurve3(start, ctrl1, ctrl2, end);
      return {
        id: st.nodeId,
        idx,
        curve,
        points: curve.getPoints(28),
      };
    });

    return { rsuCurves: rsu, brtReturnCurves: brt };
  }, [sectors, layer1Y, hubX, hubZ, hubTerrainY, majorEtesAndPlants, selectedSectorId, hoveredSectorId, terrainExaggeration]);

  const rsuParticlesRef = useRef<THREE.InstancedMesh>(null);
  const brtParticlesRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const flowSpeed = 0.18 + (biomethaneFleet / 100) * 0.55 + (greenInfra / 100) * 0.15;
  const particleScale = 0.065 + (biomethaneFleet / 100) * 0.075;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * flowSpeed;

    if (rsuParticlesRef.current) {
      let instanceIdx = 0;
      rsuCurves.forEach((item, cIdx) => {
        for (let p = 0; p < 2; p++) {
          const u = (t + cIdx * 0.13 + p * 0.5) % 1;
          const pos = item.curve.getPointAt(u);
          dummy.position.copy(pos);
          const isFocus = item.sectorId === selectedSectorId || item.sectorId === hoveredSectorId;
          const s = isFocus ? particleScale * 1.6 : particleScale;
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          rsuParticlesRef.current!.setMatrixAt(instanceIdx++, dummy.matrix);
        }
      });
      rsuParticlesRef.current.instanceMatrix.needsUpdate = true;
    }

    if (brtParticlesRef.current) {
      let instanceIdx = 0;
      brtReturnCurves.forEach((item, cIdx) => {
        for (let p = 0; p < 3; p++) {
          const u = (t * 1.25 + cIdx * 0.17 + p * 0.333) % 1;
          const pos = item.curve.getPointAt(u);
          dummy.position.copy(pos);
          const s = particleScale * 1.2;
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          brtParticlesRef.current!.setMatrixAt(instanceIdx++, dummy.matrix);
        }
      });
      brtParticlesRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const arcOpacity = 0.28 + (biomethaneFleet / 100) * 0.45;

  return (
    <group>
      {/* Nós Reais da Rede CP2B (ETEs SANASA, Usinas Biometano, Indústrias e Terminais BRT) */}
      {majorEtesAndPlants.map((node) => {
        const [nx, nz] = projectCoord(node.coordinates[0], node.coordinates[1]);
        const ny = elevToSceneY(node.elevationM, terrainExaggeration) + layer1Y;
        const isSelected = selectedCp2bNode?.nodeId === node.nodeId;
        const isPlant = node.category === 'BIOMETHANE_PLANT' || node.category === 'RESEARCH_HUB';
        const isEte = node.category === 'ETE_SANASA';
        const isInd = node.category === 'INDUSTRIAL_CODIGESTION';

        const nodeColor = isPlant
          ? '#059669'
          : isEte
          ? '#0284c7'
          : isInd
          ? '#d97706'
          : '#0f766e';

        const radius = isPlant ? 0.42 : isEte ? 0.28 : 0.2;

        return (
          <group
            key={node.nodeId}
            position={[nx, ny + 0.18, nz]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectCp2bNode(isSelected ? null : node);
            }}
          >
            {/* Tanque / Biodigestor Cilíndrico 3D */}
            <mesh castShadow>
              <cylinderGeometry args={[radius, radius * 1.15, isPlant ? 0.45 : 0.28, 20]} />
              <meshStandardMaterial
                color={nodeColor}
                emissive={nodeColor}
                emissiveIntensity={isSelected ? 0.8 : 0.35}
                roughness={0.3}
              />
            </mesh>
            {/* Cúpula Gasômetro Esférica */}
            {(isPlant || isEte) && (
              <mesh position={[0, isPlant ? 0.28 : 0.18, 0]}>
                <sphereGeometry args={[radius * 0.85, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
                <meshStandardMaterial color="#34d399" roughness={0.2} metalness={0.3} />
              </mesh>
            )}

            {/* Etiqueta Flutuante Clicável para os Principais Polos CP2B */}
            {(isPlant || isSelected || node.name.includes('Piçarrão') || node.name.includes('Capivari II') || node.name.includes('Anhumas')) && (
              <Html position={[0, isPlant ? 0.85 : 0.58, 0]} center distanceFactor={23}>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCp2bNode(isSelected ? null : node);
                  }}
                  className={`cursor-pointer px-2.5 py-1 rounded-full border text-[10px] font-mono whitespace-nowrap shadow-xl flex items-center gap-1.5 transition-transform ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 border-white font-bold scale-110'
                      : 'bg-slate-950/90 text-emerald-200 border-emerald-400/70 hover:scale-105'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    {node.name.replace(' - Campinas', '')}
                    {node.biomethaneNm3Day > 0 ? ` · ${node.biomethaneNm3Day.toLocaleString('pt-BR')} Nm³/d` : ''}
                  </span>
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* Arcos de Coleta Orgânica (RSU + Poda + Lodo) */}
      {rsuCurves.map((item) => {
        const isFocus = item.sectorId === selectedSectorId || item.sectorId === hoveredSectorId;
        return (
          <Line
            key={`rsu-arc-${item.sectorId}`}
            points={item.points}
            color={isFocus ? '#059669' : '#10b981'}
            lineWidth={isFocus ? 2.6 : 1.2}
            transparent
            opacity={isFocus ? 0.95 : arcOpacity}
          />
        );
      })}

      {/* Arcos de Injeção de Biometano e Retorno de Composto/Digestato */}
      {brtReturnCurves.map((item) => (
        <Line
          key={`brt-arc-${item.id}`}
          points={item.points}
          color={isDaylight ? '#0284c7' : '#38bdf8'}
          lineWidth={1.6}
          transparent
          opacity={0.35 + (biomethaneFleet / 100) * 0.55}
          dashed
          dashScale={6}
          dashSize={0.6}
          dashOffset={0}
        />
      ))}

      <instancedMesh ref={rsuParticlesRef} args={[undefined, undefined, rsuCurves.length * 2]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial color={isDaylight ? '#059669' : '#4ade80'} />
      </instancedMesh>

      <instancedMesh ref={brtParticlesRef} args={[undefined, undefined, brtReturnCurves.length * 3]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color={isDaylight ? '#0284c7' : '#38bdf8'} />
      </instancedMesh>
    </group>
  );
};

// ============================================================================
// ORQUESTRADOR DAS 4 ETAPAS DE CARREGAMENTO DO PROJETO & 3 CAMADAS EXPLODIDAS
// ============================================================================
const ExplodedLayersGroup: React.FC<TwinScene3DProps> = ({
  sectors,
  params,
  selectedSectorId,
  hoveredSectorId,
  selectedCp2bNode,
  onSelectSector,
  onHoverSector,
  onSelectCp2bNode,
}) => {
  const isDaylight = params.visualStyle === 'editorial_daylight';
  const loadStage = params.loadStage ?? 4;
  const layer1Ref = useRef<THREE.Group>(null);
  const layer2Ref = useRef<THREE.Group>(null);
  const currentSpreadRef = useRef(params.zSpread / 100);

  const effectiveSpread = loadStage >= 4 ? params.zSpread : 0;
  const targetSpread = effectiveSpread / 100;
  const layer1TargetY = 0.35 + targetSpread * 4.5;
  const layer2TargetY = 0.75 + targetSpread * 9.2;

  useFrame((_, delta) => {
    currentSpreadRef.current = THREE.MathUtils.lerp(
      currentSpreadRef.current,
      targetSpread,
      Math.min(1, delta * 7)
    );
    const s = currentSpreadRef.current;
    if (layer1Ref.current) {
      layer1Ref.current.position.y = 0.35 + s * 4.5;
    }
    if (layer2Ref.current) {
      layer2Ref.current.position.y = 0.75 + s * 9.2;
    }
  });

  const sectorGeometries = useMemo(() => {
    return sectors.map((s) => {
      const [cx, cz] = projectCoord(s.centroid[0], s.centroid[1]);
      const shape = createPolygonShape(s.polygon, cx, cz);

      const extrudeBase = new THREE.ExtrudeGeometry(shape, {
        depth: 0.08,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.012,
        bevelThickness: 0.012,
      });
      extrudeBase.rotateX(-Math.PI / 2);

      const extrudeSlice = new THREE.ExtrudeGeometry(shape, {
        depth: 0.05,
        bevelEnabled: false,
      });
      extrudeSlice.rotateX(-Math.PI / 2);

      const extrudeUnit = new THREE.ExtrudeGeometry(shape, {
        depth: 1.0,
        bevelEnabled: true,
        bevelSegments: 1,
        bevelSize: 0.01,
        bevelThickness: 0.01,
      });
      extrudeUnit.rotateX(-Math.PI / 2);

      const borderPts: [number, number, number][] = s.polygon.map(([lon, lat]) => {
        const [px, pz] = projectCoord(lon, lat);
        return [px - cx, 0.1, pz - cz];
      });

      return {
        id: s.id,
        cx,
        cz,
        extrudeBase,
        extrudeSlice,
        extrudeUnit,
        borderPts,
      };
    });
  }, [sectors.length]);

  const brtCorridorPoints = useMemo(() => {
    return campinasData.corredor_brt.estacoes.map((st) => {
      const [x, z] = projectCoord(st.lon, st.lat);
      const y = elevToSceneY((st as { elev_m?: number }).elev_m || 650, params.terrainExaggeration) + 0.18;
      return new THREE.Vector3(x, y, z);
    });
  }, [params.terrainExaggeration]);

  const activeId = hoveredSectorId ?? selectedSectorId;
  const activeSector = useMemo(
    () => sectors.find((s) => s.id === activeId) || null,
    [sectors, activeId]
  );

  return (
    <group>
      {/* ETAPA 1: BASEMAP CARTOGRÁFICO DE CAMPINAS + MODELO DIGITAL DE ELEVAÇÃO (22S48_ZN.tif) */}
      <CampinasBasemapAndDem
        terrainExaggeration={params.terrainExaggeration}
        isDaylight={isDaylight}
        showPipelines={loadStage >= 3}
      />

      {/* ETAPA 2: EDIFÍCIOS 3D REAIS DO OPENSTREETMAP (1.850 FOOTPRINTS) + CAMADA HUMANA CENSO 2022 */}
      {loadStage >= 2 && (
        <group>
          <CampinasOsmBuildings3DLayer
            terrainExaggeration={params.terrainExaggeration}
            biomethaneFleet={params.biomethaneFleet}
            greenInfra={params.greenInfra}
            isDaylight={isDaylight}
            onSelectSector={onSelectSector}
          />

          {effectiveSpread > 8 && (
            <Html position={[-14.5, 0.6, -6.8]} distanceFactor={24}>
              <div className="px-3 py-1.5 rounded-lg bg-slate-900/95 border border-fuchsia-500/60 text-xs font-mono text-fuchsia-100 shadow-xl backdrop-blur-md whitespace-nowrap">
                <span className="font-bold text-fuchsia-400">NÍVEL 0 (BASEMAP + DEM 547m–789m)</span> · 1.850 EDIFÍCIOS 3D OSM & CENSO 2022 (QUEM MORA ONDE)
              </div>
            </Html>
          )}

          {sectors.map((s, idx) => {
            const geo = sectorGeometries[idx];
            const elevY = elevToSceneY(s.elevacao_m, params.terrainExaggeration);
            const isSelected = s.id === selectedSectorId;
            const isHovered = s.id === hoveredSectorId;
            const isFocus = isSelected || isHovered;
            const sectorColor = getPeopleLayerColor(s, params.peopleLens, isDaylight);

            return (
              <group key={`l0-${s.cd_setor}`} position={[geo.cx, elevY, geo.cz]}>
                {/* Plinto Vetorial Translúcido do Setor Censitário sobre o Basemap */}
                <mesh
                  geometry={geo.extrudeBase}
                  receiveShadow
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSector(isSelected ? null : s.id);
                  }}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    onHoverSector(s.id);
                  }}
                  onPointerOut={(e) => {
                    e.stopPropagation();
                    if (hoveredSectorId === s.id) onHoverSector(null);
                  }}
                >
                  <meshStandardMaterial
                    color={sectorColor}
                    roughness={0.55}
                    metalness={0.08}
                    transparent
                    opacity={isFocus ? 0.92 : isDaylight ? 0.68 : 0.78}
                    emissive={isFocus ? sectorColor : '#000000'}
                    emissiveIntensity={isFocus ? 0.35 : 0}
                  />
                </mesh>

                <Line
                  points={geo.borderPts}
                  color={isFocus ? '#0f172a' : isDaylight ? '#ffffff' : '#cbd5e1'}
                  lineWidth={isFocus ? 2.8 : 1.1}
                  transparent
                  opacity={isFocus ? 1 : 0.72}
                />

                {/* Edifícios Sintéticos Complementares nos Setores do Corredor */}
                {(s.buildings || []).map((b, bIdx) => {
                  const [bx, bz] = projectCoord(b.lon, b.lat);
                  const lx = bx - geo.cx;
                  const lz = bz - geo.cz;
                  const h = Math.max(0.12, b.pavimentos * 0.082);
                  const w = Math.max(0.11, (b.largura_m / 100) * 1.1);
                  const d = Math.max(0.11, (b.profundidade_m / 100) * 1.1);

                  const isHighlightBuilding = isFocus || bIdx % 6 === 0;
                  const bldgColor = isHighlightBuilding
                    ? sectorColor
                    : isDaylight
                    ? '#f8fafc'
                    : '#cbd5e1';

                  return (
                    <mesh
                      key={`bldg-${s.id}-${bIdx}`}
                      position={[lx, 0.09 + h / 2, lz]}
                      rotation={[0, b.rot_rad, 0]}
                      castShadow
                      receiveShadow
                    >
                      <boxGeometry args={[w, h, d]} />
                      <meshStandardMaterial
                        color={bldgColor}
                        roughness={0.35}
                        metalness={0.1}
                      />
                    </mesh>
                  );
                })}

                {/* Pin Demográfico Censo 2022 */}
                {(s.comunidade_fcu || isFocus || idx % 7 === 0) && (
                  <Html
                    position={[0, 0.55 + (s.pct_verticalizacao > 40 ? 0.5 : 0.15), 0]}
                    center
                    distanceFactor={23}
                  >
                    <div
                      onClick={() => onSelectSector(s.id)}
                      className={`cursor-pointer transition-transform duration-200 ${
                        isFocus ? 'scale-125 z-30' : 'hover:scale-110 opacity-90'
                      }`}
                    >
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full shadow-lg border text-[10px] font-mono font-bold whitespace-nowrap ${
                          s.comunidade_fcu
                            ? 'bg-rose-600 text-white border-white'
                            : isFocus
                            ? 'bg-sky-600 text-white border-white'
                            : 'bg-slate-900/90 text-slate-100 border-slate-400/70'
                        }`}
                      >
                        <span>
                          {s.comunidade_fcu
                            ? '★ FCU'
                            : params.peopleLens === 'renda'
                            ? `R$${(s.renda_media_rs / 1000).toFixed(1)}k`
                            : params.peopleLens === 'chefia_feminina'
                            ? `♀ ${s.pct_chefia_feminina}%`
                            : params.peopleLens === 'raca_cor'
                            ? `PPI ${s.pct_negra_indigena}%`
                            : params.peopleLens === 'verticalizacao'
                            ? `Apt ${s.pct_verticalizacao}%`
                            : `IVSG ${s.sim_vulnerabilidade_ivsg.toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  </Html>
                )}
              </group>
            );
          })}

          {/* Eixo Principal do Corredor BRT Campo Grande */}
          <Line
            points={brtCorridorPoints}
            color={params.biomethaneFleet > 50 ? '#059669' : '#0284c7'}
            lineWidth={5}
            transparent
            opacity={0.95}
          />
        </group>
      )}

      {/* ETAPA 3: REDE COMPLETA CP2B (ETEs SANASA + INDÚSTRIAS + USINAS BIOMETANO + JARDINS DE CHUVA) */}
      {loadStage >= 3 && (
        <group ref={layer1Ref} position={[0, layer1TargetY, 0]}>
          {effectiveSpread > 8 && (
            <Html position={[-14.5, 0.4, -6.8]} distanceFactor={24}>
              <div className="px-3 py-1.5 rounded-lg bg-slate-900/95 border border-emerald-500/60 text-xs font-mono text-emerald-100 shadow-xl backdrop-blur-md whitespace-nowrap">
                <span className="font-bold text-emerald-400">NÍVEL 1 (REDE CP2B · 526 GWh/ano)</span> · 30 ETEs SANASA, 40 INDÚSTRIAS, DELTA A, ONEBIO & JARDINS DE CHUVA
              </div>
            </Html>
          )}

          {sectors.map((s, idx) => {
            const geo = sectorGeometries[idx];
            const elevY = elevToSceneY(s.elevacao_m, params.terrainExaggeration);
            const isFocus = s.id === selectedSectorId || s.id === hoveredSectorId;
            const greenScaleY = Math.max(0.08, (s.sim_cobertura_arborea_pct / 45) * 0.65);

            return (
              <group key={`l1-${s.cd_setor}`} position={[geo.cx, elevY, geo.cz]}>
                <mesh
                  geometry={geo.extrudeSlice}
                  scale={[0.94, 1, 0.94]}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSector(s.id === selectedSectorId ? null : s.id);
                  }}
                >
                  <meshStandardMaterial
                    color={isFocus ? '#10b981' : '#34d399'}
                    transparent
                    opacity={isFocus ? 0.88 : effectiveSpread > 5 ? 0.62 : 0.35}
                    roughness={0.4}
                  />
                </mesh>
                {effectiveSpread > 5 && (
                  <mesh
                    geometry={geo.extrudeUnit}
                    position={[0, 0.06, 0]}
                    scale={[0.82, greenScaleY, 0.82]}
                  >
                    <meshStandardMaterial
                      color={isFocus ? '#059669' : '#10b981'}
                      transparent
                      opacity={isFocus ? 0.85 : 0.48}
                      roughness={0.35}
                    />
                  </mesh>
                )}
              </group>
            );
          })}

          <Cp2bCompleteNetworkLayer
            sectors={sectors}
            layer1Y={0}
            terrainExaggeration={params.terrainExaggeration}
            biomethaneFleet={params.biomethaneFleet}
            greenInfra={params.greenInfra}
            selectedSectorId={selectedSectorId}
            hoveredSectorId={hoveredSectorId}
            selectedCp2bNode={selectedCp2bNode}
            onSelectCp2bNode={onSelectCp2bNode}
            isDaylight={isDaylight}
          />
        </group>
      )}

      {/* ETAPA 4: CAMADA TERMO-ENERGÉTICA (V1) E VISÃO EXPLODIDA V1 <-> V2 <-> V3 */}
      {loadStage >= 4 && (
        <group ref={layer2Ref} position={[0, layer2TargetY, 0]}>
          {effectiveSpread > 8 && (
            <Html position={[-14.5, 0.5, -6.8]} distanceFactor={24}>
              <div className="px-3 py-1.5 rounded-lg bg-slate-900/95 border border-amber-500/60 text-xs font-mono text-amber-100 shadow-xl backdrop-blur-md whitespace-nowrap">
                <span className="font-bold text-amber-400">NÍVEL 2 (CAMADA TERMO-ENERGÉTICA V1)</span> · DEMANDA INDUZIDA (MJ TRANSPORTE + UHI) & PLUMA MP2.5
              </div>
            </Html>
          )}

          {effectiveSpread > 4 &&
            sectors.map((s, idx) => {
              const geo = sectorGeometries[idx];
              const elevY = elevToSceneY(s.elevacao_m, params.terrainExaggeration);
              const isFocus = s.id === selectedSectorId || s.id === hoveredSectorId;
              const barHeight = Math.max(0.16, (s.sim_mj_total_dia / 16000) * 2.1);
              const barColor = getEmissionsColor(s.sim_mp25_ugm3);

              return (
                <group key={`l2-${s.cd_setor}`} position={[geo.cx, elevY, geo.cz]}>
                  <mesh geometry={geo.extrudeSlice} scale={[0.88, 1, 0.88]}>
                    <meshStandardMaterial color={barColor} transparent opacity={0.45} />
                  </mesh>
                  <mesh
                    geometry={geo.extrudeUnit}
                    position={[0, 0.06, 0]}
                    scale={[0.72, barHeight, 0.72]}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSector(s.id === selectedSectorId ? null : s.id);
                    }}
                    onPointerOver={(e) => {
                      e.stopPropagation();
                      onHoverSector(s.id);
                    }}
                    onPointerOut={(e) => {
                      e.stopPropagation();
                      if (hoveredSectorId === s.id) onHoverSector(null);
                    }}
                  >
                    <meshStandardMaterial
                      color={barColor}
                      emissive={isFocus ? barColor : '#000000'}
                      emissiveIntensity={isFocus ? 0.45 : 0.1}
                      transparent
                      opacity={isFocus ? 0.96 : 0.82}
                      roughness={0.28}
                      metalness={0.2}
                    />
                  </mesh>
                </group>
              );
            })}
        </group>
      )}

      {/* Guias Verticais de Acoplamento Causal V1 <-> V2 <-> V3 */}
      {effectiveSpread > 4 &&
        sectors.map((s, idx) => {
          const geo = sectorGeometries[idx];
          const elevY = elevToSceneY(s.elevacao_m, params.terrainExaggeration);
          const isFocus = s.id === selectedSectorId || s.id === hoveredSectorId;
          if (!isFocus && idx % 3 !== 0) return null;

          return (
            <Line
              key={`guide-${s.cd_setor}`}
              points={[
                new THREE.Vector3(geo.cx, elevY, geo.cz),
                new THREE.Vector3(geo.cx, elevY + layer2TargetY + 1.2, geo.cz),
              ]}
              color={isFocus ? '#0284c7' : isDaylight ? '#64748b' : '#475569'}
              lineWidth={isFocus ? 2.6 : 0.85}
              dashed={!isFocus}
              dashScale={4}
              dashSize={0.3}
              transparent
              opacity={isFocus ? 0.95 : 0.4}
            />
          );
        })}

      {activeSector && (() => {
        const [ax, az] = projectCoord(activeSector.centroid[0], activeSector.centroid[1]);
        const elevY = elevToSceneY(activeSector.elevacao_m, params.terrainExaggeration);
        const totalH = layer2TargetY + 2.2;
        return (
          <group position={[ax, elevY, az]}>
            <mesh position={[0, totalH / 2, 0]}>
              <cylinderGeometry args={[0.14, 0.14, totalH, 20]} />
              <meshBasicMaterial color="#0284c7" transparent opacity={0.28} />
            </mesh>
          </group>
        );
      })()}
    </group>
  );
};

export const TwinScene3D: React.FC<TwinScene3DProps> = (props) => {
  const [useBlenderGlb, setUseBlenderGlb] = useState(false);
  const isDaylight = props.params.visualStyle === 'editorial_daylight';
  const bgColor = isDaylight ? '#dbe4ee' : '#020617';

  return (
    <div className="w-full h-full relative">
      {/* Botão de Alternância: Motor Procedural WebGL vs. Malha .GLB Exportada do Blender 5.2 via MCP */}
      <div className="absolute bottom-14 left-5 z-20 pointer-events-auto">
        <button
          onClick={() => setUseBlenderGlb((v) => !v)}
          className={`px-3.5 py-2 rounded-xl border text-xs font-mono font-bold shadow-xl transition flex items-center gap-2 ${
            useBlenderGlb
              ? 'bg-amber-500 text-slate-950 border-white'
              : 'bg-slate-950/90 hover:bg-slate-900 text-amber-300 border-amber-500/50'
          }`}
        >
          <span>{useBlenderGlb ? '🟠 Exibindo Malha .GLB do Blender 5.2 (MCP)' : '🎨 Carregar Malha .GLB Nativa do Blender 5.2'}</span>
        </button>
      </div>

      <Canvas
        shadows
        camera={{ position: [2.5, 11.5, 17.5], fov: 38, near: 0.1, far: 240 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onPointerMissed={() => {
          props.onSelectSector(null);
          props.onSelectCp2bNode(null);
        }}
      >
        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[bgColor, 32, 78]} />

        <ambientLight intensity={isDaylight ? 0.92 : 0.65} />
        <hemisphereLight
          args={[isDaylight ? '#ffffff' : '#38bdf8', isDaylight ? '#cbd5e1' : '#0f172a', isDaylight ? 0.72 : 0.35]}
        />
        <directionalLight
          position={[18, 34, 22]}
          intensity={isDaylight ? 1.65 : 1.25}
          color={isDaylight ? '#fffef5' : '#f8fafc'}
          castShadow
        />
        <directionalLight
          position={[-16, 20, -14]}
          intensity={isDaylight ? 0.55 : 0.65}
          color="#38bdf8"
        />

        {useBlenderGlb ? (
          <BlenderGlbBridge
            visible={useBlenderGlb}
            sectors={props.sectors}
            params={props.params}
            onSelectSector={props.onSelectSector}
            onSelectCp2bNode={props.onSelectCp2bNode}
          />
        ) : (
          <ExplodedLayersGroup {...props} />
        )}

        <OrbitControls
          enableDamping
          dampingFactor={0.06}
          maxPolarAngle={Math.PI / 2 - 0.03}
          minDistance={3.5}
          maxDistance={48}
          target={[0, ((props.params.loadStage ?? 4) >= 4 ? (props.params.zSpread / 100) * 3.0 : 0) + 0.4, 0]}
        />
      </Canvas>
    </div>
  );
};
