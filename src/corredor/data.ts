export interface MeshMeta {
  name?: string;
  color?: string;
  file: string;
  vertices: number;
  indices: number;
  origin: [number, number, number];
  scale: number;
  has_tract: boolean;
  bytes: number;
  buildings?: number;
}

export interface MeshData {
  meta: MeshMeta;
  positions: Int16Array;
  tract: Uint16Array | null;
  index: Uint32Array;
}

export type Tract = Record<string, any> & {
  cd_setor: string;
  display_group: string;
  km_route: number;
  centre: [number, number];
  rings: [number, number][][];
};

export interface Station {
  name: string;
  kind: string;
  km: number;
  at: [number, number];
}

export interface TractFile {
  tracts: Tract[];
  stations: Station[];
  attributes: Record<string, string>;
  source_types: Record<string, string>;
}

const BASE = './data/';

async function fetchBytes(file: string): Promise<ArrayBuffer> {
  const response = await fetch(BASE + file);
  if (!response.ok) throw new Error(`${file}: ${response.status}`);
  const raw = await response.arrayBuffer();
  const head = new Uint8Array(raw, 0, 2);
  if (head[0] !== 0x1f || head[1] !== 0x8b) return raw;
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

export async function fetchJson<T>(file: string): Promise<T> {
  const response = await fetch(BASE + file);
  if (!response.ok) throw new Error(`${file}: ${response.status}`);
  return response.json();
}

/** Reverses twin_web_pack.pack: three delta-coded position channels, optional tract, indices. */
export async function loadMesh(meta: MeshMeta): Promise<MeshData> {
  const buffer = await fetchBytes(meta.file);
  const n = meta.vertices;
  let offset = 0;
  const positions = new Int16Array(n * 3);
  for (let axis = 0; axis < 3; axis++) {
    const channel = new Int16Array(buffer, offset, n);
    let value = 0;
    for (let i = 0; i < n; i++) {
      value = (value + channel[i]) << 16 >> 16;
      positions[i * 3 + axis] = value;
    }
    offset += n * 2;
  }
  let tract: Uint16Array | null = null;
  if (meta.has_tract) {
    const channel = new Uint16Array(buffer, offset, n);
    tract = new Uint16Array(n);
    let value = 0;
    for (let i = 0; i < n; i++) {
      value = (value + channel[i]) & 0xffff;
      tract[i] = value;
    }
    offset += n * 2;
  }
  // Int32 values may start on a 2-byte boundary, so copy before viewing them.
  const bytes = buffer.slice(offset, offset + meta.indices * 4);
  const channel = new Int32Array(bytes);
  const index = new Uint32Array(meta.indices);
  let value = 0;
  for (let i = 0; i < meta.indices; i++) {
    value += channel[i];
    index[i] = value;
  }
  return { meta, positions, tract, index };
}
