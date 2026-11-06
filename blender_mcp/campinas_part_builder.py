# ============================================================================
# CAMPINAS DIGITAL TWIN - BLENDER 5.2 PART-BY-PART 3D BUILDER
# Constrói a maquete 3D georreferenciada de Campinas (IBGE 3509502) no Blender 5.2
# dividida em 5 Coleções modulares (Part 1 a Part 5), salva o arquivo .blend,
# renderiza previews arquitetônicos e exporta .glb para o React Three Fiber.
# ============================================================================

import bpy
import bmesh
import json
import math
import os
import sys

WORKSPACE_DIR = "c:/Users/Lucas/Documents/Digital_Twin_Modelling"
DATA_JSON_PATH = os.path.join(WORKSPACE_DIR, "src/data/campinasRealData.json")
MODELS_DIR = os.path.join(WORKSPACE_DIR, "public/models")
BLEND_FILE_PATH = os.path.join(MODELS_DIR, "campinas_digital_twin.blend")
GLB_FILE_PATH = os.path.join(MODELS_DIR, "campinas_digital_twin.glb")

LON_CENTER = -47.1300
LAT_CENTER = -22.9310
SCALE = 185.0
BASE_ELEV_M = 552.0
TERRAIN_EXAG = 0.70

os.makedirs(MODELS_DIR, exist_ok=True)

def project_to_blender_xy(lon, lat):
    x = (lon - LON_CENTER) * SCALE * math.cos(math.radians(LAT_CENTER))
    y = (lat - LAT_CENTER) * SCALE  # +Y is North in Blender -> -Z in Three.js glTF
    return x, y

def elev_to_blender_z(elev_m):
    return ((elev_m - BASE_ELEV_M) / 110.0) * 1.45 * TERRAIN_EXAG

def get_or_create_collection(name):
    if name in bpy.data.collections:
        coll = bpy.data.collections[name]
        # Clear existing objects in collection when rebuilding this part
        for obj in list(coll.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        return coll
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll

def get_or_create_material(name, rgba, roughness=0.45, metallic=0.05, emission_strength=0.0):
    if name in bpy.data.materials:
        mat = bpy.data.materials[name]
    else:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission_strength > 0 and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = rgba
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    mat.diffuse_color = rgba
    return mat

def setup_studio_lighting_and_camera():
    scene = bpy.context.scene
    # Render engine EEVEE or WORKBENCH for fast crisp architectural clay previews
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.film_transparent = False

    if not scene.world:
        scene.world = bpy.data.worlds.new("Campinas_Studio_World")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.855, 0.894, 0.933, 1.0)  # #dbe4ee architectural sky
        bg.inputs[1].default_value = 1.0

    coll_studio = get_or_create_collection("00_STUDIO_CAMERA_LIGHTS")

    # Sun light
    sun_data = bpy.data.lights.new(name="Sun_Campinas", type="SUN")
    sun_data.energy = 3.2
    sun_data.color = (1.0, 0.98, 0.94)
    sun_obj = bpy.data.objects.new(name="Sun_Campinas", object_data=sun_data)
    sun_obj.location = (18.0, -20.0, 32.0)
    sun_obj.rotation_euler = (math.radians(38), math.radians(18), math.radians(-25))
    coll_studio.objects.link(sun_obj)

    # Fill light
    fill_data = bpy.data.lights.new(name="Fill_Campinas", type="SUN")
    fill_data.energy = 1.1
    fill_data.color = (0.75, 0.88, 1.0)
    fill_obj = bpy.data.objects.new(name="Fill_Campinas", object_data=fill_data)
    fill_obj.location = (-16.0, 18.0, 22.0)
    fill_obj.rotation_euler = (math.radians(-42), math.radians(-20), math.radians(140))
    coll_studio.objects.link(fill_obj)

    # Architectural Isometric/Perspective Camera looking at the BRT Campo Grande Corridor
    cam_data = bpy.data.cameras.new(name="Cam_Corredor_Campinas")
    cam_data.lens = 42.0
    cam_data.clip_start = 0.1
    cam_data.clip_end = 300.0
    cam_obj = bpy.data.objects.new(name="Cam_Corredor_Campinas", object_data=cam_data)
    cam_obj.location = (2.8, -17.5, 11.8)
    cam_obj.rotation_euler = (math.radians(56.5), 0.0, math.radians(8.5))
    coll_studio.objects.link(cam_obj)
    scene.camera = cam_obj

