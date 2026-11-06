# ============================================================================
# PILOTO 01 - Unicamp + Barão Geraldo | Basemap PLANO de ruas e água
# Blender 5.2  ->  public/models/pilot01_barao_geraldo.blend / .glb
#
# Uso (headless):
#   blender -b --factory-startup --python blender_mcp/pilot01_basemap.py -- [--render DIR]
#
# Unidades: 1 BU = 1 metro. Origem = centro do recorte.
# Visual plano (z apenas para empilhar camadas). A cota real do DEM fica no
# atributo de vértice "cota_m" de cada malha.
# ============================================================================
import bpy, bmesh, json, math, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA = os.path.join(ROOT, 'public', 'data', 'pilot01_barao_geraldo.json')
OUT_BLEND = os.path.join(ROOT, 'public', 'models', 'pilot01_barao_geraldo.blend')
OUT_GLB = os.path.join(ROOT, 'public', 'models', 'pilot01_barao_geraldo.glb')

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RENDER_DIR = os.path.abspath(argv[argv.index('--render') + 1]) if '--render' in argv else None

with open(DATA, encoding='utf-8') as f:
    D = json.load(f)

# ---------------------------------------------------------------- projeção --
LON0, LAT0 = D['meta']['centro']
phi = math.radians(LAT0)
M_LAT = 111132.92 - 559.82 * math.cos(2 * phi) + 1.175 * math.cos(4 * phi)
M_LON = 111412.84 * math.cos(phi) - 93.5 * math.cos(3 * phi)

def proj(lon, lat):
    return ((lon - LON0) * M_LON, (lat - LAT0) * M_LAT)

# ------------------------------------------------------------------ estilo --
# (cor RGB 0-1, z da camada)
def hexc(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c]  # sRGB -> linear

STYLE = {
    'base':       ('#E4E1DA', 0.00),
    'agua_area':  ('#A8C8E1', 0.4),
    'agua_linha': ('#A8C8E1', 0.8),
    'pedestres':  ('#CFC8BC', 1.2),
    'servico':    ('#F4F2EE', 1.6),
    'locais':     ('#FFFFFF', 2.0),
    'casing':     ('#B9B3A8', 2.4),
    'coletoras':  ('#FFF4D6', 2.8),
    'arteriais':  ('#FBDD9A', 3.2),
    'rodovias':   ('#F2A97E', 3.6),
}
BRIDGE_DZ = 2.0    # pontes/viadutos ficam por cima no plano

def road_width(tier, fc):
    link = fc.endswith('_link')
    if tier == 'rodovias':  return 9.0 if link else (22.0 if fc.startswith('motorway') else 18.0)
    if tier == 'arteriais': return 7.0 if link else 14.0
    if tier == 'coletoras': return 6.0 if link else (11.0 if fc.startswith('secondary') else 9.0)
    if tier == 'locais':    return 7.0
    if tier == 'servico':   return 4.5
    return 2.0  # pedestres
CASING_EXTRA = 3.0  # contorno das vias principais (m a mais na largura)

def waterway_width(fc):
    return {'river': 14.0, 'canal': 6.0, 'stream': 4.0, 'drain': 2.5, 'ditch': 2.0}.get(fc, 3.0)

# ----------------------------------------------------------------- limpeza --
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

def coll(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or scene.collection).children.link(c)
    return c

MATS = {}
def mat(key):
    if key in MATS: return MATS[key]
    col = hexc(STYLE[key][0])
    m = bpy.data.materials.new(f'MAT_{key}')
    m.diffuse_color = (*col, 1.0)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*col, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.9
    MATS[key] = m
    return m

# -------------------------------------------------- geometria de faixas -----
def ribbon(bm, pts, width, z, cota_layer, cotas, idx_layer, idx):
    """Gera faixa plana com juntas em meia-esquadria (miter) ao longo da polilinha."""
    # remove pontos duplicados consecutivos
    P, C = [], []
    for p, c in zip(pts, cotas):
        if not P or (abs(p[0] - P[-1][0]) > 1e-3 or abs(p[1] - P[-1][1]) > 1e-3):
            P.append(p); C.append(c)
    if len(P) < 2: return
    hw = width / 2
    left, right = [], []
    n = len(P)
    for i in range(n):
        if i == 0:
            dx, dy = P[1][0] - P[0][0], P[1][1] - P[0][1]
            L = math.hypot(dx, dy); nx, ny = -dy / L, dx / L; s = hw
        elif i == n - 1:
            dx, dy = P[-1][0] - P[-2][0], P[-1][1] - P[-2][1]
            L = math.hypot(dx, dy); nx, ny = -dy / L, dx / L; s = hw
        else:
            ax, ay = P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]
            bx, by = P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]
            la, lb = math.hypot(ax, ay), math.hypot(bx, by)
            n1 = (-ay / la, ax / la); n2 = (-by / lb, bx / lb)
            mx, my = n1[0] + n2[0], n1[1] + n2[1]
            ml = math.hypot(mx, my)
            if ml < 1e-6:
                nx, ny, s = n1[0], n1[1], hw
            else:
                nx, ny = mx / ml, my / ml
                cos_half = nx * n1[0] + ny * n1[1]
                s = min(hw / max(cos_half, 1e-3), hw * 2.5)  # limita esquadria
        left.append(bm.verts.new((P[i][0] + nx * s, P[i][1] + ny * s, z)))
        right.append(bm.verts.new((P[i][0] - nx * s, P[i][1] - ny * s, z)))
        for v in (left[-1], right[-1]):
            v[cota_layer] = C[i] if C[i] is not None else 0.0
    for i in range(n - 1):
        f = bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
        f[idx_layer] = idx

