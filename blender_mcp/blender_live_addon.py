# ============================================================================
# BLENDER 5.2 LIVE MCP BRIDGE ADDON (TCP Socket 127.0.0.1:9876)
# Permite que o Agente / MCP execute comandos bpy em tempo real dentro da
# janela aberta do Blender 5.2 e acompanhe a construÃ§Ã£o parte por parte.
# ============================================================================

bl_info = {
    "name": "Campinas Digital Twin - Blender MCP Live Bridge",
    "author": "NIPE / UNICAMP - CP2B Digital Twin",
    "version": (1, 0, 0),
    "blender": (5, 0, 0),
    "location": "View3D > Sidebar > Campinas MCP",
    "description": "Live TCP Socket Bridge (port 9876) for AI Agent part-by-part 3D city generation",
    "category": "3D View",
}

import bpy
import socket
import threading
import json
import traceback
import queue

HOST = "127.0.0.1"
PORT = 9876
cmd_queue = queue.Queue()

def execute_queued_commands():
    while not cmd_queue.empty():
        conn, payload = cmd_queue.get()
        try:
            action = payload.get("action", "exec")
            if action == "get_scene_info":
                info = {
                    "blend_file": bpy.data.filepath or "unsaved",
                    "collections": [c.name for c in bpy.data.collections],
                    "objects_count": len(bpy.data.objects),
                    "materials": [m.name for m in bpy.data.materials],
                }
                conn.sendall((json.dumps({"status": "ok", "data": info}) + "\n").encode("utf-8"))
            elif action == "build_part":
                part = payload.get("part", "part1_dem")
                import sys, os
                script_dir = os.path.dirname(os.path.abspath(__file__))
                if script_dir not in sys.path:
                    sys.path.append(script_dir)
                import campinas_part_builder
                import importlib
                importlib.reload(campinas_part_builder)
                res = campinas_part_builder.build_part_interactive(part)
                conn.sendall((json.dumps({"status": "ok", "result": res}) + "\n").encode("utf-8"))
            elif action == "exec_python":
                code = payload.get("code", "")
                loc = {}
                exec(code, {"bpy": bpy}, loc)
                conn.sendall((json.dumps({"status": "ok", "result": str(loc.get("result", "executed"))}) + "\n").encode("utf-8"))
        except Exception as e:
            err = traceback.format_exc()
            try:
                conn.sendall((json.dumps({"status": "error", "error": str(e), "traceback": err}) + "\n").encode("utf-8"))
            except Exception:
                pass
        finally:
            try:
                conn.close()
            except Exception:
                pass
    return 0.15  # Run every 150ms in Blender main thread

def socket_listener_thread():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((HOST, PORT))
    server.listen(5)
    print(f"[Campinas Blender MCP] Listening on {HOST}:{PORT}...")
    while True:
        conn, addr = server.accept()
        data = b""
        while True:
            chunk = conn.recv(65536)
            if not chunk:
                break
            data += chunk
            if b"\n" in chunk:
                break
        try:
            payload = json.loads(data.decode("utf-8").strip())
            cmd_queue.put((conn, payload))
        except Exception as e:
            conn.sendall((json.dumps({"status": "error", "error": str(e)}) + "\n").encode("utf-8"))
            conn.close()

def configure_viewport_shading():
    try:
        for window in bpy.context.window_manager.windows:
            for area in window.screen.areas:
                if area.type == 'VIEW_3D':
                    for space in area.spaces:
                        if space.type == 'VIEW_3D':
                            space.shading.type = 'MATERIAL'
                            space.clip_start = 1.0
                            space.clip_end = 50000.0
    except Exception:
        pass
    return None

def start_mcp_bridge():
    t = threading.Thread(target=socket_listener_thread, daemon=True)
    t.start()
    if not bpy.app.timers.is_registered(execute_queued_commands):
        bpy.app.timers.register(execute_queued_commands, persistent=True)
    bpy.app.timers.register(configure_viewport_shading, first_interval=0.5)

if __name__ == "__main__":
    start_mcp_bridge()