# ============================================================================
# PART 1: MODELO DIGITAL DE ELEVAÇÃO (DEM 30m - 22S48_ZN.tif) DE CAMPINAS
# ============================================================================
def build_part1_dem(data):
    print("[MCP-BLENDER] Construindo PARTE 1: Terreno Topográfico 3D DEM 30m de Campinas (547m-789m)...")
    coll = get_or_create_collection("01_DEM_TERRAIN_CAMPINAS")
    rel = data["relevo_3d"]
    cols = rel["cols"]
    rows = rel["rows"]
    lon_min, lon_max = rel["lon_min"], rel["lon_max"]
    lat_min, lat_max = rel["lat_min"], rel["lat_max"]
    heights = rel["heights_m"]

    mesh = bpy.data.meshes.new("Mesh_Terrain_DEM_Campinas")
    obj = bpy.data.objects.new("Terrain_DEM_Campinas_30m", mesh)
    coll.objects.link(obj)

    verts = []
    faces = []
    for r in range(rows):
        lat = lat_max - (r / (rows - 1)) * (lat_max - lat_min)
        for c in range(cols):
            lon = lon_min + (c / (cols - 1)) * (lon_max - lon_min)
            x, y = project_to_blender_xy(lon, lat)
            z = elev_to_blender_z(heights[r][c]) - 0.12
            verts.append((x, y, z))

    for r in range(rows - 1):
        for c in range(cols - 1):
            v0 = r * cols + c
            v1 = v0 + 1
            v2 = (r + 1) * cols + c + 1
            v3 = (r + 1) * cols + c
            faces.append((v0, v1, v2, v3))

    mesh.from_pydata(verts, [], faces)
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.update()

    mat_terrain = get_or_create_material("MAT_Terrain_Clay", (0.86, 0.89, 0.92, 1.0), roughness=0.85, metallic=0.02)
    obj.data.materials.append(mat_terrain)
    obj["layer_role"] = "DEM_SRTM_30M"
    obj["elev_min_m"] = rel["elev_min_m"]
    obj["elev_max_m"] = rel["elev_max_m"]
    print(f"[MCP-BLENDER] -> Parte 1 concluída: Malha DEM ({len(verts)} vértices, {len(faces)} faces).")

# ============================================================================
# PART 2: BASEMAP CARTOGRÁFICO 3D (VIAS OSM, RIOS, PARQUES E CORREDOR BRT)
# ============================================================================
def sample_dem_grid(rel, lon, lat):
    cols, rows = rel["cols"], rel["rows"]
    c = max(0, min(cols - 1, round(((lon - rel["lon_min"]) / (rel["lon_max"] - rel["lon_min"])) * (cols - 1))))
    r = max(0, min(rows - 1, round(((rel["lat_max"] - lat) / (rel["lat_max"] - rel["lat_min"])) * (rows - 1))))
    return rel["heights_m"][r][c]

