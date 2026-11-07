import { useMemo } from 'react';
import type { Tract, TractFile } from './data';
import { formatValue, Lens, lensValue } from './lenses';

interface Row {
  field: string;
  label: string;
  unit?: string;
  digits?: number;
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'Pessoas',
    rows: [
      { field: 'population', label: 'População', digits: 0 },
      { field: 'households', label: 'Domicílios', digits: 0 },
      { field: 'income_mean_rs', label: 'Renda média', unit: 'R$', digits: 0 },
      { field: 'female_head_pct', label: 'Chefia feminina', unit: '%', digits: 0 },
      { field: 'black_indigenous_pct', label: 'Pretas e indígenas', unit: '%', digits: 0 },
      { field: 'age_60_plus_pct', label: '60 anos ou mais', unit: '%', digits: 0 },
      { field: 'vuln_index', label: 'Índice de vulnerabilidade', digits: 2 },
    ],
  },
  {
    title: 'Calor e verde',
    rows: [
      { field: 'uhi_delta_c', label: 'Anomalia de superfície', unit: '°C', digits: 1 },
      { field: 'tree_cover_pct', label: 'Cobertura arbórea', unit: '%', digits: 1 },
      { field: 'vegetation_pct', label: 'Vegetação', unit: '%', digits: 1 },
      { field: 'pcv_pct', label: 'Cobertura vegetal (PCV)', unit: '%', digits: 1 },
      { field: 'square_distance_m', label: 'Distância até praça', unit: 'm', digits: 0 },
    ],
  },
  {
    title: 'Construído',
    rows: [
      { field: 'cnefe_houses', label: 'Endereços de casa', digits: 0 },
      { field: 'cnefe_apartments', label: 'Endereços de apartamento', digits: 0 },
      { field: 'cnefe_establishments', label: 'Estabelecimentos', digits: 0 },
      { field: 'roof_area_m2', label: 'Área de telhado', unit: 'm²', digits: 0 },
    ],
  },
  {
    title: 'Estimativas de energia',
    rows: [
      { field: 'cooling_kwh_day', label: 'Resfriamento', unit: 'kWh/dia', digits: 0 },
      { field: 'solar_mwp_baseline', label: 'Solar nos telhados', unit: 'MWp', digits: 2 },
      { field: 'solar_mwp_conservative', label: 'Solar, conservador', unit: 'MWp', digits: 2 },
      { field: 'biomethane_nm3_day', label: 'Biometano', unit: 'Nm³/dia', digits: 1 },
    ],
  },
];

function Tag({ source, explain }: { source?: string; explain?: string }) {
  if (!source) return null;
  const [text, style] = source.startsWith('observed') ? ['observado', 'tag-observed'] : source.startsWith('derived') ? ['derivado', 'tag-derived'] : ['modelado', 'tag-modeled'];
  return (
    <span className={`tag ${style}`} title={explain}>
      {text}
    </span>
  );
}

interface Props {
  data: TractFile;
  tract: Tract | null;
  lens: Lens;
  onClose: () => void;
}

export function Sidebar({ data, tract, lens, onClose }: Props) {
  const totals = useMemo(() => {
    const urban = data.tracts.filter((t) => t.display_group === 'urban');
    return { tracts: data.tracts.length, urban: urban.length, population: urban.reduce((sum, t) => sum + (t.population ?? 0), 0), households: urban.reduce((sum, t) => sum + (t.households ?? 0), 0) };
  }, [data]);

  const rank = useMemo(() => {
    if (!tract) return null;
    const value = lensValue(lens, tract);
    if (value == null) return null;
    const values = data.tracts.filter((t) => t.display_group === 'urban').map((t) => lensValue(lens, t)).filter((v): v is number => v != null);
    return Math.round((100 * values.filter((v) => v <= value).length) / values.length);
  }, [tract, lens, data]);

  if (!tract) {
    return (
      <div style={{ padding: 16, fontSize: 14, lineHeight: 1.45 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>Clique em um prédio ou setor</h2>
        <p style={{ margin: '0 0 12px', color: 'var(--ink-2)' }}>
          O dado existe por setor censitário. Clicar em um prédio abre o setor dele, não uma ficha do prédio.
        </p>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', margin: 0 }}>
          <dt>Setores no corredor</dt>
          <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>{totals.tracts}</dd>
          <dt>Setores urbanos com dado</dt>
          <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>{totals.urban}</dd>
          <dt>População (Censo 2022)</dt>
          <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>{totals.population.toLocaleString('pt-BR')}</dd>
          <dt>Domicílios</dt>
          <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>{totals.households.toLocaleString('pt-BR')}</dd>
        </dl>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, fontSize: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, fontVariantNumeric: 'tabular-nums' }}>Setor {tract.cd_setor}</h2>
          <p style={{ margin: '2px 0 0', color: 'var(--ink-2)' }}>
            {tract.situation} · km {formatValue(tract.km_route, 1)} da rota · {formatValue(tract.area_km2, 2, 'km²')}
          </p>
        </div>
        <button className="btn" onClick={onClose} aria-label="Fechar setor">
          Fechar
        </button>
      </div>
      {tract.display_group !== 'urban' && (
        <p style={{ margin: '10px 0 0', color: 'var(--ink-2)' }}>Setor rural, sem população ou com dado sigiloso: muitos valores não existem aqui.</p>
      )}
      {rank != null && lens.id !== 'city' && (
        <p style={{ margin: '10px 0 0', padding: '6px 8px', background: '#f1f2ee', borderRadius: 6 }}>
          {lens.label}: <strong>{formatValue(lensValue(lens, tract), lens.digits, lens.unit)}</strong>. Valor igual ou acima de {rank}% dos setores urbanos.
        </p>
      )}
      {GROUPS.map((group) => (
        <section key={group.title} style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.3 }}>{group.title}</h3>
          {group.rows.map((row) => {
            const source = data.attributes[row.field];
            return (
              <div key={row.field} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, padding: '3px 0', borderTop: '1px solid var(--line)', alignItems: 'baseline' }}>
                <span>{row.label}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{formatValue(tract[row.field], row.digits, row.unit)}</span>
                <Tag source={source} explain={data.source_types[source]} />
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
