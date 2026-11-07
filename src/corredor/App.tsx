import { useCallback, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { fetchJson, loadMesh, MeshData, MeshMeta, TractFile } from './data';
import { classOf, formatValue, LENSES, lensBreaks, lensRamp, lensValue } from './lenses';
import { groundPoint, Scene, View } from './Scene';
import { Sidebar } from './Sidebar';
import { KmChart } from './KmChart';

const START: Omit<View, 'key'> = { position: [570, 210, -50], target: [427, 0, -328] };
const WHOLE: Omit<View, 'key'> = { position: [120, 1650, 1250], target: [120, 0, -40] };
const NO_DATA = '#d5d7d2';
const SELECTED_TINT = '#7fd3e6';

function toBytes(hexes: string[]) {
  const out = new Uint8Array(hexes.length * 3);
  const c = new THREE.Color();
  hexes.forEach((hex, i) => {
    c.set(hex); // converted to linear, as the renderer expects
    out[i * 3] = c.r * 255;
    out[i * 3 + 1] = c.g * 255;
    out[i * 3 + 2] = c.b * 255;
  });
  return out;
}

export function App() {
  const [data, setData] = useState<TractFile | null>(null);
  const [ground, setGround] = useState<MeshData[]>([]);
  const [buildings, setBuildings] = useState<MeshData[]>([]);
  const [trees, setTrees] = useState<MeshData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lensId, setLensId] = useState('city');
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<'3d' | 'top'>('3d');
  const [view, setView] = useState<View>({ ...START, key: 0 });
  const [panel, setPanel] = useState<'none' | 'sources' | 'table'>('none');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tracts, base, parts] = await Promise.all([
        fetchJson<TractFile>('tracts.json'),
        fetchJson<{ layers: MeshMeta[] }>('base.json'),
        fetchJson<{ sections: MeshMeta[]; trees: MeshMeta }>('buildings.json'),
      ]);
      if (cancelled) return;
      setData(tracts);
      const layers = await Promise.all(base.layers.map(loadMesh));
      const forest = await loadMesh(parts.trees);
      if (cancelled) return;
      setGround(layers);
      setTrees(forest);
      for (const section of parts.sections) {
        const mesh = await loadMesh(section);
        if (cancelled) return;
        setBuildings((list) => [...list, mesh]);
      }
    })().catch((e) => setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const lens = LENSES.find((l) => l.id === lensId)!;
  const lensOn = lensId !== 'city';
  const tract = data && selected != null ? data.tracts[selected] : null;

  const breaks = useMemo(() => (data && lensOn ? lensBreaks(lens, data.tracts) : []), [data, lens, lensOn]);

  const { tractColors, buildingColors } = useMemo(() => {
    const list = data?.tracts ?? [];
    const ramp = lensRamp(lens);
    const lensHex = list.map((t) => {
      const value = lensValue(lens, t);
      return value == null ? NO_DATA : ramp[classOf(value, breaks)];
    });
    const building = list.map((_, i) => (lensOn ? lensHex[i] : i === selected ? SELECTED_TINT : '#ffffff'));
    return { tractColors: toBytes([...lensHex, NO_DATA]), buildingColors: toBytes([...building, lensOn ? NO_DATA : '#ffffff']) };
  }, [data, lens, lensOn, breaks, selected]);

  const go = useCallback((v: Omit<View, 'key'>) => setView((old) => ({ ...v, key: old.key + 1 })), []);

  const focus = useCallback(
    (index: number) => {
      setSelected(index);
      if (!data) return;
      const [x, , z] = groundPoint(...data.tracts[index].centre);
      const top = mode === 'top';
      go({ position: top ? [x, 620, z + 1] : [x + 150, 210, z + 230], target: [x, 0, z] });
    },
    [data, go, mode],
  );

  const setCameraMode = (next: '3d' | 'top') => {
    setMode(next);
    const [x, , z] = tract ? groundPoint(...tract.centre) : START.target;
    go(next === 'top' ? { position: [x, tract ? 620 : 1100, z + 1], target: [x, 0, z] } : { position: [x + 213, 300, z + 418], target: [x, 0, z] });
  };

  const onPick = useCallback((index: number | null) => setSelected(index), []);
  const loaded = buildings.length;
  const ramp = lensRamp(lens);
  const fmt = (v: number) => formatValue(v, lens.digits, lens.unit === 'R$' ? undefined : lens.unit);

  if (error) return <p style={{ padding: 24 }}>Não foi possível carregar os dados: {error}</p>;

  return (
    <div style={{ position: 'absolute', inset: 0 }} className="flex flex-col md:flex-row">
      <main style={{ position: 'relative', flex: 1, minHeight: 0, minWidth: 0 }}>
        {data && ground.length > 0 && (
          <Scene ground={ground} buildings={buildings} trees={trees} stations={data.stations} tractColors={tractColors} buildingColors={buildingColors} lensOn={lensOn} selected={tract} view={view} onPick={onPick} />
        )}

        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'start', pointerEvents: 'none' }}>
          <div className="panel" style={{ padding: '8px 10px', pointerEvents: 'auto', maxWidth: '100%' }}>
            <h1 style={{ margin: 0, fontSize: 15, fontWeight: 650 }}>Corredor BRT Campo Grande</h1>
            <p className="max-md:hidden" style={{ margin: '1px 0 6px', fontSize: 12, color: 'var(--ink-2)' }}>Campinas-SP · protótipo de pesquisa, NIPE/UNICAMP</p>
            <label style={{ fontSize: 12, display: 'block' }}>
              <span className="max-md:hidden">Indicador por setor</span>
              <select className="btn" style={{ display: 'block', width: '100%', marginTop: 3 }} value={lensId} onChange={(e) => setLensId(e.target.value)}>
                {LENSES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-1.5 max-md:w-full max-md:overflow-x-auto md:flex-wrap" style={{ pointerEvents: 'auto' }}>
            <button className="btn" aria-pressed={mode === '3d'} onClick={() => setCameraMode('3d')}>3D</button>
            <button className="btn" aria-pressed={mode === 'top'} onClick={() => setCameraMode('top')}>Vista de cima</button>
            <button className="btn" onClick={() => { setMode('3d'); go(WHOLE); }}>Corredor inteiro</button>
            <button className="btn" onClick={() => setPanel('table')}>Tabela</button>
            <button className="btn" onClick={() => setPanel('sources')}>Fontes e limites</button>
          </div>
        </div>

        {loaded < 4 && (
          <div className="panel" role="status" style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translateX(-50%)', padding: '8px 12px', fontSize: 13 }}>
            Carregando prédios: trecho {Math.min(loaded + 1, 4)} de 4
          </div>
        )}

        {lensOn && data && (
          <div className="panel" style={{ position: 'absolute', left: 10, right: 10, bottom: 10, padding: '8px 10px', maxWidth: 860 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center', fontSize: 12 }}>
              <strong>{lens.label}</strong>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ramp.map((color, k) => (
                  <span key={color} style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                    <span style={{ width: 11, height: 11, borderRadius: 2, background: color, border: '1px solid #9a9d97' }} />
                    {k === 0 ? `< ${fmt(breaks[0])}` : k === ramp.length - 1 ? `≥ ${fmt(breaks[k - 1])}` : `${fmt(breaks[k - 1])} a ${fmt(breaks[k])}`}
                  </span>
                ))}
                <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                  <span style={{ width: 11, height: 11, borderRadius: 2, background: NO_DATA, border: '1px solid #9a9d97' }} /> sem dado
                </span>
              </span>
            </div>
            <p className="max-md:hidden" style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-2)' }}>{lens.note}</p>
            <div className="max-md:hidden">
              <KmChart tracts={data.tracts} stations={data.stations} lens={lens} selected={selected} onSelect={focus} />
            </div>
          </div>
        )}
      </main>

      <aside className="panel max-md:h-[34vh] md:w-[340px]" style={{ borderRadius: 0, borderWidth: '0 0 0 1px', overflowY: 'auto', flexShrink: 0 }}>
        {data && <Sidebar data={data} tract={tract} lens={lens} onClose={() => setSelected(null)} />}
      </aside>

      {panel !== 'none' && data && (
        <div role="dialog" aria-modal="true" style={{ position: 'absolute', inset: 0, background: 'rgb(15 20 25 / 0.35)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 20 }} onClick={() => setPanel('none')}>
          <div className="panel" style={{ width: 'min(720px, 100%)', maxHeight: '86vh', overflowY: 'auto', padding: 16, fontSize: 14, lineHeight: 1.45 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 650 }}>{panel === 'table' ? `Setores: ${lensOn ? lens.label : 'população'}` : 'Fontes e limites'}</h2>
              <button className="btn" onClick={() => setPanel('none')}>Fechar</button>
            </div>
            {panel === 'table' ? (
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th>Setor</th>
                    <th>km</th>
                    <th style={{ textAlign: 'right' }}>{lensOn ? lens.label : 'População'}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tracts.map((t, i) => ({ t, i })).sort((a, b) => a.t.km_route - b.t.km_route).map(({ t, i }) => (
                    <tr key={t.cd_setor} style={{ borderTop: '1px solid var(--line)', cursor: 'pointer' }} onClick={() => { focus(i); setPanel('none'); }}>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{t.cd_setor}</td>
                      <td>{formatValue(t.km_route, 1)}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{lensOn ? formatValue(lensValue(lens, t), lens.digits, lens.unit) : formatValue(t.population, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <>
                <p>Este é um modelo de pesquisa em construção, não um levantamento oficial nem um gêmeo em tempo real.</p>
                <h3 style={{ fontWeight: 600, marginTop: 12 }}>Limites importantes</h3>
                <ul style={{ paddingLeft: 18, listStyle: 'disc' }}>
                  <li>Os contornos de cerca de 96% dos prédios foram detectados por aprendizado de máquina em imagens. Vizinhos podem aparecer unidos, e alguns podem não existir.</li>
                  <li>Quase todas as alturas são modeladas a partir de contagens de endereços do CNEFE ou de valores padrão. Torres reais acima de 36 m tendem a aparecer baixas.</li>
                  <li>As árvores são ilustrativas: as áreas verdes são reais, as posições não.</li>
                  <li>Calor é temperatura de superfície por satélite, não do ar.</li>
                  <li>Estimativas de energia são fórmulas com coeficientes assumidos. Os telhados do trecho externo são extrapolados.</li>
                  <li>Nomes de bairros ainda não estão disponíveis; os setores aparecem pelo código do IBGE.</li>
                </ul>
                <h3 style={{ fontWeight: 600, marginTop: 12 }}>Fontes</h3>
                <ul style={{ paddingLeft: 18, listStyle: 'disc' }}>
                  <li>Prédios: Overture Maps Foundation, release 2026-10-21 (ODbL), com dados © OpenStreetMap contributors, Google Open Buildings e Microsoft.</li>
                  <li>Vias, rota e estações: © OpenStreetMap contributors (ODbL).</li>
                  <li>Setores e indicadores sociais: IBGE, Censo 2022 e CNEFE 2022.</li>
                  <li>Calor e vegetação por setor: Plataforma UrbVerde, USP. Uso para pesquisa, educação e fins públicos.</li>
                  <li>Cobertura do solo: MapBiomas, coleção com ano de 2024.</li>
                  <li>Hidrografia: Fundação Brasileira para o Desenvolvimento Sustentável (FBDS).</li>
                  <li>Elevação: Copernicus DEM.</li>
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
