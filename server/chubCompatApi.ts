import express from 'express';
import { CHUB_ACTIVE_MODELS } from '../src/utils/chubOptions.ts';
import { generateChubCompatibleCompletion } from '../src/services/aiService.ts';
import { getCharacters } from '../src/db/characters.ts';
import { generateFreePalaceApiKey } from '../src/utils/settingsSync.ts';

/**
 * Chub.ai-Compatible REST & OpenAI Chat Completions Router
 * Matches Chub.ai endpoints:
 * - GET  /v1/models, /inference/models, /soji/v1/models, /chub/asha/v1/models, /mix/v1/models
 * - POST /v1/chat/completions (+ /soji/v1/chat/completions, /chub/asha/v1/chat/completions, /chub/soji/v1/chat/completions, /mix/v1/chat/completions)
 * - GET  /inference/characters, /api/v1/characters
 *
 * Accepts both `CH-API-KEY` and `Authorization: Bearer ...` (or no key at all),
 * with 100% free unlimited access and zero credit limits.
 */
export const chubCompatRouter = express.Router();

// CORS matching Chub.ai gateways (allows SillyTavern & browser clients)
chubCompatRouter.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, CH-API-KEY, Accept, X-Requested-With'
  );
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

const CHUB_CORE_MODEL_IDS = [
  'claude-opus-5-5',
  'mars',
  'mercury',
  'soji',
  'asha',
  'mythomax',
  'gemini-3.8-flash',
  'gemini-4-argon',
];

export function buildChubModelsPayload() {
  const created = 1700000000;
  const catalogIds = CHUB_ACTIVE_MODELS.map((m) => m.id);
  const allIds = Array.from(new Set([...CHUB_CORE_MODEL_IDS, ...catalogIds]));

  return {
    object: 'list',
    data: allIds.map((id) => ({
      id,
      object: 'model',
      created,
      owned_by: 'palace-chub-free',
      permission: [],
      root: id,
      parent: null,
      free: true,
      credit_cost: 0,
    })),
  };
}

const handleListModels = (_req: express.Request, res: express.Response) => {
  res.json(buildChubModelsPayload());
};

