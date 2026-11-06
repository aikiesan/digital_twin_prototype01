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
} from 'lucide-react';
import { CorridorKPIs, SectorSimulated } from '../types';

interface KpiAndTelemetryOverlayProps {
  kpis: CorridorKPIs;
  activeSector: SectorSimulated | null;
  onCloseSector: () => void;
}

export const KpiAndTelemetryOverlay: React.FC<KpiAndTelemetryOverlayProps> = ({
  kpis,
  activeSector,
  onCloseSector,
}) => {
  const [showMassBalance, setShowMassBalance] = React.useState(false);

  return (
    <>
      {/* TOPO ESQUERDO: Botão de Balanço Explícito de Massa & Energia (V1 <-> V2 <-> V3) */}
      <div className="absolute top-4 left-4 z-10 pointer-events-auto">
        <button
          onClick={() => setShowMassBalance((v) => !v)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-emerald-500/40 text-xs font-mono text-emerald-300 shadow-xl backdrop-blur-xl transition"
        >
          <Workflow className="w-4 h-4 text-emerald-400" />
          <span>{showMassBalance ? 'Ocultar' : 'Ver'} Balanço de Massa & Energia (V1 ↔ V2 ↔ V3)</span>
        </button>

        {showMassBalance && (
          <div className="mt-2 w-[540px] bg-slate-950/95 backdrop-blur-2xl border border-emerald-500/50 rounded-2xl p-4 shadow-2xl text-xs space-y-3">
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

            {/* Fluxograma Causal em Tempo Real */}
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
                  Y_CH4 · η_upgrade · Ciclo C/N
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

            {/* Equação Síntese do Acoplamento */}
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 font-mono text-[10px] text-slate-300 space-y-1">
              <div className="text-sky-300 font-semibold">
                Equações de Estado Acopladas por Setor Censitário (i = 1..35):
              </div>
              <div>
                1) <span className="text-emerald-300">V₂(i)</span>: Q_CH4(i) = [M_RSU(i)·BMP_rsu + M_poda(i, A_verde)·BMP_poda] · η_purif
              </div>
              <div>
                2) <span className="text-amber-300">V₁(i)</span>: E_tot(i) = E_transp(i)·(1 - α_modal·φ_i) + E_cool(i)·[1 - β_uhi·ΔT_s(A_verde, Digestato)]
              </div>
              <div>
                3) <span className="text-fuchsia-300">V₃(i)</span>: min ∑ IVSG(i) · [C_MP2.5(E_tot, Q_CH4) + ΔT_s(i)] s.a. Equidade Territorial ≥ τ
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TOPO DIREITO: 3 KPIs Agregados do Corredor BRT Campo Grande */}
      <div className="absolute top-4 right-4 z-10 flex flex-wrap gap-3 max-w-4xl justify-end pointer-events-auto">
        {/* KPI 1: Balanço Líquido de Carbono */}
        <div className="bg-slate-950/85 backdrop-blur-xl border border-slate-800/90 rounded-xl px-4 py-3 shadow-2xl min-w-[235px]">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span>BALANÇO LÍQUIDO DE CARBONO</span>
            <CloudOff className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-100">
              {kpis.balancoCarbonoTonAno.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs font-mono text-slate-400">tCO₂eq/ano</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-emerald-400 flex items-center justify-between">
            <span>Mitigado: -{kpis.emissoesEvitadasTonAno.toLocaleString('pt-BR')} t/ano</span>
            <span>-{kpis.reducaoMediaUhiC}°C UHI</span>
          </div>
        </div>

        {/* KPI 2: Redução de Exposição de População Vulnerável a MP2.5 */}
        <div className="bg-slate-950/85 backdrop-blur-xl border border-slate-800/90 rounded-xl px-4 py-3 shadow-2xl min-w-[235px]">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span>REDUÇÃO EXPOSIÇÃO A MP2.5</span>
            <Wind className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-sky-300">
              -{kpis.reducaoExposicaoMp25Pct}%
            </span>
            <span className="text-xs font-mono text-slate-400">pop. vulnerável</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>Biometano Corredor:</span>
            <span className="text-emerald-300">{kpis.biometanoGeradoCorredorNm3Dia.toLocaleString('pt-BR')} Nm³/d</span>
          </div>
        </div>

        {/* KPI 3: Índice de Justiça Energética-Climática */}
        <div className="bg-slate-950/85 backdrop-blur-xl border border-slate-800/90 rounded-xl px-4 py-3 shadow-2xl min-w-[235px]">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span>ÍNDICE JUSTIÇA CLIMÁTICA</span>
            <Scale className="w-4 h-4 text-fuchsia-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-fuchsia-300">
              {kpis.indiceJusticaClimatica}
            </span>
            <span className="text-xs font-mono text-slate-400">/ 100 pts</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-fuchsia-500 via-sky-400 to-emerald-400 h-full transition-all duration-300"
              style={{ width: `${kpis.indiceJusticaClimatica}%` }}
            />
          </div>
        </div>
      </div>

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
                Distrito: <strong className="text-slate-200">{activeSector.distrito}</strong> · Altitude:{' '}
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

          {/* Dados simultâneos das 3 Camadas conectadas pelo cilindro vertical */}
          <div className="space-y-2.5 text-xs">
            {/* Camada 0: Quem Mora Onde em Campinas (Demografia & Tecido Urbano) */}
            <div className="p-2.5 rounded-xl bg-fuchsia-950/25 border border-fuchsia-500/30">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-fuchsia-300 mb-1">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Camada 0 · Quem Mora Onde (Censo 2022)
                </span>
                <span>IVSG: {activeSector.sim_vulnerabilidade_ivsg.toFixed(2)} · Apt: {activeSector.pct_verticalizacao}%</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 mt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block">Renda Média</span>
                  <span className="font-mono font-semibold text-slate-100">
                    R$ {activeSector.renda_media_rs.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Chefia Fem.</span>
                  <span className="font-mono font-semibold text-fuchsia-300">
                    {activeSector.pct_chefia_feminina}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Preta/Parda</span>
                  <span className="font-mono font-semibold text-amber-200">
                    {activeSector.pct_negra_indigena}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">0–14 / 60+</span>
                  <span className="font-mono font-semibold text-sky-200">
                    {activeSector.pct_jovens_0a14}% / {activeSector.pct_idosos_60mais}%
                  </span>
                </div>
              </div>
            </div>

            {/* Camada 1: Mitigação Verde & Circularidade CP2B */}
            <div className="p-2.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-emerald-300 mb-1">
                <span className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" /> Camada 1 · Mitigação Verde & Biometano CP2B
                </span>
                <span>RSU Org: {activeSector.rsu_organico_kg_dia} kg/d</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block">Potencial Biometano</span>
                  <span className="font-mono font-semibold text-emerald-300">
                    {activeSector.sim_biometano_nm3_dia} Nm³/d
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Cobertura Arbórea</span>
                  <span className="font-mono font-semibold text-teal-300">
                    {activeSector.sim_cobertura_arborea_pct}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Jardins de Chuva</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {activeSector.sim_jardins_chuva_m2.toLocaleString('pt-BR')} m²
                  </span>
                </div>
              </div>
            </div>

            {/* Camada 2: Demanda Energética Induzida e Ilha de Calor */}
            <div className="p-2.5 rounded-xl bg-amber-950/25 border border-amber-500/30">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-amber-300 mb-1">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> Camada 2 · Energia Induzida & Ilha de Calor
                </span>
                <span className="flex items-center gap-1 text-sky-300">
                  <ThermometerSnowflake className="w-3 h-3" />
                  -{activeSector.sim_reducao_uhi_c}°C
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block">MJ Transporte</span>
                  <span className="font-mono font-semibold text-amber-300">
                    {activeSector.sim_mj_transporte_dia.toLocaleString('pt-BR')} MJ/d
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Delta Ilha Calor</span>
                  <span className="font-mono font-semibold text-orange-300">
                    +{activeSector.sim_delta_uhi_c}°C
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Exposição MP2.5</span>
                  <span className="font-mono font-semibold text-rose-300">
                    {activeSector.sim_mp25_ugm3} µg/m³
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-5 right-5 z-10 bg-slate-950/85 backdrop-blur-md border border-slate-800 px-4 py-2.5 rounded-xl text-xs font-mono text-slate-300 shadow-lg pointer-events-none">
          Passe o mouse ou clique em qualquer <span className="text-sky-400 font-semibold">Setor Censitário de Campinas</span> em qualquer camada para inspecionar a telemetria vertical nas 3 dimensões.
        </div>
      )}
    </>
  );
};