def new_mesh_obj(name, collection, material):
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    me.materials.append(material)
    return ob, me

def begin_bm():
    bm = bmesh.new()
    cota = bm.verts.layers.float.new('cota_m')
    idx = bm.faces.layers.int.new('seg_idx')
    return bm, cota, idx

def finish(bm, me):
    bm.normal_update()
    bm.to_mesh(me); bm.free()
    me.update()

# --------------------------------------------------------------- coleções ---
C_CAM   = coll('00_CAMERA_E_LUZ')
C_BASE  = coll('01_BASE_PLANA')
C_AGUA  = coll('02_HIDROGRAFIA')
C_VIAS  = coll('03_SISTEMA_VIARIO')
C_TUNEL = coll('99_TUNEIS_OCULTOS')

stats = {}

# ------------------------------------------------------------- base plana ---
bb = D['meta']['bbox']
x0, y0 = proj(bb[0], bb[1]); x1, y1 = proj(bb[2], bb[3])
ob, me = new_mesh_obj('Base_Plana_Recorte', C_BASE, mat('base'))
me.from_pydata([(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)], [], [(0, 1, 2, 3)])
ob['bbox_lonlat'] = json.dumps(bb)

# -------------------------------------------------------- espelhos d'água ---
ob, me = new_mesh_obj('Agua_Lagos_Represas', C_AGUA, mat('agua_area'))
bm, cota, idx = begin_bm()
z = STYLE['agua_area'][1]; n_lagos = 0
for i, w in enumerate(D['waterAreas']):
    if w['fclass'] in ('swimming_pool',) or 'piscina' in w['name'].lower():
        continue
    ring = [proj(c[0], c[1]) for c in w['ring']]
    area = 0.5 * abs(sum(ring[k][0] * ring[(k + 1) % len(ring)][1] - ring[(k + 1) % len(ring)][0] * ring[k][1] for k in range(len(ring))))
    if area < 200: continue
    vs = []
    for (x, y), c in zip(ring, w['ring']):
        v = bm.verts.new((x, y, z)); v[cota] = c[2] or 0.0; vs.append(v)
    try:
        f = bm.faces.new(vs); f[idx] = i; n_lagos += 1
    except ValueError:
        pass
bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='BEAUTY', ngon_method='EAR_CLIP')
finish(bm, me); stats['lagos'] = n_lagos

# ------------------------------------------------------- cursos d'água ------
ob, me = new_mesh_obj('Agua_Rios_Corregos', C_AGUA, mat('agua_linha'))
bm, cota, idx = begin_bm()
for i, w in enumerate(D['waterways']):
    pts = [proj(c[0], c[1]) for c in w['coords']]
    ribbon(bm, pts, waterway_width(w['fclass']), STYLE['agua_linha'][1], cota, [c[2] for c in w['coords']], idx, i)
finish(bm, me); stats['cursos_agua'] = len(D['waterways'])

# ---------------------------------------------------------------- vias ------
TIERS = [  # ordem de baixo para cima
    ('pedestres', '06_Pedestres_Ciclovias_Trilhas'),
    ('servico',   '05_Vias_de_Servico_e_Campus'),
    ('locais',    '04_Ruas_Locais'),
    ('coletoras', '03_Vias_Coletoras'),
    ('arteriais', '02_Avenidas_Arteriais'),
    ('rodovias',  '01_Rodovias'),
]
CASED = {'coletoras', 'arteriais', 'rodovias'}

