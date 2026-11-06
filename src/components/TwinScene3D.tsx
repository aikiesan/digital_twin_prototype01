import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { SectorSimulated, SimulationParams } from '../types';
import { projectCoord, getVulnerabilityColor, getEmissionsColor } from '../simulationEngine';
import campinasData from '../data/campinasRealData.json';

interface TwinScene3DProps {
  sectors: SectorSimulated[];
  params: SimulationParams;
  selectedSectorId: number | null;
  hoveredSectorId: number | null;
  onSelectSector: (id: number | null) => void;
  onHoverSector: (id: number | null) => void;
}

// Cria um THREE.Shape a partir do polígono real do setor censitário (IBGE Censo 2022)
function createPolygonShape(polygon: [number, number][], cx: number, cz: number): THREE.Shape {
  const shape = new THREE.Shape();
  polygon.forEach(([lon, lat], idx) => {
    const [px, pz] = projectCoord(lon, lat);
    // No ExtrudeGeometry (plano XY antes de rotacionar -90° em X): X = px - cx, Y = -(pz - cz)
    const lx = px - cx;
    const ly = -(pz - cz);
    if (idx === 0) shape.moveTo(lx, ly);
    else shape.lineTo(lx, ly);
  });
  shape.closePath();
  return shape;
}

