import React, { Suspense, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Cp2bNode, SectorSimulated, SimulationParams } from '../types';
import { getPeopleLayerColor } from '../simulationEngine';
import campinasData from '../data/campinasRealData.json';

interface BlenderGlbBridgeProps {
  visible: boolean;
  sectors: SectorSimulated[];
  params: SimulationParams;
  onSelectSector: (id: number | null) => void;
  onSelectCp2bNode: (node: Cp2bNode | null) => void;
}

const BlenderGlbModel: React.FC<Omit<BlenderGlbBridgeProps, 'visible'>> = ({
  sectors,
  params,
  onSelectSector,
  onSelectCp2bNode,
}) => {
  const gltf = useGLTF('./models/campinas_digital_twin.glb');
  const isDaylight = params.visualStyle === 'editorial_daylight';
  const mitigationScore = (params.biomethaneFleet * 0.55 + params.greenInfra * 0.45) / 100;

  useEffect(() => {
    const sectorMap = new Map<string, SectorSimulated>();
    sectors.forEach((s) => sectorMap.set(String(s.cd_setor), s));

    gltf.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const ud = mesh.userData || {};

        // Atualiza cor dinâmica dos setores censitários exportados pelo Blender 5.2
        if (ud.cd_setor && sectorMap.has(String(ud.cd_setor))) {
          const sec = sectorMap.get(String(ud.cd_setor))!;
          const col = getPeopleLayerColor(sec, params.peopleLens, isDaylight);
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          mat.color.set(col);
          mesh.material = mat;
        }

        // Atualiza cor dinâmica dos edifícios críticos OSM conforme avanço do CP2B
        if (ud.highlight_role === 'social_red') {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          mat.color.set(
            mitigationScore > 0.7 ? '#22c55e' : mitigationScore > 0.4 ? '#eab308' : '#ef4444'
          );
          mesh.material = mat;
        }
      }
    });
  }, [gltf.scene, sectors, params.peopleLens, isDaylight, mitigationScore]);

  const cp2bNodes = ((campinasData as unknown as { cp2b?: { nodes: Cp2bNode[] } }).cp2b?.nodes) || [];

  return (
    <primitive
      object={gltf.scene}
      onClick={(e: { stopPropagation: () => void; object: THREE.Object3D }) => {
        e.stopPropagation();
        const ud = e.object.userData || e.object.parent?.userData || {};
        if (ud.sector_id) {
          onSelectSector(Number(ud.sector_id));
        } else if (ud.node_id) {
          const found = cp2bNodes.find((n) => n.nodeId === String(ud.node_id));
          if (found) onSelectCp2bNode(found);
        }
      }}
    />
  );
};

export const BlenderGlbBridge: React.FC<BlenderGlbBridgeProps> = (props) => {
  if (!props.visible) return null;
  return (
    <Suspense fallback={null}>
      <BlenderGlbModel {...props} />
    </Suspense>
  );
};
