import { SectorRaw, SectorSimulated, SimulationParams, CorridorKPIs } from './types';

// Centro de referência do Corredor BRT Campo Grande em Campinas (Av. John Boyd Dunlop)
const LON_CENTER = -47.1300;
const LAT_CENTER = -22.9310;
const SCALE = 185; // Escala de graus WGS84/SIRGAS2000 para unidades métricas da cena Three.js

export function projectCoord(lon: number, lat: number): [number, number] {
  const x = (lon - LON_CENTER) * SCALE * Math.cos((LAT_CENTER * Math.PI) / 180);
  const z = -(lat - LAT_CENTER) * SCALE; // Norte para -Z no Three.js
  return [x, z];
}

export function simulateSectors(
  sectors: SectorRaw[],
  params: SimulationParams
): { simulated: SectorSimulated[]; kpis: CorridorKPIs } {
  const bio = params.biomethaneFleet / 100;
  const green = params.greenInfra / 100;
  const modal = params.modalShift / 100;

  let totalCo2Base = 0;
  let totalCo2Sim = 0;
  let totalBioCarbonCredit = 0;
  let weightedMp25Base = 0;
  let weightedMp25Sim = 0;
  let totalVulnWeight = 0;
  let sumJustica = 0;
  let totalBiometanoDia = 0;
  let sumReducaoUhi = 0;
  let totalMjBase = 0;
  let totalMjSim = 0;
  let totalRsuPodaKgDia = 0;

  const simulated: SectorSimulated[] = sectors.map((s) => {
    // 1. Efeito da Infraestrutura Verde (Jardins de Chuva e Arborização Urbana)
    // Reduz a Ilha de Calor Superficial em até -3.5°C (maior efeito nos setores mais vulneráveis e menos arborizados)
    const deficitArboreo = Math.max(0.2, 1 - s.cobertura_arborea_pct / 40);
    const reducaoUhi = Number((green * 3.5 * (0.72 + 0.28 * deficitArboreo)).toFixed(2));
    const simDeltaUhi = Number(Math.max(0.4, s.delta_uhi_c - reducaoUhi).toFixed(2));
    const simCoberturaArborea = Number(Math.min(55, s.cobertura_arborea_pct + green * 24 * deficitArboreo).toFixed(1));
    const simJardinsChuvaM2 = Math.round(s.area_km2 * 1_000_000 * 0.018 * (0.15 + green * 0.85));

    // 2. Efeito na Demanda Energética (Vetor 1)
    // Transferência Modal (Carro -> BRT) reduz drasticamente MJ/dia, especialmente na periferia e meio do corredor
    const perifFactor = 0.55 + 0.45 * s.norm_pos;
    const reducaoModalPct = modal * 0.62 * perifFactor;
    const simMjTransporte = Math.round(s.mj_transporte_dia * (1 - reducaoModalPct));

    // Encolhimento da demanda elétrica de resfriamento pela mitigação da Ilha de Calor (-3.5°C)
    const uhiRatio = simDeltaUhi / Math.max(0.5, s.delta_uhi_c);
    const simKwhResfriamento = Math.round(s.kwh_resfriamento_dia * (0.28 + 0.72 * uhiRatio));
    const simMjTotal = Math.round(simMjTransporte + simKwhResfriamento * 3.6);

    // 3. Efeito no Ecossistema de Biogás/Biometano CP2B (Vetor 2)
    // A coleta seletiva orgânica (RSU) + poda urbana das novas árvores amplia a produção de biometano
    const simBiometanoNm3Dia = Number(
      (s.biometano_nm3_dia * (0.35 + 0.65 * bio + 0.28 * green)).toFixed(1)
    );

    // 4. Emissões atmosféricas locais (MP2.5 e CO2eq)
    // Frota BRT a Biometano substitui diesel pesado (-85% MP2.5 do corredor), modal shift tira carros, árvores filtram particulados
    const reducaoMp25Factor = Math.min(0.78, bio * 0.42 + modal * 0.24 + green * 0.14);
    const simMp25 = Number((s.mp25_ugm3 * (1 - reducaoMp25Factor)).toFixed(1));

    const simCo2TonAno = Math.round(
      s.co2eq_ton_ano * (1 - modal * 0.44 - bio * 0.31 - green * 0.12)
    );
    const bioOffsetTonAno = (simBiometanoNm3Dia * 365 * 1.96) / 1000 + simCoberturaArborea * s.area_km2 * 4.5;

    // 5. Vulnerabilidade Socioambiental e Índice de Justiça Energética-Climática (Vetor 3)
    const alivioAmbiental = bio * 0.28 + green * 0.38 + modal * 0.34;
    const simVulnerabilidade = Number(
      Math.max(0.08, s.vulnerabilidade_ivsg * (1 - alivioAmbiental * 0.52)).toFixed(3)
    );
    const simJustica = Math.min(
      98,
      Math.round((1 - simVulnerabilidade) * 65 + alivioAmbiental * 38)
    );

    // Acumuladores para KPIs do Corredor
    totalCo2Base += s.co2eq_ton_ano;
    totalCo2Sim += simCo2TonAno;
    totalBioCarbonCredit += bioOffsetTonAno;

    const vulnPopWeight = s.populacao * (0.5 + s.vulnerabilidade_ivsg);
    weightedMp25Base += s.mp25_ugm3 * vulnPopWeight;
    weightedMp25Sim += simMp25 * vulnPopWeight;
    totalVulnWeight += vulnPopWeight;

    sumJustica += simJustica;
    totalBiometanoDia += simBiometanoNm3Dia;
    sumReducaoUhi += reducaoUhi;
    totalMjBase += s.mj_total_dia;
    totalMjSim += simMjTotal;
    totalRsuPodaKgDia += s.rsu_organico_kg_dia * (0.4 + 0.6 * bio) + simCoberturaArborea * 4.2;

    return {
      ...s,
      sim_vulnerabilidade_ivsg: simVulnerabilidade,
      sim_justica_climatica: simJustica,
      sim_cobertura_arborea_pct: simCoberturaArborea,
      sim_delta_uhi_c: simDeltaUhi,
      sim_reducao_uhi_c: reducaoUhi,
      sim_mj_transporte_dia: simMjTransporte,
      sim_kwh_resfriamento_dia: simKwhResfriamento,
      sim_mj_total_dia: simMjTotal,
      sim_mp25_ugm3: simMp25,
      sim_co2eq_ton_ano: simCo2TonAno,
      sim_biometano_nm3_dia: simBiometanoNm3Dia,
      sim_jardins_chuva_m2: simJardinsChuvaM2,
    };
  });

  const balancoLiquido = Math.round(totalCo2Sim - totalBioCarbonCredit);
  const emissoesEvitadas = Math.round(totalCo2Base - balancoLiquido);
  const reducaoMp25Pct = Number(
    (((weightedMp25Base - weightedMp25Sim) / Math.max(1, weightedMp25Base)) * 100).toFixed(1)
  );

  // Balanço de Massa e Energia Explícito (Acoplamento Causal V2 -> V1 -> V3)
  const rsuPodaTonDia = Number((totalRsuPodaKgDia / 1000).toFixed(1));
  const digestatoTonDia = Number((rsuPodaTonDia * 0.68).toFixed(1)); // Rendimento mássico de digestato/composto estabilizado
  const onibusAbastecidos = Math.round((params.biomethaneFleet / 100) * 112); // Frota de 112 articulados no Corredor Campo Grande
  const dieselSubstituidoL = Math.round(onibusAbastecidos * 142 + (totalMjBase - totalMjSim) * 0.018); // ~142 L eq/dia por articulado + modal shift
  const mp25EvitadoKgAno = Math.round((dieselSubstituidoL * 365 * 0.024) + (params.greenInfra * 4.8));

  return {
    simulated,
    kpis: {
      balancoCarbonoTonAno: balancoLiquido,
      emissoesEvitadasTonAno: emissoesEvitadas,
      reducaoExposicaoMp25Pct: reducaoMp25Pct,
      indiceJusticaClimatica: Math.round(sumJustica / Math.max(1, simulated.length)),
      biometanoGeradoCorredorNm3Dia: Math.round(totalBiometanoDia),
      reducaoMediaUhiC: Number((sumReducaoUhi / Math.max(1, simulated.length)).toFixed(2)),
      economiaEnergiaMjDia: Math.round(totalMjBase - totalMjSim),
      rsuPodaColetadoTonDia: rsuPodaTonDia,
      digestatoBiofertilizanteTonDia: digestatoTonDia,
      dieselSubstituidoLitrosDia: dieselSubstituidoL,
      onibusAbastecidosUnid: onibusAbastecidos,
      mp25EvitadoKgAno: mp25EvitadoKgAno,
    },
  };
}

