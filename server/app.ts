import express from 'express';
import { apiRouter } from './routes.ts';
import { getCharacters } from '../src/db/characters.ts';
import { buildRobotsTxt, buildSitemapXml } from '../src/utils/seoUtils.ts';

export const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

function resolveRequestOrigin(req: express.Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && /^https?:\/\//i.test(envUrl)) {
    return envUrl.replace(/\/+$/, '');
  }
  const hostHeader = req.get('host') || 'localhost:3000';
  const rawProto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const proto = Array.isArray(rawProto) ? rawProto[0] : String(rawProto).split(',')[0].trim();
  return `${proto}://${hostHeader}`;
}

// Search Engine Crawling & Indexing Endpoints
app.get('/robots.txt', (req, res) => {
  const origin = resolveRequestOrigin(req);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(buildRobotsTxt(origin));
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const origin = resolveRequestOrigin(req);
    const rows = await getCharacters({ limit: 500, offset: 0, sort: 'latest' });
    const xml = buildSitemapXml(
      origin,
      rows.map((r) => ({ uuid: r.uuid, updatedAt: r.createdAt }))
    );
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.send(xml);
  } catch (error) {
    console.error('Failed to build dynamic sitemap.xml:', error);
    const origin = resolveRequestOrigin(req);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(buildSitemapXml(origin, []));
  }
});

// Mount API router
app.use('/api', apiRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Palace.ai', timestamp: new Date().toISOString() });
});
