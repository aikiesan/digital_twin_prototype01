#!/usr/bin/env node
// ============================================================================
// SERVIDOR MCP (Model Context Protocol - JSON-RPC 2.0 Stdio) PARA BLENDER 5.2
// Conecta o Agente Antigravity ao Blender 5.2 (via Live TCP Socket 9876 ou CLI)
// para modelar o Gêmeo Digital de Campinas parte por parte e exportar .glb
// ============================================================================

import net from 'node:net';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';

const WORKSPACE_DIR = 'c:/Users/Lucas/Documents/Digital_Twin_Modelling';
const BLENDER_EXE = process.env.BLENDER_EXE || 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const BLENDER_HOST = process.env.BLENDER_HOST || '127.0.0.1';
const BLENDER_PORT = Number(process.env.BLENDER_PORT || 9876);
const BUILDER_SCRIPT = path.join(WORKSPACE_DIR, 'blender_mcp/campinas_part_builder.py');
const BLEND_FILE = path.join(WORKSPACE_DIR, 'public/models/campinas_digital_twin.blend');

function sendLiveSocketCommand(payload, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let buffer = '';
    const timer = setTimeout(() => {
      client.destroy();
      reject(new Error('Socket timeout'));
    }, timeoutMs);

    client.connect(BLENDER_PORT, BLENDER_HOST, () => {
      client.write(JSON.stringify(payload) + '\n');
    });

    client.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (buffer.includes('\n')) {
        clearTimeout(timer);
        client.destroy();
        try {
          resolve(JSON.parse(buffer.trim()));
        } catch (err) {
          reject(err);
        }
      }
    });

    client.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function runBlenderCliPart(partName, extraArgs = []) {
  const args = ['--background', '--python', BUILDER_SCRIPT, '--', '--part', partName, ...extraArgs];
  const res = spawnSync(BLENDER_EXE, args, {
    cwd: WORKSPACE_DIR,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });
  return {
    exitCode: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

const TOOLS = [
  {
    name: 'blender_build_campinas_part',
    description:
      'Builds a specific 3D layer/part of the Campinas Digital Twin in Blender 5.2 (part1_dem, part2_basemap, part3_censo, part4_buildings, part5_cp2b, or export_glb) and renders a preview PNG.',
    inputSchema: {
      type: 'object',
      properties: {
        part: {
          type: 'string',
          enum: ['part1_dem', 'part2_basemap', 'part3_censo', 'part4_buildings', 'part5_cp2b', 'export_glb', 'all'],
          description: 'Which part of the Campinas 3D model to build in Blender 5.2',
        },
        render_preview: {
          type: 'boolean',
          description: 'Whether to render a preview PNG of the scene after building the part',
        },
      },
      required: ['part'],
    },
  },
  {
    name: 'blender_get_scene_info',
    description: 'Returns the list of collections, objects, materials, and custom properties in the Campinas Blender 5.2 file.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'blender_execute_python',
    description: 'Executes custom bpy Python code inside Blender 5.2 on the Campinas Digital Twin scene.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Python code using bpy to execute in Blender 5.2',
        },
      },
      required: ['code'],
    },
  },
];

async function handleToolCall(name, args = {}) {
  if (name === 'blender_build_campinas_part') {
    const part = args.part || 'part1_dem';
    try {
      const liveRes = await sendLiveSocketCommand({ action: 'build_part', part });
      return {
        content: [{ type: 'text', text: JSON.stringify({ mode: 'live_gui_socket', ...liveRes }, null, 2) }],
      };
    } catch {
      const cliFlags = args.render_preview ? ['--render'] : [];
      const cliRes = runBlenderCliPart(part, cliFlags);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                mode: 'blender_5.2_cli',
                blendFile: BLEND_FILE,
                part,
                exitCode: cliRes.exitCode,
                output: cliRes.stdout.split('\n').filter((l) => l.includes('[MCP-BLENDER]') || l.includes('Saved:')).join('\n'),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  if (name === 'blender_get_scene_info') {
    try {
      const liveRes = await sendLiveSocketCommand({ action: 'get_scene_info' });
      return { content: [{ type: 'text', text: JSON.stringify(liveRes, null, 2) }] };
    } catch {
      const cliRes = runBlenderCliPart('info');
      return { content: [{ type: 'text', text: cliRes.stdout }] };
    }
  }

  if (name === 'blender_execute_python') {
    try {
      const liveRes = await sendLiveSocketCommand({ action: 'exec_python', code: args.code });
      return { content: [{ type: 'text', text: JSON.stringify(liveRes, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Live socket offline (${e.message}); use blender_build_campinas_part.` }] };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', async (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return;
  }

  const { id, method, params } = req;

  try {
    if (method === 'initialize') {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'blender-campinas-twin', version: '1.0.0' },
          },
        }) + '\n'
      );
    } else if (method === 'notifications/initialized') {
      // No response needed
    } else if (method === 'tools/list') {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result: { tools: TOOLS } }) + '\n');
    } else if (method === 'tools/call') {
      const result = await handleToolCall(params.name, params.arguments);
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
    } else if (id !== undefined) {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result: {} }) + '\n');
    }
  } catch (err) {
    if (id !== undefined) {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: { code: -32000, message: err.message },
        }) + '\n'
      );
    }
  }
});
