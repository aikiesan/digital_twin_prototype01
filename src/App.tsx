import React, { useMemo, useState } from 'react';
import campinasData from './data/campinasRealData.json';
import { SectorRaw, SimulationParams } from './types';
import { simulateSectors } from './simulationEngine';
import { SimulationSidebar } from './components/SimulationSidebar';
import { TwinScene3D } from './components/TwinScene3D';
import { KpiAndTelemetryOverlay } from './components/KpiAndTelemetryOverlay';

export function App() {
  const [params, setParams] = useState<SimulationParams>({
    zSpread: 40,          // Camadas semi-integradas sobre o relevo e tecido urbano 3D
    biomethaneFleet: 45,  // 45% da frota BRT convertida a Biometano CP2B
    greenInfra: 40,       // 40% de expansão de Jardins de Chuva e Arborização
    modalShift: 35,       // 35% de transferência modal Carro -> BRT Campo Grande
    terrainExaggeration: 65, // Relevo 3D real de Campinas (SRTM 30m: 552m a 771m)
    peopleLens: 'renda',  // Inicia na Lente Humana ("Quem mora onde em Campinas")
    visualStyle: 'editorial_daylight', // Estilo Maquete Arquitetônica Clara (como nas imagens de referência)
  });

  const [selectedSectorId, setSelectedSectorId] = useState<number | null>(18);
  const [hoveredSectorId, setHoveredSectorId] = useState<number | null>(null);

  const rawSectors = campinasData.setores as unknown as SectorRaw[];

  const { simulated, kpis } = useMemo(
    () => simulateSectors(rawSectors, params),
    [rawSectors, params]
  );

  const activeSector = useMemo(() => {
    const targetId = hoveredSectorId ?? selectedSectorId;
    return simulated.find((s) => s.id === targetId) || null;
  }, [simulated, hoveredSectorId, selectedSectorId]);

  const handlePresetSelect = (preset: 'baseline' | 'cp2b_2030' | 'net_zero_justica') => {
    if (preset === 'baseline') {
      setParams((p) => ({
        ...p,
        biomethaneFleet: 0,
        greenInfra: 0,
        modalShift: 0,
      }));
    } else if (preset === 'cp2b_2030') {
      setParams((p) => ({
        ...p,
        zSpread: Math.max(p.zSpread, 65),
        biomethaneFleet: 60,
        greenInfra: 55,
        modalShift: 50,
      }));
    } else {
      setParams((p) => ({
        ...p,
        zSpread: 85,
        biomethaneFleet: 100,
        greenInfra: 100,
        modalShift: 85,
      }));
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden flex bg-slate-950 text-slate-100">
      {/* Sidebar Esquerda: Surrogate Model Interativo com 4 Sliders */}
      <SimulationSidebar
        params={params}
        onChange={setParams}
        onPresetSelect={handlePresetSelect}
      />

      {/* Área Principal 3D (WebGL / Three.js) + KPIs + Card de Telemetria */}
      <main className="flex-1 h-full relative overflow-hidden">
        <KpiAndTelemetryOverlay
          kpis={kpis}
          activeSector={activeSector}
          onCloseSector={() => setSelectedSectorId(null)}
        />

        <TwinScene3D
          sectors={simulated}
          params={params}
          selectedSectorId={selectedSectorId}
          hoveredSectorId={hoveredSectorId}
          onSelectSector={setSelectedSectorId}
          onHoverSector={setHoveredSectorId}
        />

        {/* Barra de Status Cartográfica Inferior Esquerda */}
        <div className="absolute bottom-5 left-5 z-10 flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800/90 text-[11px] font-mono text-slate-400 pointer-events-none">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            CAMPINAS-SP (IBGE 3509502)
          </span>
          <span>|</span>
          <span>SIRGAS 2000 / WGS84</span>
          <span>|</span>
          <span>Corredor BRT Campo Grande (17,9 km · 10 Estações/Terminais)</span>
        </div>
      </main>
    </div>
  );
}

export default App;
