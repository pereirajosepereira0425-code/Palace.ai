import express from 'express';
import { apiRouter } from './routes.ts';

export const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Mount API router
app.use('/api', apiRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Palace.ai', timestamp: new Date().toISOString() });
});
