import React from 'react';
import {
  Layers,
  Flame,
  Trees,
  Bus,
  RotateCcw,
  Sparkles,
  Database,
  MapPin,
} from 'lucide-react';
import { SimulationParams } from '../types';
import campinasData from '../data/campinasRealData.json';

interface SimulationSidebarProps {
  params: SimulationParams;
  onChange: (newParams: SimulationParams) => void;
  onPresetSelect: (preset: 'baseline' | 'cp2b_2030' | 'net_zero_justica') => void;
}

export const SimulationSidebar: React.FC<SimulationSidebarProps> = ({
  params,
  onChange,
  onPresetSelect,
}) => {
  const updateParam = (key: keyof SimulationParams, val: number) => {
    onChange({ ...params, [key]: val });
  };

  return (
    <aside className="w-[380px] h-full bg-slate-950/90 backdrop-blur-xl border-r border-slate-800/80 flex flex-col z-20 select-none overflow-y-auto">
      {/* Cabeçalho Institucional e Científico */}
      <div className="p-4 border-b border-slate-800/80 bg-gradient-to-br from-slate-900/90 via-slate-950 to-emerald-950/20">
        <div className="flex items-center justify-between mb-1.5">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <Database className="w-3 h-3" />
            NIPE / UNICAMP · CP2B · CENSO 2022
          </span>
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-sky-400" />
            IBGE 3509502
          </span>
        </div>

        <h1 className="text-base font-bold text-slate-100 tracking-tight leading-snug">
          Gêmeo Digital Urbano-Energético
        </h1>
        <p className="text-xs text-sky-300/90 font-medium mt-0.5">
          Corredor BRT Campo Grande · Cidade de Campinas-SP
        </p>
        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
          35 setores censitários reais ao longo da Av. John Boyd Dunlop (do Terminal Mercado/Centro ao Terminal Itajaí/Campo Grande).
        </p>
      </div>

      {/* Presets Rápidos de Cenário */}
      <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/40">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
          <span>Cenários Científicos (Surrogate Model)</span>
          <Sparkles className="w-3 h-3 text-amber-400" />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onPresetSelect('baseline')}
            className="px-2 py-1.5 rounded-lg text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/70 transition flex items-center justify-center gap-1"
            title="Cenário Base Atual (Diesel + Baixa Arborização)"
          >
            <RotateCcw className="w-3 h-3 text-slate-400" />
            Baseline
          </button>
          <button
            onClick={() => onPresetSelect('cp2b_2030')}
            className="px-2 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-200 border border-emerald-600/40 transition"
            title="Meta intermediária CP2B 2030"
          >
            Meta CP2B 2030
          </button>
          <button
            onClick={() => onPresetSelect('net_zero_justica')}
            className="px-2 py-1.5 rounded-lg text-[11px] font-medium bg-sky-950/60 hover:bg-sky-900/70 text-sky-200 border border-sky-500/40 transition"
            title="Descarbonização Total + Justiça Climática"
          >
            100% Circular
          </button>
        </div>
      </div>

      {/* Os 4 Sliders em Tempo Real do Surrogate Model */}
      <div className="p-4 space-y-4 flex-1">
        {/* Slider 1: Explodir Camadas Anatômicas (Z-Spread) */}
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/90 hover:border-sky-500/40 transition">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-400" />
              1. Explodir Camadas (Z-Spread)
            </label>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
              {params.zSpread}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mb-2.5 leading-snug">
            Separa verticalmente o território de Campinas nas 3 dimensões científicas conectadas por guias verticais.
          </p>
          <input
            type="range"
            min={0}
            max={100}
            value={params.zSpread}
            onChange={(e) => updateParam('zSpread', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
            <span>0% (Acoplado no Solo)</span>
            <span>100% (Anatomia 3D)</span>
          </div>
        </div>

        {/* Slider 2: Frota BRT a Biometano (Substituição do Diesel) */}
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/90 hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-emerald-400" />
              2. Frota BRT a Biometano (CP2B)
            </label>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {params.biomethaneFleet}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mb-2.5 leading-snug">
            Substitui o diesel nos 112 articulados do BRT usando biometano urbano de Campinas (RSU Delta A + ETE Capivari II).
          </p>
          <input
            type="range"
            min={0}
            max={100}
            value={params.biomethaneFleet}
            onChange={(e) => updateParam('biomethaneFleet', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
            <span>0% (100% Diesel)</span>
            <span>100% (GNR Biometano)</span>
          </div>
        </div>

        {/* Slider 3: Infraestrutura Verde (Jardins de Chuva e Arborização) */}
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/90 hover:border-teal-500/40 transition">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Trees className="w-4 h-4 text-teal-400" />
              3. Infraestrutura Verde & APPs
            </label>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
              {params.greenInfra}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mb-2.5 leading-snug">
            Expande jardins de chuva e arborização viária; reduz Ilha de Calor em até -3.5°C e kWh de resfriamento (Camada 2).
          </p>
          <input
            type="range"
            min={0}
            max={100}
            value={params.greenInfra}
            onChange={(e) => updateParam('greenInfra', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
            <span>Atual (9.2% Florestal)</span>
            <span>+Jardins de Chuva (-3.5°C)</span>
          </div>
        </div>

        {/* Slider 4: Transferência Modal (Carro Individual -> BRT) */}
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/90 hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Bus className="w-4 h-4 text-amber-400" />
              4. Transferência Modal (Carro → BRT)
            </label>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {params.modalShift}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mb-2.5 leading-snug">
            Migração de viagens pendulares em automóvel para o corredor BRT Campo Grande, contraindo os prismas de MJ/dia.
          </p>
          <input
            type="range"
            min={0}
            max={100}
            value={params.modalShift}
            onChange={(e) => updateParam('modalShift', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
            <span>0% (Matriz Atual)</span>
            <span>100% (Alta Adesão BRT)</span>
          </div>
        </div>
      </div>

      {/* Rodapé com Legenda Anatômica e Dados Municipais Reais de Campinas */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 space-y-2.5">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
          Anatomia das 3 Camadas & Base Real Campinas
        </div>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-amber-400 to-red-500 inline-block" />
              Nível 2: Demanda MJ + MP2.5
            </span>
            <span className="font-mono text-slate-400">Barras Extrudadas</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
              Nível 1: Biometano CP2B & Verde
            </span>
            <span className="font-mono text-emerald-400">
              {campinasData.municipio.potencial_biometano_total_nm3_dia.toLocaleString('pt-BR')} Nm³/d
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-blue-700 via-purple-600 to-rose-500 inline-block" />
              Nível 0: Vulnerabilidade (IVSG)
            </span>
            <span className="font-mono text-fuchsia-300">
              {campinasData.municipio.pct_chefia_feminina_municipal}% Chefia Fem.
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
