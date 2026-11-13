import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import express from 'express';
import { app } from './server/app.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getPort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = Number(process.argv[portArgIndex + 1]);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return Number(process.env.PORT) || 3000;
}

const PORT = getPort();

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const distHtmlPath = path.join(__dirname, 'dist', 'index.html');
  const hasDist = fs.existsSync(distHtmlPath);

  if (!isProduction || !hasDist) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('⚡ Vite dev middleware mounted');
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(distHtmlPath);
    });
    console.log('📦 Serving static production build from dist');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`👑 Palace.ai server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Palace.ai server:', err);
  process.exit(1);
});