const handleChatCompletions = async (req: express.Request, res: express.Response) => {
  try {
    const body = req.body || {};
    const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : 'mars';
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
      return res.status(400).json({
        error: {
          message: 'messages array is required and must contain at least one message.',
          type: 'invalid_request_error',
          code: 'BAD_REQUEST',
        },
      });
    }

    const result = await generateChubCompatibleCompletion({
      model,
      messages,
      temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
      topP: typeof body.top_p === 'number' ? body.top_p : undefined,
      topK: typeof body.top_k === 'number' ? body.top_k : undefined,
      maxTokens: typeof body.max_tokens === 'number' ? body.max_tokens : undefined,
      stop: Array.isArray(body.stop)
        ? body.stop.map(String)
        : typeof body.stop === 'string' && body.stop.trim()
          ? [body.stop.trim()]
          : undefined,
    });

    const completionId = `chatcmpl-palace-${Date.now().toString(36)}`;
    const created = Math.floor(Date.now() / 1000);

    if (body.stream === true) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');

      const roleChunk = {
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model: result.modelUsed,
        choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
      };
      res.write(`data: ${JSON.stringify(roleChunk)}\n\n`);

      // Stream text cleanly in word/clause chunks matching OpenAI/Chub SSE chunks
      const tokens = result.content.match(/\S+\s*/g) || [result.content];
      for (const tok of tokens) {
        const chunk = {
          id: completionId,
          object: 'chat.completion.chunk',
          created,
          model: result.modelUsed,
          choices: [{ index: 0, delta: { content: tok }, finish_reason: null }],
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      const stopChunk = {
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model: result.modelUsed,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      };
      res.write(`data: ${JSON.stringify(stopChunk)}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    return res.json({
      id: completionId,
      object: 'chat.completion',
      created,
      model: result.modelUsed,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.content,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: result.promptTokens,
        completion_tokens: result.completionTokens,
        total_tokens: result.promptTokens + result.completionTokens,
      },
      chub_compat: {
        credits_remaining: 'unlimited',
        free: true,
      },
    });
  } catch (err: any) {
    console.error('Chub-compat /v1/chat/completions error:', err);
    return res.status(500).json({
      error: {
        message: err?.message || 'Chat completion failed',
        type: 'server_error',
      },
    });
  }
};

const handleListChubCharacters = async (req: express.Request, res: express.Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || req.query.per_page || '20'), 10) || 20));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const offset = (page - 1) * limit;

    const rows = await getCharacters({ search, limit, offset, sort: 'popular' });
    const formatted = rows.map((c) => {
      let topics: string[] = [];
      try {
        topics = typeof c.tags === 'string' ? JSON.parse(c.tags) : Array.isArray(c.tags) ? c.tags : [];
      } catch {
        topics = [];
      }
      return {
        id: c.uuid,
        uuid: c.uuid,
        name: c.name,
        tagline: c.tagline,
        description: c.description,
        creator: c.creatorName || 'Community',
        avatar_url: c.avatar,
        topics,
        rating: c.rating,
        created_at: c.createdAt,
        updated_at: c.createdAt,
      };
    });

    res.json({
      data: formatted,
      pagination: {
        total: formatted.length,
        per_page: limit,
        current_page: page,
        total_pages: Math.max(1, Math.ceil(formatted.length / limit)),
      },
    });
  } catch (err: any) {
    console.error('Chub-compat /inference/characters error:', err);
    res.status(500).json({ error: { message: 'Failed to list characters' } });
  }
};

const handleIssueFreeKey = (req: express.Request, res: express.Response) => {
  const hostHeader = req.get('host') || 'localhost:3000';
  const rawProto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const proto = Array.isArray(rawProto) ? rawProto[0] : String(rawProto).split(',')[0].trim();
  const origin = `${proto}://${hostHeader}`;
  const key = generateFreePalaceApiKey();
  const modelsPayload = buildChubModelsPayload();

  res.json({
    ok: true,
    key,
    token: key,
    endpoint: `${origin}/v1`,
    modelsUrl: `${origin}/v1/models`,
    models: modelsPayload.data.map((m) => m.id),
    tier: 'free_unlimited',
    credits: 'unlimited',
    free: true,
    message: 'Issued unlimited free Palace Chub-compatible API key (zero credit limits)!',
  });
};

const handleVerifyUserToken = (_req: express.Request, res: express.Response) => {
  res.json({
    valid: true,
    ok: true,
    tier: 'free_unlimited',
    credits: 'unlimited',
    remaining_credits: 999999999,
    subscriptions: ['mars', 'mercury', 'soji', 'asha', 'claude-opus-5-5'],
    free: true,
  });
};

// Standard OpenAI & Chub.ai Inference endpoints
chubCompatRouter.get('/v1/models', handleListModels);
chubCompatRouter.get('/api/v1/models', handleListModels);
chubCompatRouter.get('/inference/models', handleListModels);
chubCompatRouter.get('/soji/v1/models', handleListModels);
chubCompatRouter.get('/chub/asha/v1/models', handleListModels);
chubCompatRouter.get('/chub/soji/v1/models', handleListModels);
chubCompatRouter.get('/mix/v1/models', handleListModels);

chubCompatRouter.post('/v1/keys/free', handleIssueFreeKey);
chubCompatRouter.post('/api/v1/keys/free', handleIssueFreeKey);
chubCompatRouter.get('/v1/keys/free', handleIssueFreeKey);
chubCompatRouter.get('/users/verify', handleVerifyUserToken);
chubCompatRouter.post('/users/verify', handleVerifyUserToken);
chubCompatRouter.get('/v1/users/verify', handleVerifyUserToken);
chubCompatRouter.post('/v1/users/verify', handleVerifyUserToken);
chubCompatRouter.get('/api/users/verify', handleVerifyUserToken);
chubCompatRouter.post('/api/users/verify', handleVerifyUserToken);

chubCompatRouter.post('/v1/chat/completions', handleChatCompletions);
chubCompatRouter.post('/api/v1/chat/completions', handleChatCompletions);
chubCompatRouter.post('/soji/v1/chat/completions', handleChatCompletions);
chubCompatRouter.post('/chub/asha/v1/chat/completions', handleChatCompletions);
chubCompatRouter.post('/chub/soji/v1/chat/completions', handleChatCompletions);
chubCompatRouter.post('/mix/v1/chat/completions', handleChatCompletions);

chubCompatRouter.get('/inference/characters', handleListChubCharacters);
chubCompatRouter.get('/api/v1/characters', handleListChubCharacters);