def build_part2_basemap(data):
    print("[MCP-BLENDER] Construindo PARTE 2: Basemap Viário OSM, Hidrografia, Parques e Corredor BRT...")
    coll = get_or_create_collection("02_BASEMAP_INFRA_OSM")
    rel = data["relevo_3d"]
    basemap = data.get("basemap", {})

    mat_road = get_or_create_material("MAT_OSM_Road_Slate", (0.39, 0.45, 0.54, 1.0), roughness=0.7)
    mat_brt = get_or_create_material("MAT_BRT_Corridor_Cyan", (0.01, 0.52, 0.78, 1.0), roughness=0.3, emission_strength=0.4)
    mat_water = get_or_create_material("MAT_River_Water", (0.22, 0.74, 0.97, 1.0), roughness=0.15, metallic=0.25)
    mat_pipe_cp2b = get_or_create_material("MAT_Pipeline_CP2B_Emerald", (0.06, 0.72, 0.50, 1.0), roughness=0.3, emission_strength=0.5)

    # 1. Vias Arteriais e Coletoras OSM agrupadas em um único Curve Object otimizado
    curve_roads = bpy.data.curves.new("Curve_OSM_Roads", type="CURVE")
    curve_roads.dimensions = "3D"
    curve_roads.bevel_depth = 0.018
    for r in basemap.get("roads", [])[:1200]:
        coords = r.get("coords", [])
        if len(coords) < 2 or r.get("isBrtCorridor"):
            continue
        spline = curve_roads.splines.new("POLY")
        spline.points.add(len(coords) - 1)
        for i, (lon, lat) in enumerate(coords):
            x, y = project_to_blender_xy(lon, lat)
            z = elev_to_blender_z(sample_dem_grid(rel, lon, lat)) - 0.04
            spline.points[i].co = (x, y, z, 1.0)
    obj_roads = bpy.data.objects.new("Basemap_OSM_Roads", curve_roads)
    obj_roads.data.materials.append(mat_road)
    coll.objects.link(obj_roads)

    # 2. Eixo Exclusivo do Corredor BRT Campo Grande (Av. John Boyd Dunlop)
    curve_brt = bpy.data.curves.new("Curve_BRT_Corridor", type="CURVE")
    curve_brt.dimensions = "3D"
    curve_brt.bevel_depth = 0.048
    estacoes = data.get("corredor_brt", {}).get("estacoes", [])
    if len(estacoes) >= 2:
        sp = curve_brt.splines.new("POLY")
        sp.points.add(len(estacoes) - 1)
        for i, st in enumerate(estacoes):
            x, y = project_to_blender_xy(st["lon"], st["lat"])
            z = elev_to_blender_z(st.get("elev_m", 650)) + 0.08
            sp.points[i].co = (x, y, z, 1.0)
    obj_brt = bpy.data.objects.new("Corredor_BRT_Campo_Grande", curve_brt)
    obj_brt.data.materials.append(mat_brt)
    coll.objects.link(obj_brt)

    # 3. Hidrografia OSM (Rio Capivari, Ribeirão Piçarrão, Anhumas)
    curve_rivers = bpy.data.curves.new("Curve_OSM_Rivers", type="CURVE")
    curve_rivers.dimensions = "3D"
    curve_rivers.bevel_depth = 0.032
    for w in basemap.get("waterways", [])[:350]:
        coords = w.get("coords", [])
        if len(coords) < 2:
            continue
        sp = curve_rivers.splines.new("POLY")
        sp.points.add(len(coords) - 1)
        for i, (lon, lat) in enumerate(coords):
            x, y = project_to_blender_xy(lon, lat)
            z = elev_to_blender_z(sample_dem_grid(rel, lon, lat)) - 0.06
            sp.points[i].co = (x, y, z, 1.0)
    obj_rivers = bpy.data.objects.new("Basemap_OSM_Waterways", curve_rivers)
    obj_rivers.data.materials.append(mat_water)
    coll.objects.link(obj_rivers)

    # 4. Gasodutos Comgás / Anel Dedicado de Biometano CP2B
    curve_pipes = bpy.data.curves.new("Curve_CP2B_Pipelines", type="CURVE")
    curve_pipes.dimensions = "3D"
    curve_pipes.bevel_depth = 0.035
    for p in basemap.get("gasPipelines", []):
        coords = p.get("coords", [])
        if len(coords) < 2:
            continue
        sp = curve_pipes.splines.new("POLY")
        sp.points.add(len(coords) - 1)
        for i, (lon, lat) in enumerate(coords):
            x, y = project_to_blender_xy(lon, lat)
            z = elev_to_blender_z(sample_dem_grid(rel, lon, lat)) + 0.03
            sp.points[i].co = (x, y, z, 1.0)
    obj_pipes = bpy.data.objects.new("Basemap_Gasodutos_CP2B_Comgas", curve_pipes)
    obj_pipes.data.materials.append(mat_pipe_cp2b)
    coll.objects.link(obj_pipes)
    print("[MCP-BLENDER] -> Parte 2 concluída: Vias OSM, Rios, Corredor BRT e Gasodutos gerados.")