bm_cas, cas_cota, cas_idx = begin_bm()
bm_tun, tun_cota, tun_idx = begin_bm()
for tier, label in TIERS:
    segs = D['roads'][tier]
    c = coll(label, C_VIAS)
    ob, me = new_mesh_obj(f'Vias_{tier}', c, mat(tier))
    ob['fonte'] = D['meta']['fonte_vias']
    ob['seg_idx_ref'] = f"pilot01_barao_geraldo.json -> roads.{tier}[seg_idx]"
    bm, cota, idx = begin_bm()
    for i, s in enumerate(segs):
        pts = [proj(p[0], p[1]) for p in s['coords']]
        cot = [p[2] for p in s['coords']]
        w = road_width(tier, s['fclass'])
        if s['tunnel']:
            ribbon(bm_tun, pts, w, STYLE[tier][1], tun_cota, cot, tun_idx, i); continue
        dz = BRIDGE_DZ if (s['bridge'] or s['layer'] > 0) else 0.0
        ribbon(bm, pts, w, STYLE[tier][1] + dz, cota, cot, idx, i)
        if tier in CASED:
            ribbon(bm_cas, pts, w + CASING_EXTRA, STYLE['casing'][1] + dz, cas_cota, cot, cas_idx, i)
    finish(bm, me)
    stats[tier] = len(segs)

ob, me = new_mesh_obj('Vias_Contorno_Principais', C_VIAS, mat('casing'))
finish(bm_cas, me)
ob, me = new_mesh_obj('Vias_Tuneis', C_TUNEL, mat('servico'))
finish(bm_tun, me)
ob.hide_viewport = True; ob.hide_render = True

# -------------------------------------------------------- câmera e luz ------
world = bpy.data.worlds.new('World'); scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (*hexc('#F3F1EC'), 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0

sun_d = bpy.data.lights.new('Sol', 'SUN'); sun_d.energy = 3.0; sun_d.angle = math.radians(8)
sun = bpy.data.objects.new('Sol', sun_d); C_CAM.objects.link(sun)
sun.rotation_euler = (math.radians(35), 0, math.radians(30))

W, H = x1 - x0, y1 - y0
cam_top_d = bpy.data.cameras.new('Cam_Planta'); cam_top_d.type = 'ORTHO'
cam_top_d.ortho_scale = max(W, H) * 1.02; cam_top_d.clip_end = 50000
cam_top = bpy.data.objects.new('Cam_Planta', cam_top_d); C_CAM.objects.link(cam_top)
cam_top.location = ((x0 + x1) / 2, (y0 + y1) / 2, 3000)

cam_obl_d = bpy.data.cameras.new('Cam_Obliqua_Unicamp'); cam_obl_d.lens = 35; cam_obl_d.clip_start = 20; cam_obl_d.clip_end = 50000
cam_obl = bpy.data.objects.new('Cam_Obliqua_Unicamp', cam_obl_d); C_CAM.objects.link(cam_obl)
# Unicamp ~ (-47.0690, -22.8175)
ux, uy = proj(-47.0690, -22.8175)
cam_obl.location = (ux + 1400, uy - 2600, 1900)
direction = (ux - cam_obl.location[0], uy - cam_obl.location[1], 0 - cam_obl.location[2])
from mathutils import Vector
cam_obl.rotation_euler = Vector(direction).to_track_quat('-Z', 'Y').to_euler()

scene.camera = cam_top

# --------------------------------------------------------------- salvar -----
scene['piloto'] = D['meta']['piloto']
scene['projecao'] = f"Equiretangular local | centro lon={LON0} lat={LAT0} | m/grau lon={M_LON:.2f} lat={M_LAT:.2f}"
os.makedirs(os.path.dirname(OUT_BLEND), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB', use_visible=True, export_yup=True,
                          export_cameras=False, export_lights=False, export_attributes=True)

print('[PILOTO01] ' + json.dumps(stats, ensure_ascii=False))
print(f'[PILOTO01] Recorte {W:.0f} m x {H:.0f} m')

# --------------------------------------------------------------- render -----
if RENDER_DIR:
    os.makedirs(RENDER_DIR, exist_ok=True)
    r = scene.render
    r.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'FLAT'
    scene.display.shading.color_type = 'MATERIAL'
    scene.view_settings.view_transform = 'Standard'
    r.resolution_x = r.resolution_y = 2400
    r.film_transparent = False
    scene.camera = cam_top
    r.filepath = os.path.join(RENDER_DIR, 'pilot01_planta.png')
    bpy.ops.render.render(write_still=True)

    r.resolution_x, r.resolution_y = 2400, 1500
    scene.camera = cam_obl
    r.filepath = os.path.join(RENDER_DIR, 'pilot01_obliqua_unicamp.png')
    bpy.ops.render.render(write_still=True)
    print('[PILOTO01] Renders salvos em ' + RENDER_DIR)

