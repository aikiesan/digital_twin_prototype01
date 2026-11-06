import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { SectorSimulated, SimulationParams } from '../types';
import {
  projectCoord,
  elevToSceneY,
  getPeopleLayerColor,
  getEmissionsColor,
} from '../simulationEngine';
import campinasData from '../data/campinasRealData.json';

interface TwinScene3DProps {
  sectors: SectorSimulated[];
  params: SimulationParams;
  selectedSectorId: number | null;
  hoveredSectorId: number | null;
  onSelectSector: (id: number | null) => void;
  onHoverSector: (id: number | null) => void;
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

// Subcomponente: Terreno Topográfico 3D Real de Campinas (INPE TOPODATA / SRTM 30m Folha 22S48_ZN) + Hidrografia FBDS
const CampinasTopographicRelief: React.FC<{
  terrainExaggeration: number;
  isDaylight: boolean;
}> = ({ terrainExaggeration, isDaylight }) => {
  const relevo = campinasData.relevo_3d;

  const { terrainGeo, contourLines, riverLines } = useMemo(() => {
    const cols = relevo.cols;
    const rows = relevo.rows;
    const [xMin, zMax] = projectCoord(relevo.lon_min, relevo.lat_min);
    const [xMax, zMin] = projectCoord(relevo.lon_max, relevo.lat_max);
    const width = xMax - xMin;
    const depth = zMax - zMin;

    const geo = new THREE.PlaneGeometry(width, depth, cols - 1, rows - 1);
    geo.rotateX(-Math.PI / 2);

    const posAttr = geo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    const cLow = new THREE.Color(isDaylight ? '#d6e3d0' : '#091526');
    const cMid = new THREE.Color(isDaylight ? '#e9e5d5' : '#0f1f36');
    const cHigh = new THREE.Color(isDaylight ? '#dcd3c0' : '#182b47');

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const elevM = relevo.heights_m[r][c];
        const y = elevToSceneY(elevM, terrainExaggeration) - 0.08;
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

    // Linhas de perfil topográfico (Stacked SVG Contour Strips) para estética maquete arquitetônica
    const contours: THREE.Vector3[][] = [];
    for (let r = 2; r < rows - 2; r += 3) {
      const linePts: THREE.Vector3[] = [];
      const lat = relevo.lat_max - (r / (rows - 1)) * (relevo.lat_max - relevo.lat_min);
      for (let c = 0; c < cols; c++) {
        const lon = relevo.lon_min + (c / (cols - 1)) * (relevo.lon_max - relevo.lon_min);
        const [px, pz] = projectCoord(lon, lat);
        const y = elevToSceneY(relevo.heights_m[r][c], terrainExaggeration) - 0.06;
        linePts.push(new THREE.Vector3(px, y, pz));
      }
      contours.push(linePts);
    }

    // Rios principais (Rio Capivari e Córrego Piçarrão) acompanhando o fundo de vale topográfico
    const rivers = (relevo.rios_principais || []).map((riverCoords: number[][]) => {
      return riverCoords.map(([lon, lat]) => {
        const [rx, rz] = projectCoord(lon, lat);
        // Estima a cota no fundo do vale
        const cIdx = Math.max(0, Math.min(cols - 1, Math.round(((lon - relevo.lon_min) / (relevo.lon_max - relevo.lon_min)) * (cols - 1))));
        const rIdx = Math.max(0, Math.min(rows - 1, Math.round(((relevo.lat_max - lat) / (relevo.lat_max - relevo.lat_min)) * (rows - 1))));
        const elev = relevo.heights_m[rIdx]?.[cIdx] ?? 595;
        return new THREE.Vector3(rx, elevToSceneY(elev, terrainExaggeration) - 0.03, rz);
      });
    });

    return {
      terrainGeo: geo,
      centerX: (xMin + xMax) / 2,
      centerZ: (zMin + zMax) / 2,
      contourLines: contours,
      riverLines: rivers,
    };
  }, [relevo, terrainExaggeration, isDaylight]);

  const [cx, cz] = useMemo(() => {
    const [xMin, zMax] = projectCoord(relevo.lon_min, relevo.lat_min);
    const [xMax, zMin] = projectCoord(relevo.lon_max, relevo.lat_max);
    return [(xMin + xMax) / 2, (zMin + zMax) / 2];
  }, [relevo]);

  return (
    <group>
      {/* Malha de Elevação 3D Real (INPE TOPODATA 30m) */}
      <mesh geometry={terrainGeo} position={[cx, 0, cz]} receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.88}
          metalness={0.05}
          transparent
          opacity={isDaylight ? 0.96 : 0.85}
        />
      </mesh>

      {/* Fitas Topográficas Vetoriais (Stacked SVG Contours) */}
      {contourLines.map((pts, i) => (
        <Line
          key={`topo-contour-${i}`}
          points={pts}
          color={isDaylight ? '#94a3b8' : '#1e3a5f'}
          lineWidth={0.9}
          transparent
          opacity={isDaylight ? 0.45 : 0.38}
        />
      ))}

      {/* Hidrografia Principal de Campinas (Rio Capivari e Córrego Piçarrão) */}
      {riverLines.map((pts, i) => (
        <Line
          key={`river-${i}`}
          points={pts}
          color={isDaylight ? '#0284c7' : '#38bdf8'}
          lineWidth={3.2}
          transparent
          opacity={0.78}
        />
      ))}
    </group>
  );
};

