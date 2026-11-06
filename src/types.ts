export type PeopleSocialLens =
  | 'vulnerabilidade'   // IVSG Combinado
  | 'renda'             // Renda Média do Responsável (R$)
  | 'chefia_feminina'   // % Domicílios com Responsável Mulher
  | 'raca_cor'          // % População Preta, Parda e Indígena
  | 'verticalizacao';   // % Apartamentos vs. Casas Horizontais

export type VisualStyleMode = 'editorial_daylight' | 'scientific_night';

export interface SimulationParams {
  zSpread: number;          // 0..100: Explodir Camadas Anatômicas (Eixo Z/Y)
  biomethaneFleet: number;  // 0..100: Frota BRT a Biometano (Substituição do Diesel)
  greenInfra: number;       // 0..100: Infraestrutura Verde (Jardins de Chuva e Arborização)
  modalShift: number;       // 0..100: Transferência Modal (Carro Individual -> BRT)
  terrainExaggeration: number; // 0..100: Exagero Vertical Topográfico (SRTM 30m Campinas)
  peopleLens: PeopleSocialLens;
  visualStyle: VisualStyleMode;
}

export interface UrbanBuildingFootprint {
  lon: number;
  lat: number;
  pavimentos: number;
  largura_m: number;
  profundidade_m: number;
  tipo: 'residencial_horizontal' | 'torre_residencial' | 'comercial_servico';
  rot_rad: number;
}

export interface SectorRaw {
  id: number;
  cd_setor: string;
  distrito: string;
  comunidade_fcu: string | null;
  nome_local: string;
  perfil_social: string;
  regiao_corredor: string;
  km_corredor: number;
  norm_pos: number;
  centroid: [number, number];
  elevacao_m: number;
  area_km2: number;
  populacao: number;
  domicilios: number;
  densidade_dom_km2: number;
  moradores_por_domicilio: number;
  pct_verticalizacao: number;
  renda_media_rs: number;
  renda_mediana_rs: number;
  pct_chefia_feminina: number;
  pct_branca: number;
  pct_preta: number;
  pct_parda: number;
  pct_negra_indigena: number;
  pct_jovens_0a14: number;
  pct_idosos_60mais: number;
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
  buildings: UrbanBuildingFootprint[];
}

export interface SectorSimulated extends SectorRaw {
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
  rsuPodaColetadoTonDia: number;
  digestatoBiofertilizanteTonDia: number;
  dieselSubstituidoLitrosDia: number;
  onibusAbastecidosUnid: number;
  mp25EvitadoKgAno: number;
}
