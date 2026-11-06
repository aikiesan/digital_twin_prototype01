import React, { useMemo, useState, useEffect } from 'react';
import campinasData from './data/campinasRealData.json';
import { Cp2bNode, ProjectLoadStage, SectorRaw, SimulationParams } from './types';
import { simulateSectors } from './simulationEngine';
import { SimulationSidebar } from './components/SimulationSidebar';
import { TwinScene3D } from './components/TwinScene3D';
import { KpiAndTelemetryOverlay } from './components/KpiAndTelemetryOverlay';

export function App() {
  const [params, setParams] = useState<SimulationParams>({
    zSpread: 30,             // Camadas integradas sobre o Basemap + DEM + 1.850 edifícios 3D OSM
    biomethaneFleet: 55,     // 55% da frota BRT convertida a Biometano CP2B
    greenInfra: 45,          // 45% de expansão de Jardins de Chuva e Arborização
    modalShift: 40,          // 40% de transferência modal Carro -> BRT Campo Grande
    terrainExaggeration: 70, // Relevo 3D real de Campinas (SRTM 30m: 547,5m a 789,2m)
    peopleLens: 'renda',     // Lente Humana ("Quem mora onde em Campinas")
    visualStyle: 'editorial_daylight', // Estilo Maquete Arquitetônica Branca (como nas 2 imagens de referência)
    loadStage: 4,            // 1: Basemap+DEM, 2: Edifícios OSM+Censo, 3: Rede CP2B, 4: Acoplamento Total
  });

  const [selectedSectorId, setSelectedSectorId] = useState<number | null>(18);
  const [hoveredSectorId, setHoveredSectorId] = useState<number | null>(null);
  const [selectedCp2bNode, setSelectedCp2bNode] = useState<Cp2bNode | null>(null);
  const [isBuildingAnimation, setIsBuildingAnimation] = useState<boolean>(false);

  const rawSectors = campinasData.setores as unknown as SectorRaw[];

  const { simulated, kpis } = useMemo(
    () => simulateSectors(rawSectors, params),
    [rawSectors, params]
  );

  const activeSector = useMemo(() => {
    const targetId = hoveredSectorId ?? selectedSectorId;
    return simulated.find((s) => s.id === targetId) || null;
  }, [simulated, hoveredSectorId, selectedSectorId]);

  const handleSelectLoadStage = (stage: ProjectLoadStage) => {
    setIsBuildingAnimation(false);
    setParams((p) => ({ ...p, loadStage: stage }));
  };

  const handleTriggerBuildAnimation = () => {
    setIsBuildingAnimation(true);
    setParams((p) => ({ ...p, loadStage: 1, zSpread: 0 }));
  };

  useEffect(() => {
    if (!isBuildingAnimation) return;
    const currentStage = params.loadStage ?? 1;
    if (currentStage < 4) {
      const timer = setTimeout(() => {
        const nextStage = (currentStage + 1) as ProjectLoadStage;
        setParams((p) => ({
          ...p,
          loadStage: nextStage,
          zSpread: nextStage === 4 ? 40 : 0,
        }));
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setIsBuildingAnimation(false);
    }
  }, [isBuildingAnimation, params.loadStage]);

  const handlePresetSelect = (preset: 'baseline' | 'cp2b_2030' | 'net_zero_justica') => {
    if (preset === 'baseline') {
      setParams((p) => ({
        ...p,
        loadStage: 4,
        biomethaneFleet: 0,
        greenInfra: 0,
        modalShift: 0,
      }));
    } else if (preset === 'cp2b_2030') {
      setParams((p) => ({
        ...p,
        loadStage: 4,
        zSpread: Math.max(p.zSpread, 55),
        biomethaneFleet: 65,
        greenInfra: 60,
        modalShift: 55,
      }));
    } else {
      setParams((p) => ({
        ...p,
        loadStage: 4,
        zSpread: 80,
        biomethaneFleet: 100,
        greenInfra: 100,
        modalShift: 85,
      }));
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden flex bg-slate-950 text-slate-100">
      <SimulationSidebar
        params={params}
        onChange={setParams}
        onPresetSelect={handlePresetSelect}
      />

      <main className="flex-1 h-full relative overflow-hidden">
        <KpiAndTelemetryOverlay
          kpis={kpis}
          activeSector={activeSector}
          selectedCp2bNode={selectedCp2bNode}
          loadStage={params.loadStage ?? 4}
          isBuildingAnimation={isBuildingAnimation}
          onSelectLoadStage={handleSelectLoadStage}
          onTriggerBuildAnimation={handleTriggerBuildAnimation}
          onCloseSector={() => setSelectedSectorId(null)}
          onCloseCp2bNode={() => setSelectedCp2bNode(null)}
        />

        <TwinScene3D
          sectors={simulated}
          params={params}
          selectedSectorId={selectedSectorId}
          hoveredSectorId={hoveredSectorId}
          selectedCp2bNode={selectedCp2bNode}
          onSelectSector={setSelectedSectorId}
          onHoverSector={setHoveredSectorId}
          onSelectCp2bNode={setSelectedCp2bNode}
        />

        {/* Barra de Status Cartográfica & Docker Stack Inferior Esquerda */}
        <div className="absolute bottom-5 left-5 z-10 flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-950/88 backdrop-blur-md border border-slate-800/90 text-[11px] font-mono text-slate-400 pointer-events-none">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            CAMPINAS-SP (IBGE 3509502)
          </span>
          <span>|</span>
          <span>DEM SRTM 30m (547m–789m)</span>
          <span>|</span>
          <span>1.850 Edifícios 3D OSM</span>
          <span>|</span>
          <span className="text-sky-300">CP2B: 30 ETEs + 40 Indústrias + OneBio/Delta A</span>
        </div>
      </main>
    </div>
  );
}

export default App;
