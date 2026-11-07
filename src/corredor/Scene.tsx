import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { MeshData, Station, Tract } from './data';

export interface View {
  position: [number, number, number];
  target: [number, number, number];
  key: number;
}

/** Blender (x, y) to the page's world, where y is up and north is -z. */
export const groundPoint = (x: number, y: number): [number, number, number] => [x, 0, -y];
const GROUP_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0];
const SHADE_AT_BASE = 0.74;

function makeGeometry(data: MeshData) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.index, 1));
  return geometry;
}

function GroundLayer({ data, order, visible = true, colors, name }: { data: MeshData; order: number; visible?: boolean; colors?: Uint8Array; name?: string }) {
  const geometry = useMemo(() => {
    const g = makeGeometry(data);
    if (data.tract) g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(data.meta.vertices * 3), 3, true));
    return g;
  }, [data]);
  const color = useMemo(() => new THREE.Color(data.meta.color ?? '#ffffff'), [data]);
  useLayoutEffect(() => {
    if (!data.tract || !colors) return;
    paint(geometry, data, colors, null);
  }, [colors, data, geometry]);
  return (
    <mesh name={name} geometry={geometry} position={data.meta.origin} scale={data.meta.scale} renderOrder={order} visible={visible} frustumCulled={false}>
      <meshBasicMaterial color={color} vertexColors={!!data.tract} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function paint(geometry: THREE.BufferGeometry, data: MeshData, colors: Uint8Array, base: Uint8Array | null) {
  const attribute = geometry.getAttribute('color') as THREE.BufferAttribute;
  const out = attribute.array as Uint8Array;
  const tract = data.tract!;
  const none = colors.length / 3 - 1;
  for (let i = 0; i < tract.length; i++) {
    const k = (tract[i] >= none ? none : tract[i]) * 3;
    const shade = base && base[i] ? SHADE_AT_BASE : 1;
    out[i * 3] = colors[k] * shade;
    out[i * 3 + 1] = colors[k + 1] * shade;
    out[i * 3 + 2] = colors[k + 2] * shade;
  }
  attribute.needsUpdate = true;
}

function Buildings({ data, colors }: { data: MeshData; colors: Uint8Array }) {
  const { geometry, base } = useMemo(() => {
    const g = makeGeometry(data);
    g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(data.meta.vertices * 3), 3, true));
    const n = data.meta.vertices;
    let lowest = Infinity;
    for (let i = 0; i < n; i++) lowest = Math.min(lowest, data.positions[i * 3 + 2]);
    const flags = new Uint8Array(n);
    for (let i = 0; i < n; i++) flags[i] = data.positions[i * 3 + 2] === lowest ? 1 : 0;
    return { geometry: g, base: flags };
  }, [data]);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    paint(geometry, data, colors, base);
    invalidate();
  }, [colors, data, geometry, base, invalidate]);
  return (
    <mesh geometry={geometry} position={data.meta.origin} scale={data.meta.scale} renderOrder={40} frustumCulled={false} userData={{ data }}>
      <meshLambertMaterial vertexColors flatShading />
    </mesh>
  );
}

function Trees({ data }: { data: MeshData }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const n = data.meta.vertices;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const { origin, scale } = data.meta;
    for (let i = 0; i < n; i++) {
      const x = data.positions[i * 3] * scale + origin[0];
      const y = data.positions[i * 3 + 1] * scale + origin[1];
      const r = data.positions[i * 3 + 2] * scale + origin[2];
      m.compose(new THREE.Vector3(x, y, r * 1.5), q, new THREE.Vector3(r, r, r * 1.25));
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [data, n]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} renderOrder={41} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshLambertMaterial color="#58ad4d" flatShading />
    </instancedMesh>
  );
}

function Rig({ view }: { view: View }) {
  const { camera, controls, invalidate } = useThree() as any;
  const goal = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const stop = () => {
    goal.current = null;
  };
  useEffect(() => {
    goal.current = { position: new THREE.Vector3(...view.position), target: new THREE.Vector3(...view.target) };
    invalidate();
  }, [view.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!controls) return;
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls]);
  useFrame(() => {
    if (!goal.current || !controls) return;
    camera.position.lerp(goal.current.position, 0.12);
    controls.target.lerp(goal.current.target, 0.12);
    controls.update();
    if (camera.position.distanceTo(goal.current.position) < 0.5) goal.current = null;
    else invalidate();
  });
  return null;
}

