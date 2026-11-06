export interface SimulationParams {
  zSpread: number;          // 0..100: Explodir Camadas Anatômicas (Eixo Z/Y)
  biomethaneFleet: number;  // 0..100: Frota BRT a Biometano (Substituição do Diesel)
  greenInfra: number;       // 0..100: Infraestrutura Verde (Jardins de Chuva e Arborização)
  modalShift: number;       // 0..100: Transferência Modal (Carro Individual -> BRT)
}

export interface SectorRaw {
  id: number;
  cd_setor: string;
  distrito: string;
  comunidade_fcu: string | null;
  nome_local: string;
  regiao_corredor: string;
  km_corredor: number;
  norm_pos: number;
  centroid: [number, number];
  area_km2: number;
  populacao: number;
  domicilios: number;
  densidade_dom_km2: number;
  renda_media_rs: number;
  renda_mediana_rs: number;
  pct_chefia_feminina: number;
  pct_negra_indigena: number;
  vulnerabilidade_ivsg: number;
  cobertura_arborea_pct: number;
  delta_uhi_c: number;
  mj_transporte_dia: number;
  kwh_resfriamento_dia: number;
  mj_total_dia: number;
  mp25_ugm3: number;
  co2eq_ton_ano: number;
  rsu_organico_kg_dia: number;
  biometano_nm3_dia: number;
  polygon: [number, number][];
}

export interface SectorSimulated extends SectorRaw {
  // Valores recalculados pelo Surrogate Model em tempo real
  sim_vulnerabilidade_ivsg: number;
  sim_justica_climatica: number; // 0..100
  sim_cobertura_arborea_pct: number;
  sim_delta_uhi_c: number;
  sim_reducao_uhi_c: number;
  sim_mj_transporte_dia: number;
  sim_kwh_resfriamento_dia: number;
  sim_mj_total_dia: number;
  sim_mp25_ugm3: number;
  sim_co2eq_ton_ano: number;
  sim_biometano_nm3_dia: number;
  sim_jardins_chuva_m2: number;
}

export interface CorridorKPIs {
  balancoCarbonoTonAno: number;        // Líquido em tCO2eq/ano
  emissoesEvitadasTonAno: number;      // Redução frente ao baseline
  reducaoExposicaoMp25Pct: number;     // % redução ponderada por população vulnerável
  indiceJusticaClimatica: number;      // 0 a 100
  biometanoGeradoCorredorNm3Dia: number;
  reducaoMediaUhiC: number;
  economiaEnergiaMjDia: number;
  // Balanço de Massa e Energia Explícito (V1 <-> V2 <-> V3)
  rsuPodaColetadoTonDia: number;       // t/dia de RSU orgânico + poda urbana
  digestatoBiofertilizanteTonDia: number; // t/dia de composto/digestato retornando aos jardins de chuva
  dieselSubstituidoLitrosDia: number;  // L/dia de óleo diesel fóssil evitado nos ônibus articulados
  onibusAbastecidosUnid: number;       // Nº de articulados do BRT Campo Grande movidos a GNR
  mp25EvitadoKgAno: number;            // kg/ano de material particulado fino evitado no corredor
}