# ============================================================================
# PART 3: SETORES CENSITÁRIOS CENSO 2022 ("QUEM MORA ONDE EM CAMPINAS")
# ============================================================================
def create_extruded_polygon_bmesh(bm, ring_lonlat, base_z, height_z):
    pts = [project_to_blender_xy(lon, lat) for lon, lat in ring_lonlat]
    if len(pts) > 2 and pts[0] == pts[-1]:
        pts = pts[:-1]
    if len(pts) < 3:
        return
    bottom_verts = [bm.verts.new((x, y, base_z)) for x, y in pts]
    try:
        bottom_face = bm.faces.new(bottom_verts)
        res = bmesh.ops.extrude_face_region(bm, geom=[bottom_face])
        extruded_verts = [v for v in res["geom"] if isinstance(v, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=(0.0, 0.0, height_z), verts=extruded_verts)
    except ValueError:
        pass

def build_part3_censo(data):
    print("[MCP-BLENDER] Construindo PARTE 3: 35 Setores Censitários Censo 2022 (Quem Mora Onde)...")
    coll = get_or_create_collection("03_CENSO_2022_SECTORS")
    mat_sector = get_or_create_material("MAT_Censo_Sector_Plinth", (0.22, 0.68, 0.96, 1.0), roughness=0.55)

    for s in data.get("setores", []):
        bm = bmesh.new()
        base_z = elev_to_blender_z(s.get("elevacao_m", 650))
        create_extruded_polygon_bmesh(bm, s["polygon"], base_z, 0.08)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])

        mesh = bpy.data.meshes.new(f"Mesh_Setor_{s['cd_setor']}")
        bm.to_mesh(mesh)
        bm.free()

        obj = bpy.data.objects.new(f"Setor_{s['cd_setor']}", mesh)
        obj.data.materials.append(mat_sector)
        # Custom properties exportadas para o .glb (extras/userData no Three.js!)
        obj["sector_id"] = int(s["id"])
        obj["cd_setor"] = str(s["cd_setor"])
        obj["nome_local"] = str(s["nome_local"])
        obj["renda_media_rs"] = float(s["renda_media_rs"])
        obj["pct_chefia_feminina"] = float(s["pct_chefia_feminina"])
        obj["pct_negra_indigena"] = float(s["pct_negra_indigena"])
        obj["vulnerabilidade_ivsg"] = float(s["vulnerabilidade_ivsg"])
        obj["biometano_nm3_dia"] = float(s["biometano_nm3_dia"])
        coll.objects.link(obj)
    print(f"[MCP-BLENDER] -> Parte 3 concluída: {len(data.get('setores', []))} setores censitários com metadados Censo 2022.")

