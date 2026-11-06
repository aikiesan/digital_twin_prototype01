import net from 'net';

const HOST = '127.0.0.1';
const PORT = 9876;

const client = new net.Socket();
client.setTimeout(3000);

client.connect(PORT, HOST, () => {
  console.log(`Conectado ao Blender 5.2 Live MCP em ${HOST}:${PORT}! Consultando cena aberta...`);
  client.write(JSON.stringify({ action: 'get_scene_info' }) + '\n');
});

client.on('data', (data) => {
  const response = JSON.parse(data.toString().trim());
  console.log('\n=== RESPOSTA DO BLENDER 5.2 VIA MCP ===');
  console.log(JSON.stringify(response, null, 2));
  client.destroy();
});

client.on('error', (err) => {
  console.error(`\n[!] Blender 5.2 Live MCP ainda não está ouvindo na porta ${PORT} (${err.message}).`);
  console.error('Abra o Blender com o comando Git Bash fornecido primeiro.');
  process.exit(1);
});
