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
  Mountain,
  Users,
  Sun,
  Moon,
} from 'lucide-react';
import { SimulationParams, PeopleSocialLens } from '../types';
import campinasData from '../data/campinasRealData.json';

interface SimulationSidebarProps {
  params: SimulationParams;
  onChange: (newParams: SimulationParams) => void;
  onPresetSelect: (preset: 'baseline' | 'cp2b_2030' | 'net_zero_justica') => void;
}

const PEOPLE_LENSES: { id: PeopleSocialLens; label: string; desc: string }[] = [
  {
    id: 'vulnerabilidade',
    label: 'Índice IVSG (Síntese)',
    desc: 'Vulnerabilidade Socioambiental & Gênero combinada (Censo 2022)',
  },
  {
    id: 'renda',
    label: 'Renda Familiar (R$)',
    desc: 'Contraste Centro/Aurélia (R$ 6.3k) vs. Periferia Campo Grande (R$ 1.6k)',
  },
  {
    id: 'chefia_feminina',
    label: 'Mulheres Chefes (%)',
    desc: 'Domicílios com responsável mulher (média Campinas: 49,4%, até 61% nas FCUs)',
  },
  {
    id: 'raca_cor',
    label: 'Cor ou Raça (% PPI)',
    desc: 'População Preta, Parda e Indígena por setor censitário (IBGE 2022)',
  },
  {
    id: 'verticalizacao',
    label: 'Tipologia Edilícia (%)',
    desc: 'Verticalização (Torres de Apartamentos vs. Casas Horizontais)',
  },
];