// Subcomponente: Fluxo Circular de Biogás/Biometano CP2B
const BiogasEcosystemFlow: React.FC<{
  sectors: SectorSimulated[];
  layer1Y: number;
  terrainExaggeration: number;
  biomethaneFleet: number;
  greenInfra: number;
  selectedSectorId: number | null;
  hoveredSectorId: number | null;
  isDaylight: boolean;
}> = ({
  sectors,
  layer1Y,
  terrainExaggeration,
  biomethaneFleet,
  greenInfra,
  selectedSectorId,
  hoveredSectorId,
  isDaylight,
}) => {
  const hub = campinasData.corredor_brt.hubs_biometano[0];
  const [hubX, hubZ] = useMemo(() => projectCoord(hub.lon, hub.lat), [hub.lon, hub.lat]);
  const hubTerrainY = elevToSceneY(hub.elev_m || 610, terrainExaggeration);

  const stationsCoords = useMemo(() => {
    return campinasData.corredor_brt.estacoes.map((s) => ({
      ...s,
      pos: projectCoord(s.lon, s.lat),
      elevY: elevToSceneY((s as { elev_m?: number }).elev_m || 650, terrainExaggeration),
    }));
  }, [terrainExaggeration]);

  const { rsuCurves, brtReturnCurves } = useMemo(() => {
    const rsu = sectors
      .filter((_, idx) => idx % 2 === 0 || sectors[idx].id === selectedSectorId || sectors[idx].id === hoveredSectorId)
      .map((s) => {
        const [sx, sz] = projectCoord(s.centroid[0], s.centroid[1]);
        const sy = elevToSceneY(s.elevacao_m, terrainExaggeration);
        const start = new THREE.Vector3(sx, layer1Y + sy + 0.25, sz);
        const end = new THREE.Vector3(hubX, layer1Y + hubTerrainY + 0.4, hubZ);
        const midX = (sx + hubX) / 2;
        const midZ = (sz + hubZ) / 2;
        const dist = Math.hypot(sx - hubX, sz - hubZ);
        const ctrl1 = new THREE.Vector3(
          sx + (midX - sx) * 0.5,
          layer1Y + sy + 0.8 + dist * 0.13,
          sz + (midZ - sz) * 0.5
        );
        const ctrl2 = new THREE.Vector3(
          hubX + (midX - hubX) * 0.5,
          layer1Y + hubTerrainY + 1.0 + dist * 0.13,
          hubZ + (midZ - hubZ) * 0.5
        );
        const curve = new THREE.CubicBezierCurve3(start, ctrl1, ctrl2, end);
        return {
          sectorId: s.id,
          curve,
          points: curve.getPoints(26),
        };
      });

    const brt = stationsCoords.map((st, idx) => {
      const [tx, tz] = st.pos;
      const start = new THREE.Vector3(hubX, layer1Y + hubTerrainY + 0.45, hubZ);
      const end = new THREE.Vector3(tx, st.elevY + 0.22, tz);
      const dist = Math.hypot(tx - hubX, tz - hubZ);
      const ctrl1 = new THREE.Vector3(
        hubX + (tx - hubX) * 0.35,
        layer1Y + hubTerrainY + 1.1 + dist * 0.11,
        hubZ + (tz - hubZ) * 0.35
      );
      const ctrl2 = new THREE.Vector3(
        hubX + (tx - hubX) * 0.75,
        layer1Y * 0.5 + st.elevY + 1.1,
        hubZ + (tz - hubZ) * 0.75
      );
      const curve = new THREE.CubicBezierCurve3(start, ctrl1, ctrl2, end);
      return {
        id: st.id,
        idx,
        curve,
        points: curve.getPoints(28),
      };
    });

    return { rsuCurves: rsu, brtReturnCurves: brt };
  }, [sectors, layer1Y, hubX, hubZ, hubTerrainY, stationsCoords, selectedSectorId, hoveredSectorId, terrainExaggeration]);

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

  const arcOpacity = 0.25 + (biomethaneFleet / 100) * 0.45;

  return (
    <group>
      {/* Ecopolo Biometano CP2B */}
      <group position={[hubX, layer1Y + hubTerrainY + 0.25, hubZ]}>
        <mesh>
          <cylinderGeometry args={[0.45, 0.55, 0.5, 24]} />
          <meshStandardMaterial
            color="#059669"
            emissive="#10b981"
            emissiveIntensity={isDaylight ? 0.4 : 0.9}
          />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <sphereGeometry args={[0.36, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          <meshStandardMaterial color="#34d399" roughness={0.2} metalness={0.3} />
        </mesh>
        <Html position={[0, 0.95, 0]} center distanceFactor={22}>
          <div className="px-2.5 py-1 rounded-full bg-emerald-950/95 border border-emerald-400/70 text-[10px] font-mono text-emerald-100 whitespace-nowrap shadow-xl flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ECOPOLO CP2B (Delta A + Capivari II · 28.064 Nm³/d)
          </div>
        </Html>
      </group>

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

      {brtReturnCurves.map((item) => (
        <Line
          key={`brt-arc-${item.id}`}
          points={item.points}
          color={isDaylight ? '#0284c7' : '#38bdf8'}
          lineWidth={1.6}
          transparent
          opacity={0.3 + (biomethaneFleet / 100) * 0.55}
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

// Componente Principal das 3 Camadas com Edifícios 3D Humanizados, SVG Badges e Relevo Real
const ExplodedLayersGroup: React.FC<TwinScene3DProps> = ({
  sectors,
  params,
  selectedSectorId,
  hoveredSectorId,
  onSelectSector,
  onHoverSector,
}) => {
  const isDaylight = params.visualStyle === 'editorial_daylight';
  const layer1Ref = useRef<THREE.Group>(null);
  const layer2Ref = useRef<THREE.Group>(null);
  const currentSpreadRef = useRef(params.zSpread / 100);

  const targetSpread = params.zSpread / 100;
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

  // Geometrias dos Setores Censitários (em camadas empilhadas tipo Stacked SVG / Maquete Arquitetônica)
  const sectorGeometries = useMemo(() => {
    return sectors.map((s) => {
      const [cx, cz] = projectCoord(s.centroid[0], s.centroid[1]);
      const shape = createPolygonShape(s.polygon, cx, cz);

      // Plinto base do setor censitário (Stacked SVG Slice 1)
      const extrudeBase = new THREE.ExtrudeGeometry(shape, {
        depth: 0.11,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.015,
        bevelThickness: 0.015,
      });
      extrudeBase.rotateX(-Math.PI / 2);

      // Fatia vetorial fina para as camadas flutuantes
      const extrudeSlice = new THREE.ExtrudeGeometry(shape, {
        depth: 0.06,
        bevelEnabled: false,
      });
      extrudeSlice.rotateX(-Math.PI / 2);

      // Volume unitário para extrusão dinâmica
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
        return [px - cx, 0.13, pz - cz];
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
      {/* TERRENO 3D REAL DE CAMPINAS (SRTM 30m + Rios FBDS + Contornos SVG) */}
      <CampinasTopographicRelief
        terrainExaggeration={params.terrainExaggeration}
        isDaylight={isDaylight}
      />

      {/* =====================================================================
          CAMADA 0 (SOLO TOPOGRÁFICO): CAMADA HUMANA & TECIDO URBANO 3D
          ("Quem mora onde em Campinas": Edifícios 3D + Lentes Demográficas Censo 2022)
         ===================================================================== */}
      <group>
        {params.zSpread > 8 && (
          <Html position={[-14.5, 0.6, -6.8]} distanceFactor={24}>
            <div className="px-3 py-1.5 rounded-lg bg-slate-900/95 border border-fuchsia-500/60 text-xs font-mono text-fuchsia-100 shadow-xl backdrop-blur-md whitespace-nowrap">
              <span className="font-bold text-fuchsia-400">NÍVEL 0 (RELEVO REAL 552m–771m)</span> · QUEM MORA ONDE EM CAMPINAS (TECIDO URBANO 3D & CENSO 2022)
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
              {/* Plinto Empilhado SVG do Setor Censitário */}
              <mesh
                geometry={geo.extrudeBase}
                receiveShadow
                castShadow
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
                  metalness={0.1}
                  emissive={isFocus ? sectorColor : '#000000'}
                  emissiveIntensity={isFocus ? 0.35 : 0}
                />
              </mesh>

              {/* Contorno Vetorial Nítido do Setor */}
              <Line
                points={geo.borderPts}
                color={isFocus ? '#0f172a' : isDaylight ? '#ffffff' : '#cbd5e1'}
                lineWidth={isFocus ? 2.8 : 1.2}
                transparent
                opacity={isFocus ? 1 : 0.75}
              />

              {/* EDIFÍCIOS 3D HUMANIZADOS (Estilo Maquete Urbana das imagens de referência) */}
              {(s.buildings || []).map((b, bIdx) => {
                const [bx, bz] = projectCoord(b.lon, b.lat);
                const lx = bx - geo.cx;
                const lz = bz - geo.cz;
                const h = Math.max(0.12, b.pavimentos * 0.085);
                const w = Math.max(0.11, (b.largura_m / 100) * 1.15);
                const d = Math.max(0.11, (b.profundidade_m / 100) * 1.15);

                // Destaca em cor semântica os edifícios mais emblemáticos ou do setor selecionado (como na imagem 2 de referência)
                const isHighlightBuilding = isFocus || bIdx % 5 === 0;
                const bldgColor = isHighlightBuilding
                  ? sectorColor
                  : isDaylight
                  ? '#f8fafc'
                  : '#cbd5e1';

                return (
                  <mesh
                    key={`bldg-${s.id}-${bIdx}`}
                    position={[lx, 0.12 + h / 2, lz]}
                    rotation={[0, b.rot_rad, 0]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[w, h, d]} />
                    <meshStandardMaterial
                      color={bldgColor}
                      roughness={0.35}
                      metalness={0.12}
                    />
                  </mesh>
                );
              })}

              {/* Árvores 3D Estilizadas na Camada Base (crescem com o slider de Infraestrutura Verde) */}
              {s.sim_cobertura_arborea_pct > 14 && (
                <group position={[0.12, 0.15, -0.08]}>
                  <mesh position={[0, 0.14, 0]}>
                    <sphereGeometry args={[0.09 + (params.greenInfra / 100) * 0.06, 10, 10]} />
                    <meshStandardMaterial color="#16a34a" roughness={0.6} />
                  </mesh>
                  <mesh position={[-0.22, 0.12, 0.18]}>
                    <sphereGeometry args={[0.07 + (params.greenInfra / 100) * 0.05, 10, 10]} />
                    <meshStandardMaterial color="#22c55e" roughness={0.6} />
                  </mesh>
                </group>
              )}

              {/* PINS VETORIAIS SVG (Estilo imagem 2 de referência) para Comunidades Urbanas (FCU), Polos ou Setor Selecionado */}
              {(s.comunidade_fcu || isFocus || idx % 6 === 0) && (
                <Html
                  position={[0, 0.55 + (s.pct_verticalizacao > 40 ? 0.55 : 0.15), 0]}
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

        {/* Eixo Viário do Corredor BRT Campo Grande sobre o Relevo 3D */}
        <Line
          points={brtCorridorPoints}
          color={params.biomethaneFleet > 50 ? '#059669' : '#0284c7'}
          lineWidth={5}
          transparent
          opacity={0.95}
        />

        {/* Estações e Terminais do BRT Campo Grande */}
        {campinasData.corredor_brt.estacoes.map((st) => {
          const [sx, sz] = projectCoord(st.lon, st.lat);
          const sy = elevToSceneY((st as { elev_m?: number }).elev_m || 650, params.terrainExaggeration);
          const isTerminal = st.tipo === 'terminal';
          return (
            <group key={st.id} position={[sx, sy + 0.2, sz]}>
              <mesh>
                <cylinderGeometry
                  args={[isTerminal ? 0.24 : 0.14, isTerminal ? 0.24 : 0.14, isTerminal ? 0.28 : 0.18, 20]}
                />
                <meshStandardMaterial
                  color={isTerminal ? '#0284c7' : '#f8fafc'}
                  emissive={isTerminal ? '#0369a1' : '#38bdf8'}
                  emissiveIntensity={0.5}
                />
              </mesh>
              {isTerminal && (
                <Html position={[0, 0.45, 0]} center distanceFactor={25}>
                  <div className="px-2 py-0.5 rounded-md bg-slate-900/95 border border-sky-400 text-[9px] font-mono font-semibold text-sky-200 whitespace-nowrap shadow-md">
                    🚌 {st.nome} ({(st as { elev_m?: number }).elev_m}m)
                  </div>
                </Html>
              )}
            </group>
          );
        })}
      </group>

      {/* =====================================================================
          CAMADA 1 (INTERMEDIÁRIA): MITIGAÇÃO VERDE (APPs/JARDINS DE CHUVA) & BIOMETANO CP2B
         ===================================================================== */}
      <group ref={layer1Ref} position={[0, layer1TargetY, 0]}>
        {params.zSpread > 8 && (
          <Html position={[-14.5, 0.4, -6.8]} distanceFactor={24}>
            <div className="px-3 py-1.5 rounded-lg bg-slate-900/95 border border-emerald-500/60 text-xs font-mono text-emerald-100 shadow-xl backdrop-blur-md whitespace-nowrap">
              <span className="font-bold text-emerald-400">NÍVEL 1 (CAMADA ECOLÓGICA & CIRCULAR)</span> · INFRAESTRUTURA VERDE, JARDINS DE CHUVA & BIOMETANO CP2B
            </div>
          </Html>
        )}

        {/* Fatias Empilhadas Verdes (Stacked SVG Pads + Copas Arbóreas 3D) */}
        {sectors.map((s, idx) => {
          const geo = sectorGeometries[idx];
          const elevY = elevToSceneY(s.elevacao_m, params.terrainExaggeration);
          const isFocus = s.id === selectedSectorId || s.id === hoveredSectorId;
          const greenScaleY = Math.max(0.08, (s.sim_cobertura_arborea_pct / 45) * 0.65);

          return (
            <group key={`l1-${s.cd_setor}`} position={[geo.cx, elevY, geo.cz]}>
              {/* Base SVG Slice 1 */}
              <mesh
                geometry={geo.extrudeSlice}
                scale={[0.94, 1, 0.94]}
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
                  color={isFocus ? '#10b981' : '#34d399'}
                  transparent
                  opacity={isFocus ? 0.9 : 0.65}
                  roughness={0.4}
                />
              </mesh>
              {/* Segunda Fatia Empilhada (Volume de Biomassa / Jardins de Chuva) */}
              <mesh
                geometry={geo.extrudeUnit}
                position={[0, 0.06, 0]}
                scale={[0.82, greenScaleY, 0.82]}
              >
                <meshStandardMaterial
                  color={isFocus ? '#059669' : '#10b981'}
                  transparent
                  opacity={isFocus ? 0.85 : 0.52}
                  roughness={0.35}
                />
              </mesh>
            </group>
          );
        })}

        <BiogasEcosystemFlow
          sectors={sectors}
          layer1Y={0}
          terrainExaggeration={params.terrainExaggeration}
          biomethaneFleet={params.biomethaneFleet}
          greenInfra={params.greenInfra}
          selectedSectorId={selectedSectorId}
          hoveredSectorId={hoveredSectorId}
          isDaylight={isDaylight}
        />
      </group>

      {/* =====================================================================
          CAMADA 2 (TOPO): DEMANDA ENERGÉTICA INDUZIDA (MJ/DIA), ILHA DE CALOR & MP2.5
         ===================================================================== */}
      <group ref={layer2Ref} position={[0, layer2TargetY, 0]}>
        {params.zSpread > 8 && (
          <Html position={[-14.5, 0.5, -6.8]} distanceFactor={24}>
            <div className="px-3 py-1.5 rounded-lg bg-slate-900/95 border border-amber-500/60 text-xs font-mono text-amber-100 shadow-xl backdrop-blur-md whitespace-nowrap">
              <span className="font-bold text-amber-400">NÍVEL 2 (CAMADA TERMO-ENERGÉTICA)</span> · DEMANDA INDUZIDA (MJ TRANSPORTE + UHI) & PLUMA MP2.5
            </div>
          </Html>
        )}

        {sectors.map((s, idx) => {
          const geo = sectorGeometries[idx];
          const elevY = elevToSceneY(s.elevacao_m, params.terrainExaggeration);
          const isFocus = s.id === selectedSectorId || s.id === hoveredSectorId;
          const barHeight = Math.max(0.16, (s.sim_mj_total_dia / 16000) * 2.1);
          const barColor = getEmissionsColor(s.sim_mp25_ugm3);

          return (
            <group key={`l2-${s.cd_setor}`} position={[geo.cx, elevY, geo.cz]}>
              {/* Base SVG Slice da Camada 2 */}
              <mesh geometry={geo.extrudeSlice} scale={[0.88, 1, 0.88]}>
                <meshStandardMaterial color={barColor} transparent opacity={0.45} />
              </mesh>

              {/* Torre Chanfrada de Demanda Energética & Poluição */}
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
                  opacity={isFocus ? 0.96 : 0.85}
                  roughness={0.28}
                  metalness={0.2}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* =====================================================================
          GUIAS VERTICAIS E CILINDRO DE CONEXÃO INTER-CAMADAS
         ===================================================================== */}
      {params.zSpread > 2 &&
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
            {[0.16, layer1TargetY + 0.15, layer2TargetY + 0.15].map((ry, i) => (
              <mesh key={`ring-${i}`} position={[0, ry, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.38, 0.5, 28]} />
                <meshBasicMaterial color="#0284c7" side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        );
      })()}
    </group>
  );
};

export const TwinScene3D: React.FC<TwinScene3DProps> = (props) => {
  const isDaylight = props.params.visualStyle === 'editorial_daylight';
  const bgColor = isDaylight ? '#e2e8f0' : '#020617';

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        camera={{ position: [3, 13, 19], fov: 40, near: 0.1, far: 220 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onPointerMissed={() => props.onSelectSector(null)}
      >
        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[bgColor, 30, 72]} />

        <ambientLight intensity={isDaylight ? 0.85 : 0.65} />
        <hemisphereLight
          args={[isDaylight ? '#ffffff' : '#38bdf8', isDaylight ? '#cbd5e1' : '#0f172a', isDaylight ? 0.65 : 0.35]}
        />
        <directionalLight
          position={[18, 32, 20]}
          intensity={isDaylight ? 1.55 : 1.25}
          color={isDaylight ? '#fffbeb' : '#f8fafc'}
          castShadow
        />
        <directionalLight
          position={[-16, 20, -14]}
          intensity={isDaylight ? 0.5 : 0.65}
          color="#38bdf8"
        />

        <ExplodedLayersGroup {...props} />

        <OrbitControls
          enableDamping
          dampingFactor={0.06}
          maxPolarAngle={Math.PI / 2 - 0.03}
          minDistance={5}
          maxDistance={46}
          target={[0, (props.params.zSpread / 100) * 3.5 + 0.5, 0]}
        />
      </Canvas>
    </div>
  );
};