# ============================================================================
# PART 4: 1.850 EDIFÍCIOS 3D DO OPENSTREETMAP ANCORADOS NO DEM (MAQUETE BRANCA)
# ============================================================================
def build_part4_buildings(data):
    print("[MCP-BLENDER] Construindo PARTE 4: 1.850 Edifícios 3D OSM dimensionados com DEM + Censo 2022...")
    coll = get_or_create_collection("04_OSM_BUILDINGS_3D")

    materials = {
        "standard": get_or_create_material("MAT_Bldg_White_Clay", (0.97, 0.98, 0.99, 1.0), roughness=0.40, metallic=0.06),
        "cp2b_green": get_or_create_material("MAT_Bldg_CP2B_Green", (0.13, 0.77, 0.37, 1.0), roughness=0.28, metallic=0.15),
        "brt_amber": get_or_create_material("MAT_Bldg_BRT_Amber", (0.92, 0.70, 0.03, 1.0), roughness=0.28, metallic=0.15),
        "social_red": get_or_create_material("MAT_Bldg_Social_Red", (0.94, 0.27, 0.27, 1.0), roughness=0.28, metallic=0.15),
    }

    # Agrupamos os 1.850 edifícios OSM por highlightRole para máxima performance WebGL no .glb
    bms = {role: bmesh.new() for role in materials.keys()}
    counts = {role: 0 for role in materials.keys()}

    for b in data.get("osmBuildings3D", [])[:1650]:
        role = b.get("highlightRole", "standard")
        if role not in bms:
            role = "standard"
        base_z = elev_to_blender_z(b.get("baseElevationM", 650)) - 0.03
        height_z = max(0.14, (b.get("heightM", 6.0) / 32.0) * 0.95)
        create_extruded_polygon_bmesh(bms[role], b["coords"], base_z, height_z)
        counts[role] += 1

    # Também adiciona os edifícios dos setores do corredor para continuidade morfológica
    for s in data.get("setores", []):
        base_z = elev_to_blender_z(s.get("elevacao_m", 650)) + 0.08
        for idx, b in enumerate(s.get("buildings", [])):
            bx, by = project_to_blender_xy(b["lon"], b["lat"])
            w = max(0.055, (b["largura_m"] / 100.0) * 0.55)
            d = max(0.055, (b["profundidade_m"] / 100.0) * 0.55)
            h = max(0.12, b["pavimentos"] * 0.082)
            ring = [(bx - w, by - d), (bx + w, by - d), (bx + w, by + d), (bx - w, by + d)]
            role = "standard" if idx % 6 != 0 else ("social_red" if s["vulnerabilidade_ivsg"] > 0.58 else "cp2b_green")
            pts = ring
            bottom_verts = [bms[role].verts.new((px, py, base_z)) for px, py in pts]
            try:
                f = bms[role].faces.new(bottom_verts)
                res = bmesh.ops.extrude_face_region(bms[role], geom=[f])
                ev = [v for v in res["geom"] if isinstance(v, bmesh.types.BMVert)]
                bmesh.ops.translate(bms[role], vec=(0.0, 0.0, h), verts=ev)
                counts[role] += 1
            except ValueError:
                pass

    for role, bm in bms.items():
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        mesh = bpy.data.meshes.new(f"Mesh_OSM_Buildings_{role}")
        bm.to_mesh(mesh)
        bm.free()
        obj = bpy.data.objects.new(f"OSM_Buildings_3D_{role}", mesh)
        obj.data.materials.append(materials[role])
        obj["highlight_role"] = role
        obj["building_count"] = counts[role]
        coll.objects.link(obj)

    print(f"[MCP-BLENDER] -> Parte 4 concluída: Edifícios 3D gerados por categoria: {counts}")

# ============================================================================
# PART 5: REDE COMPLETA CP2B (30 ETEs SANASA, 40 INDÚSTRIAS, DELTA A, ONEBIO)
# ============================================================================
def build_part5_cp2b(data):
    print("[MCP-BLENDER] Construindo PARTE 5: 77 Nós Reais da Rede CP2B (Biodigestores 3D + Arcos de Biometano)...")
    coll = get_or_create_collection("05_CP2B_BIOENERGY_NETWORK")

    mat_plant = get_or_create_material("MAT_CP2B_Plant_Emerald", (0.02, 0.59, 0.41, 1.0), roughness=0.25, metallic=0.2, emission_strength=0.4)
    mat_ete = get_or_create_material("MAT_CP2B_ETE_Cyan", (0.01, 0.52, 0.78, 1.0), roughness=0.25, metallic=0.2)
    mat_ind = get_or_create_material("MAT_CP2B_Ind_Amber", (0.85, 0.47, 0.02, 1.0), roughness=0.3, metallic=0.2)
    mat_dome = get_or_create_material("MAT_CP2B_Gasometer_Dome", (0.20, 0.83, 0.60, 1.0), roughness=0.18, metallic=0.35)

    nodes = data.get("cp2b", {}).get("nodes", [])
    created_nodes = 0
    for n in nodes:
        lon, lat = n["coordinates"]
        if not (-47.245 <= lon <= -46.965 and -23.015 <= lat <= -22.745):
            continue
        nx, ny = project_to_blender_xy(lon, lat)
        nz = elev_to_blender_z(n.get("elevationM", 620))

        cat = n.get("category", "ETE_SANASA")
        is_plant = cat in ("BIOMETHANE_PLANT", "RESEARCH_HUB")
        is_ete = cat == "ETE_SANASA"
        rad = 0.38 if is_plant else (0.24 if is_ete else 0.15)
        h = 0.42 if is_plant else (0.26 if is_ete else 0.18)

        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=20, radius1=rad * 1.1, radius2=rad, depth=h)
        bmesh.ops.translate(bm, vec=(0.0, 0.0, h / 2.0), verts=bm.verts[:])
        if is_plant or is_ete:
            bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=rad * 0.85)
            # Translate sphere verts (last created verts)
            sphere_verts = bm.verts[-160:] if len(bm.verts) >= 160 else []
            bmesh.ops.translate(bm, vec=(0.0, 0.0, h), verts=sphere_verts)

        mesh = bpy.data.meshes.new(f"Mesh_CP2B_{n['nodeId']}")
        bm.to_mesh(mesh)
        bm.free()

        obj = bpy.data.objects.new(f"CP2B_{n['nodeId']}", mesh)
        obj.location = (nx, ny, nz)
        obj.data.materials.append(mat_plant if is_plant else (mat_ete if is_ete else mat_ind))
        obj["node_id"] = str(n["nodeId"])
        obj["name"] = str(n["name"])
        obj["category"] = str(cat)
        obj["biomethane_nm3_day"] = float(n.get("biomethaneNm3Day", 0))
        coll.objects.link(obj)
        created_nodes += 1

    print(f"[MCP-BLENDER] -> Parte 5 concluída: {created_nodes} instalações CP2B 3D modeladas.")

