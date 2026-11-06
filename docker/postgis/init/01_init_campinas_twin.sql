-- ============================================================================
-- GÊMEO DIGITAL URBANO-ENERGÉTICO DE CAMPINAS (CD_MUN = 3509502)
-- Schema Espacial PostGIS 3.4 para Basemap, Edificações 3D OSM/DEM,
-- Setores Censitários Censo 2022 (V3), Rede CP2B Biometano (V2) e Corredor BRT (V1)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

CREATE SCHEMA IF NOT EXISTS twin;

-- 1. Setores Censitários IBGE Censo 2022 (Vetor 3: Quem Mora Onde + Vulnerabilidade)
CREATE TABLE IF NOT EXISTS twin.campinas_census_tracts (
    id VARCHAR(20) PRIMARY KEY,
    district VARCHAR(80) NOT NULL,
    neighborhood VARCHAR(120),
    population INTEGER NOT NULL DEFAULT 0,
    households INTEGER NOT NULL DEFAULT 0,
    pop_density_km2 NUMERIC(10,2),
    female_head_pct NUMERIC(5,2),
    black_brown_pct NUMERIC(5,2),
    avg_income_brl NUMERIC(10,2),
    elevation_m NUMERIC(8,2),
    slope_pct NUMERIC(5,2),
    verticalization_idx NUMERIC(5,3),
    base_vulnerability NUMERIC(5,3),
    base_uhi_c NUMERIC(5,2),
    rsu_ton_day NUMERIC(8,3),
    poda_ton_day NUMERIC(8,3),
    geom GEOMETRY(Polygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_tracts_geom ON twin.campinas_census_tracts USING GIST (geom);

-- 2. Edifícios 3D OSM + Dimensionamento Altimétrico DEM/Censo 2022
CREATE TABLE IF NOT EXISTS twin.campinas_buildings_3d (
    osm_id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(160),
    building_type VARCHAR(64),
    tract_id VARCHAR(20),
    district VARCHAR(80),
    footprint_area_m2 NUMERIC(10,2),
    levels INTEGER NOT NULL DEFAULT 1,
    base_elevation_m NUMERIC(8,2) NOT NULL DEFAULT 650.0,
    height_m NUMERIC(8,2) NOT NULL DEFAULT 4.0,
    roof_elevation_m NUMERIC(8,2) GENERATED ALWAYS AS (base_elevation_m + height_m) STORED,
    highlight_role VARCHAR(32) DEFAULT 'standard', -- 'standard' (white clay), 'cp2b_anchor' (green), 'social_critical' (red), 'brt_hub' (amber)
    solar_potential_kwh_yr NUMERIC(12,2),
    cooling_demand_kwh_day NUMERIC(10,2),
    geom GEOMETRY(Polygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_buildings_geom ON twin.campinas_buildings_3d USING GIST (geom);

-- 3. Basemap Viário e Corredor BRT Campo Grande (OSM Roads + Eixo John Boyd Dunlop)
CREATE TABLE IF NOT EXISTS twin.campinas_roads (
    osm_id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(160),
    fclass VARCHAR(48),
    is_brt_corridor BOOLEAN DEFAULT FALSE,
    maxspeed INTEGER,
    geom GEOMETRY(LineString, 4326)
);
CREATE INDEX IF NOT EXISTS idx_roads_geom ON twin.campinas_roads USING GIST (geom);

-- 4. Hidrografia e Uso do Solo / Parques (OSM Waterways + Landuse)
CREATE TABLE IF NOT EXISTS twin.campinas_landuse_water (
    id SERIAL PRIMARY KEY,
    osm_id VARCHAR(32),
    name VARCHAR(160),
    layer_kind VARCHAR(32), -- 'waterway', 'water', 'park', 'forest', 'industrial', 'residential'
    fclass VARCHAR(48),
    geom GEOMETRY(Geometry, 4326)
);
CREATE INDEX IF NOT EXISTS idx_landuse_geom ON twin.campinas_landuse_water USING GIST (geom);

-- 5. Nós Reais da Rede CP2B (Vetor 2: ETEs SANASA, Aterro Delta A, Usina OneBio, Indústrias, Gasodutos)
CREATE TABLE IF NOT EXISTS twin.campinas_cp2b_nodes (
    node_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(48) NOT NULL, -- 'ETE_SANASA', 'BIOMETHANE_PLANT', 'LANDFILL_RSU', 'INDUSTRIAL_CODIGESTION', 'BRT_TERMINAL', 'GAS_SUBSTATION'
    feedstock VARCHAR(120),
    treatment_process TEXT,
    biogas_nm3_day NUMERIC(12,2) DEFAULT 0,
    biomethane_nm3_day NUMERIC(12,2) DEFAULT 0,
    power_kw NUMERIC(10,2) DEFAULT 0,
    dbo_removal_pct NUMERIC(5,2) DEFAULT 0,
    elevation_m NUMERIC(8,2) DEFAULT 620.0,
    status VARCHAR(48) DEFAULT 'Ativa',
    geom GEOMETRY(Point, 4326)
);
CREATE INDEX IF NOT EXISTS idx_cp2b_nodes_geom ON twin.campinas_cp2b_nodes USING GIST (geom);

-- 6. Função PostGIS de Simulação Acoplada V1 <-> V2 <-> V3 para Martin Vector Tiles
CREATE OR REPLACE FUNCTION twin.simulate_campinas_scenario(
    z_ tile_z default 0,
    x_ tile_x default 0,
    y_ tile_y default 0,
    fleet_biomethane_pct NUMERIC DEFAULT 0.65,
    green_infra_pct NUMERIC DEFAULT 0.50,
    waste_recovery_pct NUMERIC DEFAULT 0.70
)
RETURNS BYTEA AS $$
DECLARE
    mvt BYTEA;
BEGIN
    SELECT INTO mvt ST_AsMVT(tile, 'campinas_simulation', 4096, 'geom') FROM (
        SELECT
            id,
            district,
            neighborhood,
            population,
            avg_income_brl,
            elevation_m,
            ROUND((base_uhi_c - (green_infra_pct * 2.8) - (fleet_biomethane_pct * 0.6))::numeric, 2) AS effective_uhi_c,
            ROUND((rsu_ton_day * waste_recovery_pct * 118.5 + poda_ton_day * waste_recovery_pct * 85.0)::numeric, 1) AS biomethane_nm3_day,
            ROUND(GREATEST(0.05, base_vulnerability * (1.0 - 0.35 * fleet_biomethane_pct - 0.30 * green_infra_pct - 0.20 * waste_recovery_pct))::numeric, 3) AS effective_vulnerability,
            ST_AsMVTGeom(ST_Transform(geom, 3857), ST_TileEnvelope(z_, x_, y_), 4096, 64, true) AS geom
        FROM twin.campinas_census_tracts
        WHERE ST_Intersects(geom, ST_Transform(ST_TileEnvelope(z_, x_, y_), 4326))
    ) AS tile WHERE geom IS NOT NULL;
    RETURN mvt;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE;
