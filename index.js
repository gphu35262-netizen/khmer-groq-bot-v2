import http from 'http';
import './bot.js';

// Minimal HTTP server so Fly.io health-check does not timeout
const PORT = process.env.PORT || 8080;
http.createServer((_, res) => {
  res.writeHead(200);
  res.end('OK');
}).listen(PORT, () => {
  console.log(`[health] HTTP server listening on port ${PORT}`);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
  process.exit(1);
});