// Subcomponente para o Sistema de Partículas e Arcos Animados de Biogás/Biometano (CP2B)
const BiogasEcosystemFlow: React.FC<{
  sectors: SectorSimulated[];
  layer1Y: number;
  layer0Y: number;
  biomethaneFleet: number;
  greenInfra: number;
  selectedSectorId: number | null;
  hoveredSectorId: number | null;
}> = ({ sectors, layer1Y, layer0Y, biomethaneFleet, greenInfra, selectedSectorId, hoveredSectorId }) => {
  const hub = campinasData.corredor_brt.hubs_biometano[0];
  const [hubX, hubZ] = useMemo(() => projectCoord(hub.lon, hub.lat), [hub.lon, hub.lat]);

  const stationsCoords = useMemo(() => {
    return campinasData.corredor_brt.estacoes.map((s) => ({
      ...s,
      pos: projectCoord(s.lon, s.lat),
    }));
  }, []);

  // Construir curvas Bezier 3D:
  // 1) Coleta de RSU Orgânico + Poda Urbana dos Setores -> Ecopolo Biometano CP2B (Delta A / Capivari II)
  // 2) Retorno de Biometano Purificado (GNR) do Ecopolo -> Terminais e Estações do Corredor BRT Campo Grande
  const { rsuCurves, brtReturnCurves } = useMemo(() => {
    // Seleciona setores geradores distribuídos para arcos limpos e legíveis
    const rsu = sectors
      .filter((_, idx) => idx % 2 === 0 || sectors[idx].id === selectedSectorId || sectors[idx].id === hoveredSectorId)
      .map((s) => {
        const [sx, sz] = projectCoord(s.centroid[0], s.centroid[1]);
        const start = new THREE.Vector3(sx, layer1Y + 0.25, sz);
        const end = new THREE.Vector3(hubX, layer1Y + 0.4, hubZ);
        const midX = (sx + hubX) / 2;
        const midZ = (sz + hubZ) / 2;
        const dist = Math.hypot(sx - hubX, sz - hubZ);
        const ctrl1 = new THREE.Vector3(
          sx + (midX - sx) * 0.5,
          layer1Y + 0.8 + dist * 0.14,
          sz + (midZ - sz) * 0.5
        );
        const ctrl2 = new THREE.Vector3(
          hubX + (midX - hubX) * 0.5,
          layer1Y + 1.0 + dist * 0.14,
          hubZ + (midZ - hubZ) * 0.5
        );
        const curve = new THREE.CubicBezierCurve3(start, ctrl1, ctrl2, end);
        return {
          sectorId: s.id,
          curve,
          points: curve.getPoints(28),
        };
      });

    // Curvas do Ecopolo Biometano abastecendo as estações/terminais do BRT
    const brt = stationsCoords.map((st, idx) => {
      const [tx, tz] = st.pos;
      const start = new THREE.Vector3(hubX, layer1Y + 0.45, hubZ);
      const end = new THREE.Vector3(tx, layer0Y + 0.22, tz);
      const dist = Math.hypot(tx - hubX, tz - hubZ);
      const ctrl1 = new THREE.Vector3(
        hubX + (tx - hubX) * 0.35,
        layer1Y + 1.1 + dist * 0.12,
        hubZ + (tz - hubZ) * 0.35
      );
      const ctrl2 = new THREE.Vector3(
        hubX + (tx - hubX) * 0.75,
        (layer1Y + layer0Y) * 0.5 + 1.2,
        hubZ + (tz - hubZ) * 0.75
      );
      const curve = new THREE.CubicBezierCurve3(start, ctrl1, ctrl2, end);
      return {
        id: st.id,
        idx,
        curve,
        points: curve.getPoints(32),
      };
    });

    return { rsuCurves: rsu, brtReturnCurves: brt };
  }, [sectors, layer1Y, layer0Y, hubX, hubZ, stationsCoords, selectedSectorId, hoveredSectorId]);

  // InstancedMesh para partículas animadas percorrendo as curvas
  const rsuParticlesRef = useRef<THREE.InstancedMesh>(null);
  const brtParticlesRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const flowSpeed = 0.18 + (biomethaneFleet / 100) * 0.55 + (greenInfra / 100) * 0.15;
  const particleScale = 0.06 + (biomethaneFleet / 100) * 0.08;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * flowSpeed;

    if (rsuParticlesRef.current) {
      let instanceIdx = 0;
      rsuCurves.forEach((item, cIdx) => {
        // 2 partículas por arco de coleta de RSU/Poda
        for (let p = 0; p < 2; p++) {
          const u = (t + cIdx * 0.13 + p * 0.5) % 1;
          const pos = item.curve.getPointAt(u);
          dummy.position.copy(pos);
          const isFocus = item.sectorId === selectedSectorId || item.sectorId === hoveredSectorId;
          const s = isFocus ? particleScale * 1.65 : particleScale;
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
        // 3 partículas por arco de injeção de Biometano no BRT
        for (let p = 0; p < 3; p++) {
          const u = (t * 1.25 + cIdx * 0.17 + p * 0.333) % 1;
          const pos = item.curve.getPointAt(u);
          dummy.position.copy(pos);
          const s = particleScale * 1.25;
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          brtParticlesRef.current!.setMatrixAt(instanceIdx++, dummy.matrix);
        }
      });
      brtParticlesRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const arcOpacity = 0.18 + (biomethaneFleet / 100) * 0.45;

  return (
    <group>
      {/* Hub Central de Biodigestão / Biometano CP2B (Aterro Delta A + ETE Capivari II) */}
      <group position={[hubX, layer1Y + 0.25, hubZ]}>
        <mesh>
          <cylinderGeometry args={[0.45, 0.55, 0.5, 24]} />
          <meshStandardMaterial
            color="#10b981"
            emissive="#059669"
            emissiveIntensity={0.8 + (biomethaneFleet / 100) * 1.2}
            transparent
            opacity={0.9}
          />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <sphereGeometry args={[0.36, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          <meshStandardMaterial
            color="#34d399"
            emissive="#10b981"
            emissiveIntensity={0.9}
            wireframe={false}
            transparent
            opacity={0.85}
          />
        </mesh>
        <Html position={[0, 0.95, 0]} center distanceFactor={22}>
          <div className="px-2.5 py-1 rounded-md bg-emerald-950/90 border border-emerald-400/60 text-[10px] font-mono text-emerald-200 whitespace-nowrap shadow-lg backdrop-blur-md">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
            ECOPOLO BIOMETANO CP2B (28.064 Nm³/d)
          </div>
        </Html>
      </group>

      {/* Arcos 3D: Coleta RSU Orgânico + Poda Urbana (Setores -> Hub CP2B) */}
      {rsuCurves.map((item) => {
        const isFocus = item.sectorId === selectedSectorId || item.sectorId === hoveredSectorId;
        return (
          <Line
            key={`rsu-arc-${item.sectorId}`}
            points={item.points}
            color={isFocus ? '#6ee7b7' : '#10b981'}
            lineWidth={isFocus ? 2.4 : 1.1}
            transparent
            opacity={isFocus ? 0.95 : arcOpacity}
          />
        );
      })}

      {/* Arcos 3D: Retorno de Biometano GNR (Hub CP2B -> Corredor BRT Campo Grande) */}
      {brtReturnCurves.map((item) => (
        <Line
          key={`brt-arc-${item.id}`}
          points={item.points}
          color="#38bdf8"
          lineWidth={1.6}
          transparent
          opacity={0.25 + (biomethaneFleet / 100) * 0.6}
          dashed
          dashScale={6}
          dashSize={0.6}
          dashOffset={0}
        />
      ))}

      {/* Partículas animadas de RSU/Poda Urbana (Verde Esmeralda) */}
      <instancedMesh ref={rsuParticlesRef} args={[undefined, undefined, rsuCurves.length * 2]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial color="#4ade80" />
      </instancedMesh>

      {/* Partículas animadas de Biometano Abastecendo o BRT (Ciano Brilhante) */}
      <instancedMesh ref={brtParticlesRef} args={[undefined, undefined, brtReturnCurves.length * 3]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color="#38bdf8" />
      </instancedMesh>
    </group>
  );
};

// Componente interno que renderiza as 3 camadas anatômicas e anima o Z-Spread e alturas suavemente
const ExplodedLayersGroup: React.FC<TwinScene3DProps> = ({
  sectors,
  params,
  selectedSectorId,
  hoveredSectorId,
  onSelectSector,
  onHoverSector,
}) => {
  // Referências de altura das camadas para interpolação suave (lerp)
  const layer1Ref = useRef<THREE.Group>(null);
  const layer2Ref = useRef<THREE.Group>(null);
  const currentSpreadRef = useRef(params.zSpread / 100);

  const targetSpread = params.zSpread / 100;
  const layer0Y = 0;
  const layer1TargetY = 0.22 + targetSpread * 4.4;
  const layer2TargetY = 0.45 + targetSpread * 9.0;

  useFrame((_, delta) => {
    currentSpreadRef.current = THREE.MathUtils.lerp(
      currentSpreadRef.current,
      targetSpread,
      Math.min(1, delta * 7)
    );
    const s = currentSpreadRef.current;
    if (layer1Ref.current) {
      layer1Ref.current.position.y = 0.22 + s * 4.4;
    }
    if (layer2Ref.current) {
      layer2Ref.current.position.y = 0.45 + s * 9.0;
    }
  });

  // Geometrias pré-calculadas para os 35 setores censitários reais de Campinas
  const sectorGeometries = useMemo(() => {
    return sectors.map((s) => {
      const [cx, cz] = projectCoord(s.centroid[0], s.centroid[1]);
      const shape = createPolygonShape(s.polygon, cx, cz);
      const extrudeBase = new THREE.ExtrudeGeometry(shape, {
        depth: 0.14,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.015,
        bevelThickness: 0.015,
      });
      extrudeBase.rotateX(-Math.PI / 2);

      const extrudeUnit = new THREE.ExtrudeGeometry(shape, {
        depth: 1.0,
        bevelEnabled: false,
      });
      extrudeUnit.rotateX(-Math.PI / 2);

      // Pontos de borda do polígono para destaque
      const borderPts: [number, number, number][] = s.polygon.map(([lon, lat]) => {
        const [px, pz] = projectCoord(lon, lat);
        return [px - cx, 0.16, pz - cz];
      });

      return {
        id: s.id,
        cx,
        cz,
        extrudeBase,
        extrudeUnit,
        borderPts,
      };
    });
  }, [sectors.length]);

  // Traçado do Corredor BRT Campo Grande (Av. John Boyd Dunlop)
  const brtCorridorPoints = useMemo(() => {
    return campinasData.corredor_brt.estacoes.map((st) => {
      const [x, z] = projectCoord(st.lon, st.lat);
      return new THREE.Vector3(x, 0.2, z);
    });
  }, []);

  // Contornos dos Distritos de Campinas no plano base para referência cartográfica real
  const districtOutlines = useMemo(() => {
    return campinasData.distritos.map((d) => {
      const pts = d.polygon.map(([lon, lat]) => {
        const [x, z] = projectCoord(lon, lat);
        return new THREE.Vector3(x, -0.03, z);
      });
      return { nome: d.nome, pts };
    });
  }, []);

  const activeId = hoveredSectorId ?? selectedSectorId;
  const activeSector = useMemo(
    () => sectors.find((s) => s.id === activeId) || null,
    [sectors, activeId]
  );

  return (
    <group>
      {/* Grade Cartográfica Científica no Solo (SIRGAS 2000 / UTM 23S Campinas) */}
      <gridHelper args={[42, 42, '#1e293b', '#0f172a']} position={[0, -0.06, 0]} />

      {/* Contornos sutis dos Distritos Reais de Campinas (Censo 2022) */}
      {districtOutlines.map((d) => (
        <Line
          key={`dist-${d.nome}`}
          points={d.pts}
          color="#334155"
          lineWidth={1}
          transparent
          opacity={0.45}
        />
      ))}

      {/* =====================================================================
          CAMADA 0 (SOLO): VETOR 3 - VULNERABILIDADE SOCIOAMBIENTAL E DE GÊNERO
         ===================================================================== */}
      <group position={[0, layer0Y, 0]}>
        {/* Plano de suporte translúcido da Camada 0 */}
        <mesh position={[0, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[32, 18]} />
          <meshStandardMaterial color="#020617" transparent opacity={0.75} roughness={0.9} />
        </mesh>

        {/* Rótulo 3D da Camada 0 quando explodido */}
        {params.zSpread > 8 && (
          <Html position={[-14.5, 0.3, -6.8]} distanceFactor={24}>
            <div className="px-3 py-1.5 rounded-lg bg-slate-900/95 border border-fuchsia-500/50 text-xs font-mono text-fuchsia-200 shadow-xl backdrop-blur-md whitespace-nowrap">
              <span className="font-bold text-fuchsia-400">NÍVEL 0 (SOLO)</span> · VETOR 3: VULNERABILIDADE SOCIOAMBIENTAL & GÊNERO (CENSO 2022)
            </div>
          </Html>
        )}

        {/* Polígonos Reais dos 35 Setores Censitários ao longo do Corredor BRT Campo Grande */}
        {sectors.map((s, idx) => {
          const geo = sectorGeometries[idx];
          const isSelected = s.id === selectedSectorId;
          const isHovered = s.id === hoveredSectorId;
          const isFocus = isSelected || isHovered;
          const color = getVulnerabilityColor(s.sim_vulnerabilidade_ivsg);

          return (
            <group key={`l0-${s.cd_setor}`} position={[geo.cx, 0, geo.cz]}>
              <mesh
                geometry={geo.extrudeBase}
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
                  color={color}
                  emissive={isFocus ? '#f43f5e' : color}
                  emissiveIntensity={isFocus ? 0.65 : 0.18}
                  roughness={0.4}
                  metalness={0.2}
                />
              </mesh>
              <Line
                points={geo.borderPts}
                color={isFocus ? '#ffffff' : '#94a3b8'}
                lineWidth={isFocus ? 2.5 : 0.8}
                transparent
                opacity={isFocus ? 1 : 0.45}
              />
            </group>
          );
        })}

        {/* Eixo Viário Brilhante: Corredor BRT Campo Grande (Av. John Boyd Dunlop) */}
        <Line
          points={brtCorridorPoints}
          color={params.biomethaneFleet > 50 ? '#34d399' : '#38bdf8'}
          lineWidth={4.5}
          transparent
          opacity={0.95}
        />

        {/* Estações e Terminais do BRT Campo Grande */}
        {campinasData.corredor_brt.estacoes.map((st) => {
          const [sx, sz] = projectCoord(st.lon, st.lat);
          const isTerminal = st.tipo === 'terminal';
          return (
            <group key={st.id} position={[sx, 0.22, sz]}>
              <mesh>
                <cylinderGeometry
                  args={[isTerminal ? 0.22 : 0.13, isTerminal ? 0.22 : 0.13, isTerminal ? 0.26 : 0.16, 18]}
                />
                <meshStandardMaterial
                  color={isTerminal ? '#38bdf8' : '#e2e8f0'}
                  emissive={isTerminal ? '#0284c7' : '#38bdf8'}
                  emissiveIntensity={isTerminal ? 1.1 : 0.6}
                />
              </mesh>
              {isTerminal && (
                <Html position={[0, 0.45, 0]} center distanceFactor={25}>
                  <div className="px-2 py-0.5 rounded bg-sky-950/90 border border-sky-400/60 text-[9px] font-mono text-sky-200 whitespace-nowrap shadow">
                    {st.nome}
                  </div>
                </Html>
              )}
            </group>
          );
        })}
      </group>

      {/* =====================================================================
          CAMADA 1 (INTERMEDIÁRIA): VETOR 2 - MITIGAÇÃO VERDE & CIRCULARIDADE CP2B
         ===================================================================== */}
      <group ref={layer1Ref} position={[0, layer1TargetY, 0]}>
        {/* Plano guia translúcido da Camada 1 */}
        {params.zSpread > 5 && (
          <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[32, 18]} />
            <meshStandardMaterial
              color="#064e3b"
              transparent
              opacity={0.12 * (params.zSpread / 100)}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {params.zSpread > 8 && (
          <Html position={[-14.5, 0.35, -6.8]} distanceFactor={24}>
            <div className="px-3 py-1.5 rounded-lg bg-slate-900/95 border border-emerald-500/50 text-xs font-mono text-emerald-200 shadow-xl backdrop-blur-md whitespace-nowrap">
              <span className="font-bold text-emerald-400">NÍVEL 1 (INTERMEDIÁRIO)</span> · VETOR 2: MITIGAÇÃO VERDE & ECOSSISTEMA BIOMETANO (CP2B)
            </div>
          </Html>
        )}

        {/* Volumes Verdes Translúcidos (Jardins de Chuva e Cobertura Arbórea sobre os setores) */}
        {sectors.map((s, idx) => {
          const geo = sectorGeometries[idx];
          const isFocus = s.id === selectedSectorId || s.id === hoveredSectorId;
          // Altura proporcional à cobertura arbórea + jardins de chuva
          const greenHeight = Math.max(0.08, (s.sim_cobertura_arborea_pct / 45) * 0.95);

          return (
            <group key={`l1-${s.cd_setor}`} position={[geo.cx, 0, geo.cz]}>
              <mesh
                geometry={geo.extrudeUnit}
                scale={[0.92, greenHeight, 0.92]}
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
                  color={isFocus ? '#34d399' : '#10b981'}
                  emissive={isFocus ? '#10b981' : '#047857'}
                  emissiveIntensity={isFocus ? 0.7 : 0.25}
                  transparent
                  opacity={isFocus ? 0.88 : 0.58}
                  roughness={0.3}
                />
              </mesh>
            </group>
          );
        })}

        {/* Fluxo Animado de Biogás/Biometano (RSU/Poda -> Biodigestão -> Corredor BRT) */}
        <BiogasEcosystemFlow
          sectors={sectors}
          layer1Y={0}
          layer0Y={-layer1TargetY}
          biomethaneFleet={params.biomethaneFleet}
          greenInfra={params.greenInfra}
          selectedSectorId={selectedSectorId}
          hoveredSectorId={hoveredSectorId}
        />
      </group>

      {/* =====================================================================
          CAMADA 2 (TOPO): VETOR 1 - DEMANDA ENERGÉTICA INDUZIDA E ILHA DE CALOR
         ===================================================================== */}
      <group ref={layer2Ref} position={[0, layer2TargetY, 0]}>
        {/* Plano guia translúcido da Camada 2 */}
        {params.zSpread > 5 && (
          <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[32, 18]} />
            <meshStandardMaterial
              color="#451a03"
              transparent
              opacity={0.12 * (params.zSpread / 100)}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {params.zSpread > 8 && (
          <Html position={[-14.5, 0.5, -6.8]} distanceFactor={24}>
            <div className="px-3 py-1.5 rounded-lg bg-slate-900/95 border border-amber-500/50 text-xs font-mono text-amber-200 shadow-xl backdrop-blur-md whitespace-nowrap">
              <span className="font-bold text-amber-400">NÍVEL 2 (TOPO)</span> · VETOR 1: DEMANDA ENERGÉTICA (MJ TRANSPORTE + ILHA DE CALOR) & MP2.5
            </div>
          </Html>
        )}

        {/* Prismas 3D Extrudados por Setor Censitário: Altura = Demanda Energética Total (MJ/dia), Cor = Concentração MP2.5 / CO2eq */}
        {sectors.map((s, idx) => {
          const geo = sectorGeometries[idx];
          const isFocus = s.id === selectedSectorId || s.id === hoveredSectorId;
          const barHeight = Math.max(0.18, (s.sim_mj_total_dia / 16000) * 2.2);
          const barColor = getEmissionsColor(s.sim_mp25_ugm3);

          return (
            <group key={`l2-${s.cd_setor}`} position={[geo.cx, 0, geo.cz]}>
              <mesh
                geometry={geo.extrudeUnit}
                scale={[0.78, barHeight, 0.78]}
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
                  emissive={isFocus ? '#ffffff' : barColor}
                  emissiveIntensity={isFocus ? 0.55 : 0.28}
                  transparent
                  opacity={isFocus ? 0.96 : 0.84}
                  roughness={0.25}
                  metalness={0.35}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* =====================================================================
          LINHAS GUIAS ANATÔMICAS VERTICAIS E CILINDRO DE CONEXÃO INTER-CAMADAS
         ===================================================================== */}
      {params.zSpread > 2 &&
        sectors.map((s, idx) => {
          const geo = sectorGeometries[idx];
          const isFocus = s.id === selectedSectorId || s.id === hoveredSectorId;
          if (!isFocus && idx % 4 !== 0) return null;

          return (
            <Line
              key={`guide-${s.cd_setor}`}
              points={[
                new THREE.Vector3(geo.cx, 0, geo.cz),
                new THREE.Vector3(geo.cx, layer2TargetY + 1.2, geo.cz),
              ]}
              color={isFocus ? '#38bdf8' : '#475569'}
              lineWidth={isFocus ? 2.5 : 0.75}
              dashed={!isFocus}
              dashScale={4}
              dashSize={0.3}
              transparent
              opacity={isFocus ? 0.95 : 0.35}
            />
          );
        })}

      {/* Cilindro Laser Vertical conectando o setor selecionado/focado simultaneamente nas 3 camadas */}
      {activeSector && (() => {
        const [ax, az] = projectCoord(activeSector.centroid[0], activeSector.centroid[1]);
        const totalH = layer2TargetY + 2.4;
        return (
          <group position={[ax, 0, az]}>
            <mesh position={[0, totalH / 2, 0]}>
              <cylinderGeometry args={[0.14, 0.14, totalH, 20]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.28} />
            </mesh>
            {/* Anéis luminosos nas 3 camadas para o setor em foco */}
            {[layer0Y + 0.16, layer1TargetY + 0.2, layer2TargetY + 0.2].map((ry, i) => (
              <mesh key={`ring-${i}`} position={[0, ry, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.38, 0.5, 28]} />
                <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        );
      })()}
    </group>
  );
};

export const TwinScene3D: React.FC<TwinScene3DProps> = (props) => {
  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [4, 15, 21], fov: 42, near: 0.1, far: 200 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onPointerMissed={() => props.onSelectSector(null)}
      >
        <color attach="background" args={['#020617']} />
        <fog attach="fog" args={['#020617', 28, 65]} />

        <ambientLight intensity={0.65} />
        <directionalLight position={[15, 28, 18]} intensity={1.3} color="#f8fafc" />
        <directionalLight position={[-15, 18, -12]} intensity={0.6} color="#38bdf8" />
        <pointLight position={[0, 10, 0]} intensity={0.8} color="#10b981" />

        <ExplodedLayersGroup {...props} />

        <OrbitControls
          enableDamping
          dampingFactor={0.06}
          maxPolarAngle={Math.PI / 2 - 0.04}
          minDistance={6}
          maxDistance={46}
          target={[0, (props.params.zSpread / 100) * 3.8, 0]}
        />
      </Canvas>
    </div>
  );
};
