import { useEffect, useMemo, useRef, useState } from 'react';
import type { Station, Tract } from './data';
import { classOf, formatValue, Lens, lensBreaks, lensRamp, lensValue } from './lenses';

const HEIGHT = 132;
const PAD = { left: 56, right: 14, top: 12, bottom: 26 };
const MAX_KM = 19;

interface Props {
  tracts: Tract[];
  stations: Station[];
  lens: Lens;
  selected: number | null;
  onSelect: (index: number) => void;
}

/** One dot per tract, by distance along the route. Hover for values, click to select. */
export function KmChart({ tracts, stations, lens, selected, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    if (!box.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  const { dots, low, high } = useMemo(() => {
    const breaks = lensBreaks(lens, tracts);
    const ramp = lensRamp(lens);
    const rows = tracts
      .map((t, i) => ({ i, km: t.km_route, v: t.display_group === 'urban' ? lensValue(lens, t) : null }))
      .filter((d): d is { i: number; km: number; v: number } => d.v != null && d.km != null)
      .map((d) => ({ ...d, color: ramp[classOf(d.v, breaks)] }));
    const sorted = rows.map((d) => d.v).sort((a, b) => a - b);
    // The top 1% stays visible at the edge; one extreme tract should not flatten the rest.
    return { dots: rows, low: sorted[0] ?? 0, high: sorted[Math.floor(sorted.length * 0.99)] ?? 1 };
  }, [tracts, lens]);

  const x = (km: number) => PAD.left + (Math.min(km, MAX_KM) / MAX_KM) * (width - PAD.left - PAD.right);
  const y = (v: number) => {
    const share = (Math.min(v, high) - low) / (high - low || 1);
    return HEIGHT - PAD.bottom - share * (HEIGHT - PAD.top - PAD.bottom);
  };
  const nearest = (clientX: number, clientY: number) => {
    const rect = box.current!.getBoundingClientRect();
    let best: number | null = null;
    let distance = 18;
    for (const d of dots) {
      const gap = Math.hypot(x(d.km) - (clientX - rect.left), y(d.v) - (clientY - rect.top));
      if (gap < distance) {
        distance = gap;
        best = d.i;
      }
    }
    return best;
  };
  const shown = hover != null ? dots.find((d) => d.i === hover) : null;
  const chosen = selected != null ? dots.find((d) => d.i === selected) : null;

  return (
    <div ref={box} style={{ position: 'relative', height: HEIGHT }}>
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`${lens.label} por setor ao longo do corredor, do km 0 ao km 18,7`}
        onPointerMove={(e) => setHover(nearest(e.clientX, e.clientY))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const hit = nearest(e.clientX, e.clientY);
          if (hit != null) onSelect(hit);
        }}
        style={{ display: 'block', cursor: hover != null ? 'pointer' : 'default' }}
      >
        <line x1={PAD.left} x2={width - PAD.right} y1={HEIGHT - PAD.bottom} y2={HEIGHT - PAD.bottom} stroke="#c9cbc5" />
        {[high, low].map((v) => (
          <text key={v} x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#565d66">
            {formatValue(v, lens.digits, lens.unit === 'R$' ? undefined : lens.unit)}
          </text>
        ))}
        {lens.id === 'heat' && <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="#c9cbc5" strokeDasharray="3 3" />}
        {[0, 5, 10, 15].map((km) => (
          <text key={km} x={x(km)} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="#565d66">
            km {km}
          </text>
        ))}
        {stations.map((s) => (
          <line key={s.name} x1={x(s.km)} x2={x(s.km)} y1={HEIGHT - PAD.bottom} y2={HEIGHT - PAD.bottom + 4} stroke="#0b7f99" strokeWidth={2} />
        ))}
        {dots.map((d) => (
          <circle key={d.i} cx={x(d.km)} cy={y(d.v)} r={3} fill={d.color} stroke="#fcfcfb" strokeWidth={0.8} />
        ))}
        {chosen && <circle cx={x(chosen.km)} cy={y(chosen.v)} r={6} fill={chosen.color} stroke="#10151a" strokeWidth={2} />}
        {shown && <circle cx={x(shown.km)} cy={y(shown.v)} r={5} fill={shown.color} stroke="#10151a" strokeWidth={1.2} />}
      </svg>
      {shown && (
        <div className="panel" style={{ position: 'absolute', left: Math.min(x(shown.km) + 10, width - 200), top: 2, padding: '4px 8px', fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          <strong>{formatValue(shown.v, lens.digits, lens.unit)}</strong> · km {formatValue(shown.km, 1)} · {tracts[shown.i].cd_setor}
        </div>
      )}
    </div>
  );
}