/** Escala cromática Científica p/ Camada 0 (Vulnerabilidade Socioambiental e de Gênero: Azul Profundo -> Roxo -> Magenta/Vermelho) */
export function getVulnerabilityColor(ivsg: number): string {
  const t = Math.max(0, Math.min(1, (ivsg - 0.15) / 0.75));
  if (t < 0.35) {
    // Azul escuro científico para Ciano/Índigo
    return lerpHex('#1e3a8a', '#4f46e5', t / 0.35);
  } else if (t < 0.7) {
    // Índigo para Magenta/Púrpura
    return lerpHex('#4f46e5', '#c026d3', (t - 0.35) / 0.35);
  } else {
    // Magenta para Vermelho Rubi intenso (periferias hipervulneráveis)
    return lerpHex('#c026d3', '#f43f5e', (t - 0.7) / 0.3);
  }
}

/** Escala cromática p/ Camada 2 (Concentração MP2.5 e Emissões: Esmeralda/Ciano -> Âmbar -> Laranja/Vermelho) */
export function getEmissionsColor(mp25: number): string {
  const t = Math.max(0, Math.min(1, (mp25 - 7) / 23));
  if (t < 0.4) {
    return lerpHex('#06b6d4', '#eab308', t / 0.4);
  } else if (t < 0.75) {
    return lerpHex('#eab308', '#f97316', (t - 0.4) / 0.35);
  } else {
    return lerpHex('#f97316', '#ef4444', (t - 0.75) / 0.25);
  }
}

function lerpHex(hex1: string, hex2: string, factor: number): string {
  const f = Math.max(0, Math.min(1, factor));
  const c1 = parseInt(hex1.slice(1), 16);
  const c2 = parseInt(hex2.slice(1), 16);
  const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
  const r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
  const r = Math.round(r1 + (r2 - r1) * f);
  const g = Math.round(g1 + (g2 - g1) * f);
  const b = Math.round(b1 + (b2 - b1) * f);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
