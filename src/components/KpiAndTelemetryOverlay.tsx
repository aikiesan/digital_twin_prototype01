import React from 'react';
import {
  CloudOff,
  Wind,
  Scale,
  X,
  Users,
  Flame,
  ThermometerSnowflake,
  Zap,
  Building2,
  AlertTriangle,
  ArrowRight,
  Workflow,
  Layers,
  Play,
  Database,
} from 'lucide-react';
import { CorridorKPIs, Cp2bNode, ProjectLoadStage, SectorSimulated } from '../types';
import campinasData from '../data/campinasRealData.json';

interface KpiAndTelemetryOverlayProps {
  kpis: CorridorKPIs;
  activeSector: SectorSimulated | null;
  selectedCp2bNode: Cp2bNode | null;
  loadStage: ProjectLoadStage;
  isBuildingAnimation: boolean;
  onSelectLoadStage: (stage: ProjectLoadStage) => void;
  onTriggerBuildAnimation: () => void;
  onCloseSector: () => void;
  onCloseCp2bNode: () => void;
}

export const KpiAndTelemetryOverlay: React.FC<KpiAndTelemetryOverlayProps> = ({
  kpis,
  activeSector,
  selectedCp2bNode,
  loadStage,
  isBuildingAnimation,
  onSelectLoadStage,
  onTriggerBuildAnimation,
  onCloseSector,
  onCloseCp2bNode,
}) => {
  const [showMassBalance, setShowMassBalance] = React.useState(false);
  const [showCp2bMatrix, setShowCp2bMatrix] = React.useState(false);

  const cp2bSummary = (campinasData as unknown as {
    cp2b?: {
      summary: {
        totalPotentialGWhYear: number;
        totalBiomethaneNm3Day: number;
        distanceToTransportPipelineKm: number;
        distanceToDistributionPipelineKm: number;
        streamsGWhYear: Record<string, number>;
        fdeParameters: { code: string; name: string; sector: string; fde: number; bmpNm3TonVS: number }[];
      };
      nodes: Cp2bNode[];
    };
  }).cp2b?.summary;

  const stages: { id: ProjectLoadStage; label: string; sub: string }[] = [
    { id: 1, label: '1. Basemap + DEM 30m', sub: '22S48_ZN.tif + 2.200 Vias/Rios OSM' },
    { id: 2, label: '2. Edifícios 3D OSM + Pessoas', sub: '1.850 Prédios + Censo 2022' },
    { id: 3, label: '3. Rede CP2B Completa', sub: '30 ETEs + 40 Ind. + OneBio/Delta A' },
    { id: 4, label: '4. Simulação V1↔V2↔V3', sub: 'Acoplamento Causal & Visão Explodida' },
  ];

  return (
    <>
      {/* TOPO CENTRAL: Orquestrador de Carregamento das Camadas (Basemap -> Edifícios DEM/OSM -> Rede CP2B -> Simulação) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-slate-700/80 shadow-2xl pointer-events-auto">
        <button
          onClick={onTriggerBuildAnimation}
          disabled={isBuildingAnimation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-mono font-bold text-[11px] transition shadow-md"
          title="Executar sequência de carregamento passo a passo desde o Basemap e DEM até o CP2B"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isBuildingAnimation ? 'Carregando...' : 'Construir Camadas'}</span>
        </button>

        <div className="h-5 w-[1px] bg-slate-800 mx-1" />

        {stages.map((st) => {
          const active = loadStage === st.id;
          const passed = loadStage >= st.id;
          return (
            <button
              key={st.id}
              onClick={() => onSelectLoadStage(st.id)}
              className={`px-2.5 py-1 rounded-xl text-left transition flex flex-col ${
                active
                  ? 'bg-sky-500/25 border border-sky-400 text-sky-200'
                  : passed
                  ? 'bg-slate-900/90 border border-slate-700/70 text-slate-200 hover:bg-slate-800'
                  : 'bg-slate-950/50 border border-slate-800/50 text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="text-[10px] font-mono font-bold leading-tight">{st.label}</span>
              <span className="text-[9px] font-mono text-slate-400 leading-tight">{st.sub}</span>
            </button>
          );
        })}
      </div>

      {/* TOPO ESQUERDO: Botões de Balanço de Massa & Matriz Real CP2B / Docker PostGIS */}
      <div className="absolute top-20 left-4 z-10 flex flex-col gap-2 pointer-events-auto">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowMassBalance((v) => !v);
              setShowCp2bMatrix(false);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-emerald-500/40 text-xs font-mono text-emerald-300 shadow-xl backdrop-blur-xl transition"
          >
            <Workflow className="w-4 h-4 text-emerald-400" />
            <span>Balanço Causal (V1 ↔ V2 ↔ V3)</span>
          </button>

          <button
            onClick={() => {
              setShowCp2bMatrix((v) => !v);
              setShowMassBalance(false);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-sky-500/40 text-xs font-mono text-sky-300 shadow-xl backdrop-blur-xl transition"
          >
            <Database className="w-4 h-4 text-sky-400" />
            <span>Rede CP2B Campinas (526 GWh/ano · 77 Nós)</span>
          </button>
        </div>

        {showMassBalance && (
          <div className="w-[540px] bg-slate-950/95 backdrop-blur-2xl border border-emerald-500/50 rounded-2xl p-4 shadow-2xl text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  Acoplamento Causal Verificável · JP-FAPESP / NIPE-UNICAMP
                </span>
                <h4 className="text-sm font-bold text-slate-100">
                  Balanço Integrado de Massa e Energia (Corredor BRT Campo Grande)
                </h4>
              </div>
              <button
                onClick={() => setShowMassBalance(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 items-stretch">
              <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col justify-between">
                <div className="text-[10px] font-mono text-emerald-300 font-bold uppercase">
                  V2 · Circularidade (CP2B)
                </div>
                <div className="my-1.5 space-y-1 font-mono text-[11px]">
                  <div className="text-slate-200">
                    <strong className="text-emerald-300">{kpis.rsuPodaColetadoTonDia} t/d</strong> RSU + Poda
                  </div>
                  <div className="text-slate-300">
                    → <strong className="text-emerald-400">{kpis.biometanoGeradoCorredorNm3Dia.toLocaleString('pt-BR')} Nm³/d</strong> GNR
                  </div>
                  <div className="text-teal-300 text-[10px]">
                    + {kpis.digestatoBiofertilizanteTonDia} t/d Digestato → Jardins de Chuva
                  </div>
                </div>
                <div className="text-[9px] font-mono text-slate-400 border-t border-slate-800/80 pt-1">
                  FDE · BMP · Ciclo C/N
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 flex flex-col justify-between">
                <div className="text-[10px] font-mono text-amber-300 font-bold uppercase flex items-center justify-between">
                  <span>V1 · Energia & UHI</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </div>
                <div className="my-1.5 space-y-1 font-mono text-[11px]">
                  <div className="text-slate-200">
                    <strong className="text-sky-300">{kpis.onibusAbastecidosUnid}/112</strong> Ônibus BRT GNR
                  </div>
                  <div className="text-slate-300">
                    -<strong className="text-amber-300">{kpis.dieselSubstituidoLitrosDia.toLocaleString('pt-BR')} L/d</strong> Diesel
                  </div>
                  <div className="text-orange-300 text-[10px]">
                    -{kpis.economiaEnergiaMjDia.toLocaleString('pt-BR')} MJ/d · ΔT_s -{kpis.reducaoMediaUhiC}°C
                  </div>
                </div>
                <div className="text-[9px] font-mono text-slate-400 border-t border-slate-800/80 pt-1">
                  Balanço Térmico + Modal Shift
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-fuchsia-950/30 border border-fuchsia-500/30 flex flex-col justify-between">
                <div className="text-[10px] font-mono text-fuchsia-300 font-bold uppercase flex items-center justify-between">
                  <span>V3 · Justiça Climática</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </div>
                <div className="my-1.5 space-y-1 font-mono text-[11px]">
                  <div className="text-slate-200">
                    -<strong className="text-sky-300">{kpis.mp25EvitadoKgAno.toLocaleString('pt-BR')} kg/ano</strong> MP₂.₅
                  </div>
                  <div className="text-slate-300">
                    Exposição Vuln.: <strong className="text-emerald-300">-{kpis.reducaoExposicaoMp25Pct}%</strong>
                  </div>
                  <div className="text-fuchsia-300 text-[10px]">
                    Índice Equidade: <strong>{kpis.indiceJusticaClimatica}/100</strong>
                  </div>
                </div>
                <div className="text-[9px] font-mono text-slate-400 border-t border-slate-800/80 pt-1">
                  Restrição Ativa por Setor IBGE
                </div>
              </div>
            </div>
          </div>
        )}

        {showCp2bMatrix && cp2bSummary && (
          <div className="w-[560px] bg-slate-950/95 backdrop-blur-2xl border border-sky-500/50 rounded-2xl p-4 shadow-2xl text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                  Inventário Oficial CP2B / NIPE-UNICAMP · Campinas (IBGE 3509502)
                </span>
                <h4 className="text-sm font-bold text-slate-100">
                  Potencial Multirresíduos (526,02 GWh/ano · 31.525 Nm³/dia Biometano)
                </h4>
              </div>
              <button
                onClick={() => setShowCp2bMatrix(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 font-mono text-[11px]">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[9px]">RSU ORGÂNICO (FORSU)</div>
                <div className="text-emerald-400 font-bold text-sm">397,92 GWh</div>
                <div className="text-[9px] text-slate-500">25.693 Nm³/d</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[9px]">SILVICULTURA + PODA</div>
                <div className="text-teal-300 font-bold text-sm">41,18 GWh</div>
                <div className="text-[9px] text-slate-500">RPO: 7,98 GWh/ano</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[9px]">ESGOTO (30 ETEs SANASA)</div>
                <div className="text-sky-300 font-bold text-sm">2.372 Nm³/d</div>
                <div className="text-[9px] text-slate-500">Piçarrão + Capivari II</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[9px]">AGRO & PECUÁRIA</div>
                <div className="text-amber-300 font-bold text-sm">86,92 GWh</div>
                <div className="text-[9px] text-slate-500">Cana + Bovinos + Aves</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                Fatores de Disponibilidade Efetiva (FDE) e Potencial Bioquímico de Metano (BMP - CP2B):
              </div>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                {cp2bSummary.fdeParameters.map((p) => (
                  <div key={p.code} className="px-2.5 py-1.5 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-200 truncate pr-2" title={p.name}>{p.code}</span>
                    <span className="text-emerald-400 whitespace-nowrap">
                      FDE {(p.fde * 100).toFixed(1)}% · BMP {p.bmpNm3TonVS}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
              <span>Dist. Gasoduto Comgás: <strong className="text-amber-300">2,7 km</strong></span>
              <span>Dist. GASBOL (TBG): <strong className="text-amber-300">4,6 km</strong></span>
              <span>Subestação: <strong className="text-sky-300">11,0 km</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* TOPO DIREITO: 3 KPIs Agregados do Corredor BRT Campo Grande */}
      <div className="absolute top-20 right-4 z-10 flex flex-col gap-2.5 pointer-events-auto">
        <div className="bg-slate-950/88 backdrop-blur-xl border border-slate-800/90 rounded-xl px-4 py-2.5 shadow-2xl min-w-[235px]">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-0.5">
            <span>BALANÇO LÍQUIDO DE CARBONO</span>
            <CloudOff className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-slate-100">
              {kpis.balancoCarbonoTonAno.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs font-mono text-slate-400">tCO₂eq/ano</span>
          </div>
          <div className="mt-0.5 text-[10px] font-mono text-emerald-400 flex items-center justify-between">
            <span>Mitigado: -{kpis.emissoesEvitadasTonAno.toLocaleString('pt-BR')} t/ano</span>
            <span>-{kpis.reducaoMediaUhiC}°C UHI</span>
          </div>
        </div>

        <div className="bg-slate-950/88 backdrop-blur-xl border border-slate-800/90 rounded-xl px-4 py-2.5 shadow-2xl min-w-[235px]">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-0.5">
            <span>REDUÇÃO EXPOSIÇÃO A MP2.5</span>
            <Wind className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-sky-300">
              -{kpis.reducaoExposicaoMp25Pct}%
            </span>
            <span className="text-xs font-mono text-slate-400">pop. vulnerável</span>
          </div>
          <div className="mt-0.5 text-[10px] font-mono text-slate-400 flex items-center justify-between">
            <span>Biometano Corredor:</span>
            <span className="text-emerald-300">{kpis.biometanoGeradoCorredorNm3Dia.toLocaleString('pt-BR')} Nm³/d</span>
          </div>
        </div>

        <div className="bg-slate-950/88 backdrop-blur-xl border border-slate-800/90 rounded-xl px-4 py-2.5 shadow-2xl min-w-[235px]">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-0.5">
            <span>ÍNDICE JUSTIÇA CLIMÁTICA</span>
            <Scale className="w-3.5 h-3.5 text-fuchsia-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-fuchsia-300">
              {kpis.indiceJusticaClimatica}
            </span>
            <span className="text-xs font-mono text-slate-400">/ 100 pts</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-fuchsia-500 via-sky-400 to-emerald-400 h-full transition-all duration-300"
              style={{ width: `${kpis.indiceJusticaClimatica}%` }}
            />
          </div>
        </div>
      </div>

      {/* INSPETOR DE NÓ DA REDE CP2B SELECIONADO (ETE SANASA, USINA ONEBIO/DELTA A, INDÚSTRIA) */}
      {selectedCp2bNode && (
        <div className="absolute bottom-16 left-5 z-20 w-[420px] bg-slate-950/95 backdrop-blur-xl border border-emerald-500/60 rounded-2xl p-4 shadow-2xl pointer-events-auto">
          <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-2.5">
            <div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300">
                NÓ CP2B · {selectedCp2bNode.category}
              </span>
              <h3 className="text-sm font-bold text-slate-100 mt-1">{selectedCp2bNode.name}</h3>
              <p className="text-[11px] font-mono text-slate-400">
                Coord: {selectedCp2bNode.coordinates[1].toFixed(4)}°, {selectedCp2bNode.coordinates[0].toFixed(4)}° · Cota DEM: {selectedCp2bNode.elevationM}m
              </p>
            </div>
            <button
              onClick={onCloseCp2bNode}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">SUBSTRATO / BIOMASSA (FDE CP2B):</div>
              <div className="text-emerald-300">{selectedCp2bNode.feedstock}</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">PROCESSO TECNOLÓGICO:</div>
              <div className="text-slate-200 text-[11px]">{selectedCp2bNode.treatmentProcess}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
                <div className="text-[9px] text-slate-400">BIOGÁS BRUTO</div>
                <div className="text-emerald-300 font-bold">{selectedCp2bNode.biogasNm3Day.toLocaleString('pt-BR')} Nm³/d</div>
              </div>
              <div className="p-2 rounded-lg bg-sky-950/40 border border-sky-500/30">
                <div className="text-[9px] text-slate-400">BIOMETANO</div>
                <div className="text-sky-300 font-bold">{selectedCp2bNode.biomethaneNm3Day.toLocaleString('pt-BR')} Nm³/d</div>
              </div>
              <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/30">
                <div className="text-[9px] text-slate-400">REMOÇÃO DBO</div>
                <div className="text-amber-300 font-bold">{selectedCp2bNode.dboRemovalPct}%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CARD DE TELEMETRIA INTER-CAMADAS DO SETOR CENSITÁRIO SELECIONADO/HOVER */}
      {activeSector ? (
        <div className="absolute bottom-5 right-5 z-20 w-[410px] bg-slate-950/95 backdrop-blur-xl border border-sky-500/50 rounded-2xl p-4 shadow-2xl pointer-events-auto">
          <div className="flex items-start justify-between border-b border-slate-800 pb-2.5 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-[10px] font-mono font-bold text-sky-300">
                  IBGE {activeSector.cd_setor}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  km {activeSector.km_corredor} do BRT
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-100 mt-1">
                {activeSector.nome_local}
              </h3>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3 h-3 text-slate-400" />
                Distrito: <strong className="text-slate-200">{activeSector.distrito}</strong> · Altitude DEM:{' '}
                <strong className="text-indigo-300">{activeSector.elevacao_m}m</strong> · Pop:{' '}
                <strong className="text-slate-200">{activeSector.populacao} hab</strong>
              </p>
              <div className="mt-1 text-[10px] font-mono text-fuchsia-300 bg-fuchsia-950/40 border border-fuchsia-500/30 px-2 py-0.5 rounded inline-block">
                Perfil: {activeSector.perfil_social}
              </div>
              {activeSector.comunidade_fcu && (
                <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-[10px] font-mono text-rose-300">
                  <AlertTriangle className="w-3 h-3" />
                  Comunidade Urbana IBGE: {activeSector.comunidade_fcu}
                </div>
              )}
            </div>
            <button
              onClick={onCloseSector}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="Fechar telemetria"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-fuchsia-950/25 border border-fuchsia-500/30">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-fuchsia-300 mb-1">
                <span className="flex items-center gap-1 font-bold">
                  <Users className="w-3.5 h-3.5" /> Camada 0 · Quem Mora Onde (Censo 2022)
                </span>
                <span>Justiça: {activeSector.sim_justica_climatica}/100</span>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-300">
                <div>
                  Renda: <strong className="text-emerald-300">R$ {activeSector.renda_media_rs}</strong>
                </div>
                <div>
                  Mulher Resp.: <strong className="text-rose-300">{activeSector.pct_chefia_feminina}%</strong>
                </div>
                <div>
                  Pretos/Pardos: <strong className="text-amber-300">{activeSector.pct_negra_indigena}%</strong>
                </div>
                <div>
                  Verticalização: <strong className="text-indigo-300">{activeSector.pct_verticalizacao}% apt</strong>
                </div>
                <div>
                  Idosos 60+: <strong className="text-slate-200">{activeSector.pct_idosos_60mais}%</strong>
                </div>
                <div>
                  IVSG Sim: <strong className="text-fuchsia-300">{activeSector.sim_vulnerabilidade_ivsg.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-emerald-300 mb-1">
                <span className="flex items-center gap-1 font-bold">
                  <Flame className="w-3.5 h-3.5" /> Camada 1 · Mitigação Verde & Biometano CP2B
                </span>
                <span>+{activeSector.sim_jardins_chuva_m2} m² Jardins Chuva</span>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-300">
                <div>
                  Arborização: <strong className="text-emerald-300">{activeSector.sim_cobertura_arborea_pct}%</strong>
                </div>
                <div>
                  RSU Org: <strong className="text-slate-100">{activeSector.rsu_organico_kg_dia} kg/d</strong>
                </div>
                <div>
                  Biometano: <strong className="text-emerald-300">{activeSector.sim_biometano_nm3_dia} Nm³/d</strong>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-950/25 border border-amber-500/30">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-amber-300 mb-1">
                <span className="flex items-center gap-1 font-bold">
                  <Zap className="w-3.5 h-3.5" /> Camada 2 · Demanda Energética & Ilha de Calor
                </span>
                <span className="flex items-center gap-1 text-sky-300">
                  <ThermometerSnowflake className="w-3 h-3" /> -{activeSector.sim_reducao_uhi_c}°C
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-300">
                <div>
                  Demanda: <strong className="text-amber-300">{activeSector.sim_mj_total_dia} MJ/d</strong>
                </div>
                <div>
                  MP2.5: <strong className="text-rose-300">{activeSector.sim_mp25_ugm3} µg/m³</strong>
                </div>
                <div>
                  Ilha Calor: <strong className="text-orange-300">+{activeSector.sim_delta_uhi_c}°C</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-5 right-5 z-10 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-400 pointer-events-none flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span>Clique em um setor censitário, edifício 3D OSM ou nó CP2B para inspecionar as camadas</span>
        </div>
      )}
    </>
  );
};
