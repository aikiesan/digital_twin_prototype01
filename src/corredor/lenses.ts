import type { Tract } from './data';

export interface Lens {
  id: string;
  label: string;
  field?: string;
  unit?: string;
  digits?: number;
  note?: string;
  /** Fixed class breaks for a diverging scale; otherwise quintiles. */
  breaks?: number[];
  ramp?: string[];
  value?: (t: Tract) => number | null;
}

// One hue, light to dark. Violet so it cannot be read as water on the ground.
const SEQUENTIAL = ['#e3dffb', '#bdb4f2', '#9085e9', '#6250d6', '#3b2c9e'];
// Blue and red arms around a neutral grey at zero.
const DIVERGING = ['#1c5cab', '#5598e7', '#b7d3f6', '#f0efec', '#f6c4c3', '#e66767', '#a82626'];

export const LENSES: Lens[] = [
  { id: 'city', label: 'Cidade (sem dado)' },
  { id: 'vuln', label: 'Vulnerabilidade', field: 'vuln_index', digits: 2, note: 'Índice 0–1 calculado do Censo 2022, com pesos assumidos.' },
  { id: 'income', label: 'Renda média', field: 'income_mean_rs', unit: 'R$', digits: 0, note: 'Censo 2022.' },
  { id: 'heat', label: 'Calor de superfície', field: 'uhi_delta_c', unit: '°C', digits: 1, breaks: [-2, -1, -0.25, 0.25, 1.5, 3], ramp: DIVERGING, note: 'Anomalia UrbVerde 2025, Landsat 30 m. Superfície, não temperatura do ar.' },
  { id: 'trees', label: 'Cobertura arbórea', field: 'tree_cover_pct', unit: '%', digits: 1, note: 'MapBiomas 2024, 30 m: não enxerga árvores isoladas de rua.' },
  { id: 'race', label: 'Pessoas pretas e indígenas', field: 'black_indigenous_pct', unit: '%', digits: 0, note: 'Censo 2022.' },
  { id: 'density', label: 'Densidade', unit: 'hab/km²', digits: 0, note: 'População do Censo 2022 dividida pela área do setor.', value: (t) => (t.population != null && t.area_km2 > 0 ? t.population / t.area_km2 : null) },
];

export function lensValue(lens: Lens, tract: Tract): number | null {
  if (lens.value) return lens.value(tract);
  if (!lens.field) return null;
  const value = tract[lens.field];
  return typeof value === 'number' ? value : null;
}

export function lensBreaks(lens: Lens, tracts: Tract[]): number[] {
  if (lens.breaks) return lens.breaks;
  const values = tracts.map((t) => lensValue(lens, t)).filter((v): v is number => v != null).sort((a, b) => a - b);
  return [0.2, 0.4, 0.6, 0.8].map((q) => values[Math.floor(q * (values.length - 1))] ?? 0);
}

export function lensRamp(lens: Lens): string[] {
  return lens.ramp ?? SEQUENTIAL;
}

export function classOf(value: number, breaks: number[]): number {
  let k = 0;
  while (k < breaks.length && value >= breaks[k]) k++;
  return k;
}

export function formatValue(value: number | null | undefined, digits = 1, unit?: string): string {
  if (value == null) return 'sem dado';
  const text = value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (unit === 'R$') return `R$ ${text}`;
  return unit ? `${text} ${unit}` : text;
}
