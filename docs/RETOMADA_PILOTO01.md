# Retomada — Piloto 01 (Unicamp + Barão Geraldo)

Estado em 2026-11-06. Basemap **plano** de ruas e água no Blender 5.2.

## Decisões tomadas
- **Visual em plano, relevo como dado**: a cota do DEM 30 m fica no atributo de vértice `cota_m`; o desenho usa z apenas para empilhar camadas.
- **Avanço passo a passo**: ruas → quadras/uso do solo → (depois) prédios 3D → camadas V1/V2/V3.
- **Recorte piloto**: lon −47.110 a −47.040, lat −22.855 a −22.785 (~7,2 × 7,8 km).

## Pipeline
```bash
# 1) Extração (precisa do dump Geofabrik + DEM locais; caminhos no topo do script)
node scripts/extract_pilot_barao_geraldo.mjs        # -> public/data/pilot01_barao_geraldo.json

# 2) Montagem no Blender (headless) + renders
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
  --python blender_mcp/pilot01_basemap.py -- --render public/renders

# 3) Abrir no Blender com a ponte MCP (porta 9876)
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" \
  public/models/pilot01_barao_geraldo.blend --python blender_mcp/blender_live_addon.py
```

> O JSON extraído já está versionado, então o passo 1 só é necessário para refazer a extração.
> Os dados brutos (`sudeste-260112-free.shp`, `22S48_ZN.tif`) **não** estão no repositório;
> em outra máquina, ajuste `OSM_DIR` e `DEM_TIF_PATH` em `scripts/extract_pilot_barao_geraldo.mjs`.
> O MCP do Blender usa caminhos absolutos em `.agents/mcp_config.json` e `start_blender_live.bat`; ajuste-os se o usuário/pasta mudar.

## Conteúdo
| Camada | Trechos |
|---|---|
| Rodovias | 129 |
| Arteriais | 53 |
| Coletoras | 403 |
| Locais | 1.537 |
| Serviço / campus | 1.587 |
| Pedestres / ciclovias / trilhas | 510 |
| Rios e córregos | 43 |
| Lagos | 40 |

## Pendências conhecidas
1. Lacunas do OSM em loteamentos (NE e SW do recorte) — revisar rua por rua.
2. Larguras estimadas por categoria, não medidas.
3. Cruzamentos são faixas sobrepostas (OSM2World é opção futura).

## Próximo passo sugerido
Quadras e uso do solo (campus, parques, áreas verdes) em plano — `gis_osm_landuse_a_free_1.shp`.