def render_preview(part_label):
    out_png = os.path.join(MODELS_DIR, f"preview_{part_label}.png")
    bpy.context.scene.render.filepath = out_png
    bpy.ops.render.render(write_still=True)
    print(f"[MCP-BLENDER] -> Preview arquitetônico salvo em: {out_png}")

def export_glb():
    print(f"[MCP-BLENDER] Exportando modelo 3D glTF binário (.glb) para o aplicativo web: {GLB_FILE_PATH}...")
    bpy.ops.export_scene.gltf(
        filepath=GLB_FILE_PATH,
        export_format="GLB",
        export_yup=True,
        export_extras=True,  # Exporta todas as Custom Properties (cd_setor, renda, node_id, highlight_role) para userData!
        export_cameras=False,
        export_lights=False,
    )
    size_mb = os.path.getsize(GLB_FILE_PATH) / (1024 * 1024)
    print(f"[MCP-BLENDER] -> Arquivo .glb exportado com sucesso ({size_mb:.2f} MB)!")

def build_part_interactive(part_name, do_render=False):
    if os.path.exists(BLEND_FILE_PATH) and part_name != "part1_dem" and part_name != "all":
        bpy.ops.wm.open_mainfile(filepath=BLEND_FILE_PATH)
    elif part_name == "part1_dem" or part_name == "all":
        bpy.ops.wm.read_factory_settings(use_empty=True)
        setup_studio_lighting_and_camera()

    with open(DATA_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    if part_name == "part1_dem":
        build_part1_dem(data)
    elif part_name == "part2_basemap":
        build_part2_basemap(data)
    elif part_name == "part3_censo":
        build_part3_censo(data)
    elif part_name == "part4_buildings":
        build_part4_buildings(data)
    elif part_name == "part5_cp2b":
        build_part5_cp2b(data)
    elif part_name == "export_glb":
        export_glb()
    elif part_name == "all":
        build_part1_dem(data)
        build_part2_basemap(data)
        build_part3_censo(data)
        build_part4_buildings(data)
        build_part5_cp2b(data)
        export_glb()
    elif part_name == "info":
        info = {
            "collections": [c.name for c in bpy.data.collections],
            "objects_count": len(bpy.data.objects),
            "materials": [m.name for m in bpy.data.materials],
        }
        print("[MCP-BLENDER] INFO:", json.dumps(info))
        return info

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_FILE_PATH)
    print(f"[MCP-BLENDER] -> Arquivo .blend salvo em: {BLEND_FILE_PATH}")

    if do_render:
        render_preview(part_name)

    return {"part": part_name, "blend_file": BLEND_FILE_PATH, "collections": [c.name for c in bpy.data.collections]}

if __name__ == "__main__":
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    part_arg = "all"
    do_render = "--render" in argv
    if "--part" in argv:
        idx = argv.index("--part")
        if idx + 1 < len(argv):
            part_arg = argv[idx + 1]
    build_part_interactive(part_arg, do_render=do_render)