function Picker({ onPick }: { onPick: (index: number | null) => void }) {
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    const element = gl.domElement;
    const raycaster = new THREE.Raycaster();
    let down: [number, number] | null = null;
    const onDown = (e: PointerEvent) => {
      down = [e.clientX, e.clientY];
    };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const rect = element.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
      const targets: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && (o.userData.data || o.name === 'tracts')) targets.push(o);
      });
      const hits = raycaster.intersectObjects(targets, false);
      let picked: number | null = null;
      for (const hit of hits) {
        const tract: Uint16Array | null = hit.object.name === 'tracts' ? hit.object.userData.tract : hit.object.userData.data?.tract;
        if (!tract || !hit.face) continue;
        const value = tract[hit.face.a];
        if (value < 65535) {
          picked = value;
          break;
        }
      }
      onPick(picked);
    };
    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointerup', onUp);
    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointerup', onUp);
    };
  }, [gl, camera, scene, onPick]);
  return null;
}

function Redraw({ on }: { on: unknown[] }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
    const late = setTimeout(invalidate, 100);
    return () => clearTimeout(late);
  }, on); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function TractLayer({ data, order, visible, colors }: { data: MeshData; order: number; visible: boolean; colors: Uint8Array }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.userData.tract = data.tract;
    });
  }, [data]);
  return (
    <group ref={ref}>
      <GroundLayer data={data} order={order} visible={visible} colors={colors} name="tracts" />
    </group>
  );
}

export interface SceneProps {
  ground: MeshData[];
  buildings: MeshData[];
  trees: MeshData | null;
  stations: Station[];
  tractColors: Uint8Array;
  buildingColors: Uint8Array;
  lensOn: boolean;
  selected: Tract | null;
  view: View;
  onPick: (index: number | null) => void;
}

export function Scene({ ground, buildings, trees, stations, tractColors, buildingColors, lensOn, selected, view, onPick }: SceneProps) {
  return (
    <Canvas
      flat
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: view.position, fov: 38, near: 2, far: 9000 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
      aria-label="Cidade em 3D. Os mesmos dados estão na tabela de setores."
    >
      <color attach="background" args={['#e9ebe6']} />
      <hemisphereLight args={['#ffffff', '#b9bdb2', 2.1]} />
      <directionalLight position={[-420, 620, 300]} intensity={1.7} />
      <OrbitControls makeDefault target={view.target} maxPolarAngle={1.47} minDistance={12} maxDistance={3000} enableDamping={false} screenSpacePanning={false} />
      <Rig view={view} />
      <Picker onPick={onPick} />
      <Redraw on={[ground, buildings, trees, tractColors, buildingColors, lensOn, selected]} />
      <group rotation={GROUP_ROTATION}>
        {ground.map((layer, i) =>
          layer.meta.name === 'tracts' ? (
            <TractLayer key={layer.meta.file} data={layer} order={i} visible={lensOn} colors={tractColors} />
          ) : (
            <GroundLayer key={layer.meta.file} data={layer} order={i} />
          ),
        )}
        {buildings.map((section) => (
          <Buildings key={section.meta.file} data={section} colors={buildingColors} />
        ))}
        {trees && <Trees data={trees} />}
        {selected?.rings.map((ring, i) => (
          <Line key={`${selected.cd_setor}-${i}`} points={ring.map(([x, y]) => [x, y, 0.1] as [number, number, number])} color="#10151a" lineWidth={2.4} depthTest={false} renderOrder={60} />
        ))}
        {stations.map((station) => (
          <Html key={station.name} position={[station.at[0], station.at[1], 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            {station.kind === 'terminal' ? (
              <span style={{ background: '#10151a', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 11, whiteSpace: 'nowrap' }}>{station.name}</span>
            ) : (
              <span title={station.name} style={{ display: 'block', width: 9, height: 9, borderRadius: 9, background: '#fff', border: '2.5px solid #0b7f99' }} />
            )}
          </Html>
        ))}
      </group>
    </Canvas>
  );
}
