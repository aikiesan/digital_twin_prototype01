# ============================================================================
# STEP 1: CAMPINAS 3D BASEMAP & 4-TIER ROAD NETWORK (BLENDER 5.2)
# Foco exclusivo na Etapa 1: Placa Topográfica Suave (DEM 30m) + Hidrografia +
# Hierarquia Viária Completa (Rodovias, Arteriais/BRT, Coletoras e 4.500 Ruas Menores)
# Sem edifícios e sem elementos verticais pesados — base limpa para evoluir passo a passo.
# ============================================================================

import bpy
import json
import math
import os

WORKSPACE_DIR = "c:/Users/Lucas/Documents/Digital_Twin_Modelling"
STEP1_JSON = os.path.join(WORKSPACE_DIR, "public/data/step1_campinas_basemap_roads.json")
MODELS_DIR = os.path.join(WORKSPACE_DIR, "public/models")
STEP1_BLEND = os.path.join(MODELS_DIR, "step1_campinas_basemap.blend")
STEP1_GLB = os.path.join(MODELS_DIR, "step1_campinas_basemap.glb")

LON_CENTER = -47.1300
LAT_CENTER = -22.9310
SCALE = 185.0
BASE_ELEV_M = 552.0
# No Passo 1 usamos relevo suave (exagero moderado 0.45) para destacar a malha viária com nitidez
TERRAIN_EXAG = 0.45

os.makedirs(MODELS_DIR, exist_ok=True)

def project_xy(lon, lat):
    x = (lon - LON_CENTER) * SCALE * math.cos(math.radians(LAT_CENTER))
    y = (lat - LAT_CENTER) * SCALE
    return x, y

def elev_z(elev_m):
    return ((elev_m - BASE_ELEV_M) / 110.0) * 1.45 * TERRAIN_EXAG