export const SimulationSidebar: React.FC<SimulationSidebarProps> = ({
  params,
  onChange,
  onPresetSelect,
}) => {
  const updateParam = <K extends keyof SimulationParams>(key: K, val: SimulationParams[K]) => {
    onChange({ ...params, [key]: val });
  };

  const isDaylight = params.visualStyle === 'editorial_daylight';

  return (
    <aside className="w-[395px] h-full bg-slate-950/95 backdrop-blur-xl border-r border-slate-800/80 flex flex-col z-20 select-none overflow-y-auto">
      {/* Cabeçalho Institucional + Seletor de Estilo Arquitetônico (Maquete Diurna vs. Noturna) */}
      <div className="p-4 border-b border-slate-800/80 bg-gradient-to-br from-slate-900/90 via-slate-950 to-emerald-950/20">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <Database className="w-3 h-3" />
            NIPE / UNICAMP · CP2B · CENSO 2022
          </span>

          <button
            onClick={() =>
              updateParam(
                'visualStyle',
                isDaylight ? 'scientific_night' : 'editorial_daylight'
              )
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition"
            title="Alternar entre Estilo Maquete Arquitetônica Clara e Modo Científico Escuro"
          >
            {isDaylight ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Maquete Clara
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-sky-400" />
                Noturno Lab
              </>
            )}
          </button>
        </div>

        <h1 className="text-base font-bold text-slate-100 tracking-tight leading-snug">
          Gêmeo Digital Urbano-Energético 3D
        </h1>
        <p className="text-xs text-sky-300/90 font-medium mt-0.5 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-sky-400" />
          Corredor BRT Campo Grande · Campinas-SP (IBGE 3509502)
        </p>
      </div>

      {/* SEÇÃO 1: LENTE HUMANA ("QUEM MORA ONDE EM CAMPINAS" - CENSO 2022) */}
      <div className="p-3.5 border-b border-slate-800/80 bg-fuchsia-950/15">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-fuchsia-300 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-fuchsia-400" />
            Camada Humana: Quem Mora Onde em Campinas
          </span>
          <span className="text-[10px] font-mono text-slate-400">Nível 0</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {PEOPLE_LENSES.map((lens) => {
            const active = params.peopleLens === lens.id;
            return (
              <button
                key={lens.id}
                onClick={() => updateParam('peopleLens', lens.id)}
                className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-medium transition border ${
                  active
                    ? 'bg-fuchsia-600/30 border-fuchsia-400 text-white shadow-sm'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/70'
                } ${lens.id === 'vulnerabilidade' ? 'col-span-2' : ''}`}
              >
                <div className="font-semibold leading-tight">{lens.label}</div>
                {active && (
                  <div className="text-[10px] text-fuchsia-200/90 mt-0.5 leading-snug">
                    {lens.desc}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Presets Rápidos de Cenário */}
      <div className="px-4 py-2.5 border-b border-slate-800/80 bg-slate-900/40">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
          <span>Cenários do Modelo Substituto</span>
          <Sparkles className="w-3 h-3 text-amber-400" />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onPresetSelect('baseline')}
            className="px-2 py-1.5 rounded-lg text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/70 transition flex items-center justify-center gap-1"
          >
            <RotateCcw className="w-3 h-3 text-slate-400" />
            Baseline
          </button>
          <button
            onClick={() => onPresetSelect('cp2b_2030')}
            className="px-2 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-200 border border-emerald-600/40 transition"
          >
            Meta CP2B 2030
          </button>
          <button
            onClick={() => onPresetSelect('net_zero_justica')}
            className="px-2 py-1.5 rounded-lg text-[11px] font-medium bg-sky-950/60 hover:bg-sky-900/70 text-sky-200 border border-sky-500/40 transition"
          >
            100% Circular
          </button>
        </div>
      </div>

      {/* Sliders de Simulação e Relevo 3D */}
      <div className="p-3.5 space-y-3 flex-1">
        {/* Slider 1: Explodir Camadas Anatômicas (Z-Spread) */}
        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/90">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              1. Explodir Camadas SVG (Z-Spread)
            </label>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
              {params.zSpread}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={params.zSpread}
            onChange={(e) => updateParam('zSpread', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
            <span>0% (Integrado no Relevo)</span>
            <span>100% (3 Planos Explodidos)</span>
          </div>
        </div>

        {/* Novo Controle: Exagero Vertical do Relevo 3D de Campinas (TOPODATA SRTM 30m) */}
        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/90">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Mountain className="w-3.5 h-3.5 text-indigo-400" />
              Relevo 3D Campinas (SRTM 30m · 552m–771m)
            </label>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
              {params.terrainExaggeration}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={params.terrainExaggeration}
            onChange={(e) => updateParam('terrainExaggeration', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
            <span>Plano (0x)</span>
            <span>Vale Rio Capivari → Espigão Central</span>
          </div>
        </div>

        {/* Slider 2: Frota BRT a Biometano */}
        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/90">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-emerald-400" />
              2. Frota BRT a Biometano (CP2B)
            </label>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              {params.biomethaneFleet}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={params.biomethaneFleet}
            onChange={(e) => updateParam('biomethaneFleet', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />
        </div>

        {/* Slider 3: Infraestrutura Verde */}
        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/90">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Trees className="w-3.5 h-3.5 text-teal-400" />
              3. Infraestrutura Verde & Jardins Chuva
            </label>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300">
              {params.greenInfra}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={params.greenInfra}
            onChange={(e) => updateParam('greenInfra', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
          />
        </div>

        {/* Slider 4: Transferência Modal */}
        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/90">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Bus className="w-3.5 h-3.5 text-amber-400" />
              4. Transferência Modal (Carro → BRT)
            </label>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
              {params.modalShift}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={params.modalShift}
            onChange={(e) => updateParam('modalShift', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
        </div>
      </div>

      {/* Rodapé com Retrato Demográfico Municipal de Campinas */}
      <div className="p-3.5 border-t border-slate-800/80 bg-slate-900/60 space-y-1.5 text-[11px]">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
          Síntese Censo 2022 · Campinas ({campinasData.municipio.populacao_censo_2022.toLocaleString('pt-BR')} hab)
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-400">Chefia Feminina:</span>
            <span className="font-mono text-fuchsia-300">{campinasData.municipio.pct_chefia_feminina_municipal}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Apartamentos:</span>
            <span className="font-mono text-sky-300">{campinasData.municipio.pct_apartamentos_municipal}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Pretos/Pardos:</span>
            <span className="font-mono text-amber-300">{campinasData.municipio.pct_pretos_pardos_municipal}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Altitude Corredor:</span>
            <span className="font-mono text-indigo-300">605m–689m</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