def make_collection(name):
    if name in bpy.data.collections:
        c = bpy.data.collections[name]
        for o in list(c.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        return c
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c

def make_mat(name, rgba, roughness=0.5, metallic=0.05, emission=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission > 0 and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = rgba
            bsdf.inputs["Emission Strength"].default_value = emission
    mat.diffuse_color = rgba
    return mat

def add_curve_network(coll, obj_name, segments, bevel_width, z_offset, mat, sample_dem_fn=None):
    curve = bpy.data.curves.new(f"Curve_{obj_name}", type="CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = bevel_width
    curve.bevel_resolution = 1

    for seg in segments:
        coords = seg.get("coords", [])
        if len(coords) < 2:
            continue
        sp = curve.splines.new("POLY")
        sp.points.add(len(coords) - 1)
        for i, pt in enumerate(coords):
            lon, lat = pt[0], pt[1]
            elev = pt[2] if len(pt) > 2 else (sample_dem_fn(lon, lat) if sample_dem_fn else 640.0)
            x, y = project_xy(lon, lat)
            z = elev_z(elev) + z_offset
            sp.points[i].co = (x, y, z, 1.0)

    obj = bpy.data.objects.new(obj_name, curve)
    obj.data.materials.append(mat)
    coll.objects.link(obj)
    return obj

def build_step1_basemap():
    bpy.ops.wm.read_factory_settings(use_empty=True)

    with open(STEP1_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    rel = data["relevo_3d"]
    cols, rows = rel["cols"], rel["rows"]
    lon_min, lon_max = rel["lon_min"], rel["lon_max"]
    lat_min, lat_max = rel["lat_min"], rel["lat_max"]
    heights = rel["heights_m"]

    def sample_grid(lon, lat):
        c = max(0, min(cols - 1, round(((lon - lon_min) / (lon_max - lon_min)) * (cols - 1))))
        r = max(0, min(rows - 1, round(((lat_max - lat) / (lat_max - lat_min)) * (rows - 1))))
        return heights[r][c]

    # 0. Iluminação Arquitetônica e Câmera
    coll_studio = make_collection("00_CAMERA_AND_LIGHTING")
    sun_d = bpy.data.lights.new("Sun_Main", type="SUN")
    sun_d.energy = 3.5
    sun_o = bpy.data.objects.new("Sun_Main", sun_d)
    sun_o.location = (15, -18, 30)
    sun_o.rotation_euler = (math.radians(35), math.radians(15), math.radians(-20))
    coll_studio.objects.link(sun_o)

    cam_d = bpy.data.cameras.new("Cam_Basemap_Campinas")
    cam_d.lens = 40.0
    cam_o = bpy.data.objects.new("Cam_Basemap_Campinas", cam_d)
    cam_o.location = (1.5, -16.5, 13.5)
    cam_o.rotation_euler = (math.radians(50.0), 0.0, math.radians(5.0))
    coll_studio.objects.link(cam_o)
    bpy.context.scene.camera = cam_o

    # 1. Placa Base Topográfica de Campinas (DEM 30m)
    coll_dem = make_collection("01_BASE_TERRENO_DEM")
    mesh_dem = bpy.data.meshes.new("Mesh_Base_Terrain_Campinas")
    obj_dem = bpy.data.objects.new("Base_Terrain_Campinas_30m", mesh_dem)
    coll_dem.objects.link(obj_dem)

    verts, faces = [], []
    for r in range(rows):
        lat = lat_max - (r / (rows - 1)) * (lat_max - lat_min)
        for c in range(cols):
            lon = lon_min + (c / (cols - 1)) * (lon_max - lon_min)
            x, y = project_xy(lon, lat)
            z = elev_z(heights[r][c]) - 0.04
            verts.append((x, y, z))

    for r in range(rows - 1):
        for c in range(cols - 1):
            v0 = r * cols + c
            faces.append((v0, v0 + 1, (r + 1) * cols + c + 1, (r + 1) * cols + c))

    mesh_dem.from_pydata(verts, [], faces)
    for p in mesh_dem.polygons:
        p.use_smooth = True
    mesh_dem.update()

    # Cor de maquete arquitetônica escura/ardósia ou papel cartográfico claro para máximo contraste das ruas
    mat_terrain = make_mat("MAT_Basemap_Ground", (0.11, 0.15, 0.22, 1.0), roughness=0.9)
    obj_dem.data.materials.append(mat_terrain)

    # 2. Hidrografia (Rio Capivari, Ribeirão Piçarrão, Anhumas)
    coll_water = make_collection("02_HIDROGRAFIA_RIOS")
    mat_water = make_mat("MAT_Basemap_Rivers", (0.08, 0.58, 0.88, 1.0), roughness=0.2, emission=0.2)
    add_curve_network(coll_water, "Rios_e_Corregos_Campinas", data.get("waterways", []), 0.022, -0.01, mat_water, sample_grid)

    # 3. Hierarquia Viária Completa (8.555 segmentos em 4 Níveis!)
    tiers = data["roadTiers"]

    # Nível 4: Ruas Locais Menores de Bairro (4.500 segmentos residenciais finos!)
    coll_local = make_collection("03_RUAS_MENORES_LOCAIS")
    mat_local = make_mat("MAT_Roads_Local_Residential", (0.38, 0.46, 0.56, 1.0), roughness=0.6)
    add_curve_network(coll_local, "Ruas_Residenciais_Locais_4500", tiers["localStreets"], 0.008, 0.005, mat_local)

    # Nível 3: Vias Coletoras Secundárias e Terciárias (2.378 segmentos)
    coll_coll = make_collection("04_VIAS_COLETORAS")
    mat_coll = make_mat("MAT_Roads_Collectors", (0.62, 0.70, 0.80, 1.0), roughness=0.5)
    add_curve_network(coll_coll, "Vias_Coletoras_Bairros_2378", tiers["collectors"], 0.015, 0.012, mat_coll)

    # Nível 2: Avenidas Arteriais Principais & Corredor BRT (Av. John Boyd Dunlop, Amoreiras, Ibirapuera - 1.142 segmentos)
    coll_art = make_collection("05_AVENIDAS_ARTERIAIS_E_BRT")
    mat_art = make_mat("MAT_Roads_Arterials_BRT", (0.15, 0.82, 0.96, 1.0), roughness=0.3, emission=0.6)
    add_curve_network(coll_art, "Avenidas_Arteriais_e_BRT_1142", tiers["arterials"], 0.026, 0.022, mat_art)

    # Nível 1: Rodovias Estaduais (Anhanguera, Bandeirantes, Santos Dumont - 535 segmentos)
    coll_hwy = make_collection("06_RODOVIAS_EXPRESSAS")
    mat_hwy = make_mat("MAT_Roads_Highways", (0.96, 0.65, 0.14, 1.0), roughness=0.35, emission=0.4)
    add_curve_network(coll_hwy, "Rodovias_Anhanguera_Bandeirantes_535", tiers["highways"], 0.034, 0.028, mat_hwy)

    bpy.ops.wm.save_as_mainfile(filepath=STEP1_BLEND)
    bpy.ops.export_scene.gltf(
        filepath=STEP1_GLB,
        export_format="GLB",
        export_yup=True,
        export_cameras=False,
        export_lights=False,
    )
    print(f"[STEP-1] Concluído! Salvo em {STEP1_BLEND} e {STEP1_GLB}")

if __name__ == "__main__":
    build_step1_basemap()
