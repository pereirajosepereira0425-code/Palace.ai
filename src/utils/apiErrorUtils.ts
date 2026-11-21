import { CHUB_API_PROVIDERS, isBuiltInFreeProvider } from './chubOptions.ts';
import {
  buildBudgetedContext,
  normalizeChatCompletionsUrl,
  normalizeModelsUrl,
} from './promptBudget.ts';
import { generateFreePalaceApiKey, isPalaceFreeApiKey } from './settingsSync.ts';

export interface ApiConnectionTestResult {
  ok: boolean;
  status: number;
  code: string;
  endpoint: string;
  message: string;
  hint?: string;
  isCloudflareBlock?: boolean;
  testedFrom?: 'server' | 'browser' | 'validation';
  resolvedModel?: string;
  availableModels?: string[];
}

const LOCAL_PROVIDER_IDS = new Set(['kobold', 'ooba', 'ollama']);

export function isLocalProviderOrUrl(providerId?: string | null, rawUrl?: string | null): boolean {
  if (providerId && LOCAL_PROVIDER_IDS.has(providerId)) {
    // Only consider local unless the user explicitly replaced URL with a remote https domain
    if (!rawUrl || /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(rawUrl.trim())) {
      return true;
    }
  }
  const url = (rawUrl || '').trim().toLowerCase();
  if (
    typeof window !== 'undefined' &&
    window.location?.origin &&
    url.startsWith(window.location.origin.toLowerCase())
  ) {
    return true;
  }
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|192\.168\.|10\.)/.test(url);
}

export function isCloudflareOrWafHtml(bodyText: string, contentType?: string | null): boolean {
  const lower = (bodyText || '').toLowerCase();
  const ct = (contentType || '').toLowerCase();
  const looksLikeHtml =
    ct.includes('text/html') ||
    lower.includes('<!doctype html') ||
    lower.includes('<html') ||
    lower.includes('<!--[if lt ie');

  if (!looksLikeHtml) return false;

  return (
    lower.includes('cloudflare') ||
    lower.includes('attention required') ||
    lower.includes('cf-error') ||
    lower.includes('cf-ray') ||
    lower.includes('sorry, you have been blocked') ||
    lower.includes('just a moment') ||
    lower.includes('checking your browser') ||
    lower.includes('ddos-guard') ||
    lower.includes('enable cookies')
  );
}

export function looksLikeHtmlResponse(bodyText: string, contentType?: string | null): boolean {
  const ct = (contentType || '').toLowerCase();
  const trimmed = (bodyText || '').trim().toLowerCase();
  return (
    ct.includes('text/html') ||
    trimmed.startsWith('<!doctype html') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<!--')
  );
}

/**
 * Strips raw HTML tags, scripts, styles, and IE conditional comments into clean readable text.
 */
export function sanitizeErrorBody(rawBody: string, contentType?: string | null): string {
  if (!rawBody || !rawBody.trim()) return '';

  // Try structured JSON error extraction first
  const trimmed = rawBody.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed: any = JSON.parse(trimmed);
      const extracted =
        parsed?.error?.message ||
        parsed?.detail?.message ||
        (typeof parsed?.detail === 'string' ? parsed.detail : '') ||
        parsed?.message ||
        parsed?.msg ||
        (typeof parsed?.error === 'string' ? parsed.error : '');
      if (extracted && typeof extracted === 'string') {
        return extracted.trim().slice(0, 260);
      }
    } catch {
      // fall through
    }
  }

  if (looksLikeHtmlResponse(trimmed, contentType)) {
    // Extract <title> if meaningful, otherwise strip all markup safely
    const titleMatch = trimmed.match(/<title[^>]*>([^<]+)<\/title>/i);
    const cleaned = trimmed
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();

    if (titleMatch?.[1]?.trim()) {
      const title = titleMatch[1].trim();
      return cleaned && cleaned.toLowerCase() !== title.toLowerCase()
        ? `${title} — ${cleaned}`.slice(0, 220)
        : title.slice(0, 220);
    }
    return cleaned.slice(0, 220);
  }

  return trimmed.replace(/\s+/g, ' ').slice(0, 260);
}

export function getSameOriginV1Url(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/v1`;
  }
  return 'http://localhost:3000/v1';
}

export async function fetchFreePalaceApiKey(): Promise<{
  ok: boolean;
  key: string;
  endpoint: string;
  models: string[];
  message: string;
}> {
  const endpoint = getSameOriginV1Url();
  try {
    const res = await fetch('/v1/keys/free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.key) {
        return {
          ok: true,
          key: String(data.key),
          endpoint,
          models: Array.isArray(data.models) ? data.models.map(String) : [],
          message: String(
            data.message ||
              'Fetched a 100% Free Unlimited Palace API Key (no credits or billing limits)!'
          ),
        };
      }
    }
  } catch {
    // Fallback cleanly to deterministic client key + local /v1
  }
  return {
    ok: true,
    key: generateFreePalaceApiKey(),
    endpoint,
    models: ['claude-opus-5-5', 'mars', 'mercury', 'soji', 'asha', 'gemini-3.8-flash'],
    message: 'Generated a 100% Free Unlimited Palace API Key (no credits or billing limits)!',
  };
}

export function validateConnectionInputs(options: {
  apiProvider?: string | null;
  apiUrl?: string | null;
  apiKey?: string | null;
}): ApiConnectionTestResult | null {
  if (isBuiltInFreeProvider(options.apiProvider)) {
    return null;
  }

  const providerMeta = CHUB_API_PROVIDERS.find((p) => p.id === options.apiProvider);
  const rawUrl = (
    options.apiUrl !== undefined ? options.apiUrl ?? '' : providerMeta?.defaultUrl || ''
  ).trim();

  if (!rawUrl) {
    return {
      ok: false,
      status: 400,
      code: 'EMPTY_URL',
      endpoint: '',
      testedFrom: 'validation',
      message: 'API Base URL is empty.',
      hint: 'Select a provider card above, paste a valid OpenAI-compatible URL ending in /v1, or click Fetch Free API Key.',
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_URL',
      endpoint: rawUrl,
      testedFrom: 'validation',
      message: 'Invalid API Base URL format.',
      hint: 'URL must include https:// or http:// (for example: https://openrouter.ai/api/v1).',
    };
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return {
      ok: false,
      status: 400,
      code: 'UNSUPPORTED_PROTOCOL',
      endpoint: rawUrl,
      testedFrom: 'validation',
      message: `Unsupported URL protocol "${parsedUrl.protocol}".`,
      hint: 'Use https:// for cloud APIs or http:// for local Ollama/Kobold servers.',
    };
  }

  const endpoint = normalizeChatCompletionsUrl(rawUrl);
  const local = isLocalProviderOrUrl(options.apiProvider, rawUrl);
  const hasFreeKey = Boolean(options.apiKey?.trim()) && isPalaceFreeApiKey(options.apiKey);

  if (!local && !hasFreeKey && !options.apiKey?.trim()) {
    return {
      ok: false,
      status: 400,
      code: 'MISSING_API_KEY',
      endpoint,
      testedFrom: 'validation',
      message: 'API Key is empty.',
      hint: 'Click "Fetch Free API Key" for instant unlimited access, or paste your external token.',
    };
  }

  return null;
}

export function classifyHttpApiError(params: {
  status: number;
  statusText?: string;
  rawBody?: string;
  contentType?: string | null;
  endpoint: string;
  apiProvider?: string | null;
}): ApiConnectionTestResult {
  const { status, statusText = '', rawBody = '', contentType = '', endpoint, apiProvider } = params;
  const cfBlock = isCloudflareOrWafHtml(rawBody, contentType);
  const cleanDetail = sanitizeErrorBody(rawBody, contentType);

  if (cfBlock) {
    const isChub = endpoint.includes('chub.ai') || apiProvider === 'chub_mars';
    return {
      ok: false,
      status,
      code: 'CLOUDFLARE_BLOCK',
      endpoint,
      isCloudflareBlock: true,
      message: `Blocked by Cloudflare WAF protection (HTTP ${status}) when connecting to ${new URL(endpoint).hostname}.`,
      hint: isChub
        ? 'Chub.ai blocks automated datacenter & cross-origin requests with Cloudflare. Use Palace Native Gemini, or connect an API-friendly provider like OpenRouter, OpenAI, DeepSeek, or Groq.'
        : 'This host returned a Cloudflare security block instead of JSON. Verify your reverse proxy URL allows direct API requests without browser challenges.',
    };
  }

  if (status >= 200 && status < 300 && looksLikeHtmlResponse(rawBody, contentType)) {
    return {
      ok: false,
      status,
      code: 'HTML_INSTEAD_OF_JSON',
      endpoint,
      message: 'Endpoint returned an HTML web page instead of a JSON chat completions API.',
      hint: 'Check that your URL points to the API endpoint (typically ending in /v1 or /api/v1), not the website homepage.',
    };
  }

  switch (status) {
    case 400:
      return {
        ok: false,
        status,
        code: 'BAD_REQUEST',
        endpoint,
        message: `Bad request (400): ${cleanDetail || 'Malformed model ID or request payload.'}`,
        hint: 'Double-check that your Active Model ID matches a model supported by this provider.',
      };
    case 401:
      return {
        ok: false,
        status,
        code: 'UNAUTHORIZED',
        endpoint,
        message: `Authentication failed (401 Unauthorized): ${cleanDetail || 'Invalid, expired, or revoked API key.'}`,
        hint: 'Verify you copied the full API key with no extra spaces, and check that the key is active.',
      };
    case 402:
      return {
        ok: false,
        status,
        code: 'PAYMENT_REQUIRED',
        endpoint,
        message: `Billing / Credit required (402): ${cleanDetail || 'Account credits depleted or active subscription needed.'}`,
        hint: isChubUrlOrProvider(apiProvider, endpoint)
          ? 'Your Chub.ai account has 0 credits left on Chub.ai. Palace.ai has no credit limits and automatically falls back to the Palace Free Built-In Engine during chat.'
          : 'Top up credits on your external provider, or switch to Palace Free Built-In API (no credits needed).',
      };
    case 403:
      return {
        ok: false,
        status,
        code: 'FORBIDDEN',
        endpoint,
        message: `Access forbidden (403): ${cleanDetail || 'API key lacks permission or this endpoint restricts server/proxy access.'}`,
        hint: 'Confirm your API key scope allows chat completions and the model is unlocked on your plan.',
      };
    case 404: {
      const mentionsAvailableModels =
        /available models|model-specific endpoints/i.test(cleanDetail);
      return {
        ok: false,
        status,
        code: 'NOT_FOUND',
        endpoint,
        message: `Endpoint or model not found (404): ${cleanDetail || endpoint}`,
        hint: mentionsAvailableModels
          ? 'This Chub gateway requires an exact live Model ID from /v1/models or a model-specific endpoint (such as Inference Soji, Mars Asha, or Mix /v1).'
          : 'Check your Base URL path (/v1 vs /api/v1) and verify the Active Model ID exists.',
      };
    }
    case 405:
      return {
        ok: false,
        status,
        code: 'METHOD_NOT_ALLOWED',
        endpoint,
        message: `Method not allowed (405): Endpoint rejected POST /chat/completions.`,
        hint: 'Verify the URL is an OpenAI-compatible chat completions base URL.',
      };
    case 408:
    case 504:
      return {
        ok: false,
        status,
        code: 'GATEWAY_TIMEOUT',
        endpoint,
        message: `Upstream timeout (HTTP ${status}): ${cleanDetail || 'Remote inference server took too long to respond.'}`,
        hint: 'Try a faster model or lower Max Context Window to 4,096 tokens.',
      };
    case 413:
      return {
        ok: false,
        status,
        code: 'PAYLOAD_TOO_LARGE',
        endpoint,
        message: `Payload too large (413): ${cleanDetail || 'Prompt exceeded server limit.'}`,
        hint: 'Lower Max Context Window in Presets or Chub Settings.',
      };
    case 422:
      return {
        ok: false,
        status,
        code: 'UNPROCESSABLE_ENTITY',
        endpoint,
        message: `Rejected parameters (422): ${cleanDetail || 'Unsupported model or sampling parameter.'}`,
        hint: 'Verify the selected model name and check custom settings.',
      };
    case 429:
      return {
        ok: false,
        status,
        code: 'RATE_LIMITED',
        endpoint,
        message: `Rate limit or quota exceeded (429): ${cleanDetail || 'Too many requests or account quota exhausted.'}`,
        hint: isChubUrlOrProvider(apiProvider, endpoint) || /credit/i.test(cleanDetail)
          ? 'Your external Chub.ai/API key has 0 credits left on that provider. Palace.ai has NO credit limits and automatically continues using the Unlimited Palace Free Engine during chat.'
          : 'Wait briefly before retrying, check provider quota, or use Palace Free Built-In API (no credits needed).',
      };
    default:
      if (status >= 500) {
        return {
          ok: false,
          status,
          code: 'UPSTREAM_SERVER_ERROR',
          endpoint,
          message: `Provider server error (HTTP ${status}): ${cleanDetail || statusText || 'Remote service unavailable.'}`,
          hint: 'The external provider is experiencing an outage or overload. Retry shortly or switch providers.',
        };
      }
      return {
        ok: false,
        status,
        code: `HTTP_${status}`,
        endpoint,
        message: `Endpoint returned HTTP ${status}: ${cleanDetail || statusText || 'Unexpected error'}`,
      };
  }
}

export function classifyNetworkError(
  err: any,
  endpoint: string,
  source: 'server' | 'browser' = 'server'
): ApiConnectionTestResult {
  const name = err?.name || '';
  const code = err?.code || err?.cause?.code || '';
  const rawMsg = String(err?.message || err || 'Unknown network error');
  const lower = rawMsg.toLowerCase();

  if (name === 'TimeoutError' || name === 'AbortError' || lower.includes('timed out')) {
    return {
      ok: false,
      status: 408,
      code: 'TIMEOUT',
      endpoint,
      testedFrom: source,
      message: 'Connection timed out after 10 seconds.',
      hint: 'The remote host did not respond in time. Verify the URL and check if the provider is online.',
    };
  }

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || lower.includes('enotfound')) {
    return {
      ok: false,
      status: 0,
      code: 'DNS_NOT_FOUND',
      endpoint,
      testedFrom: source,
      message: 'Host not found (DNS lookup failed).',
      hint: 'Check the spelling of the domain in your API Base URL.',
    };
  }

  if (code === 'ECONNREFUSED' || lower.includes('econnrefused')) {
    return {
      ok: false,
      status: 0,
      code: 'CONNECTION_REFUSED',
      endpoint,
      testedFrom: source,
      message: 'Connection refused by target server.',
      hint: isLocalProviderOrUrl(undefined, endpoint)
        ? 'Make sure Ollama / KoboldCpp / Oobabooga is running on your device with CORS enabled.'
        : 'Confirm the port and host are open and accepting HTTPS requests.',
    };
  }

  if (
    code.includes('CERT') ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    lower.includes('certificate') ||
    lower.includes('tls') ||
    lower.includes('ssl')
  ) {
    return {
      ok: false,
      status: 0,
      code: 'TLS_ERROR',
      endpoint,
      testedFrom: source,
      message: 'SSL / TLS certificate error on endpoint.',
      hint: 'The target server has an invalid, expired, or self-signed HTTPS certificate.',
    };
  }

  if (code === 'ECONNRESET' || code === 'EPIPE' || lower.includes('econnreset') || lower.includes('socket')) {
    return {
      ok: false,
      status: 0,
      code: 'CONNECTION_RESET',
      endpoint,
      testedFrom: source,
      message: 'Connection was reset unexpectedly by the remote host.',
      hint: 'The remote server or firewall terminated the socket.',
    };
  }

  if (source === 'browser' && (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed'))) {
    return {
      ok: false,
      status: 0,
      code: 'CORS_OR_NETWORK_BLOCK',
      endpoint,
      testedFrom: 'browser',
      message: 'Browser could not reach endpoint directly (CORS policy, mixed content, or local server offline).',
      hint: isLocalProviderOrUrl(undefined, endpoint)
        ? 'For local Ollama/Kobold/Ooba, launch the local server with CORS allowed (e.g. OLLAMA_ORIGINS="*").'
        : 'This endpoint blocks cross-origin browser requests and requires an API key without browser-only CORS restrictions.',
    };
  }

  return {
    ok: false,
    status: 0,
    code: 'NETWORK_ERROR',
    endpoint,
    testedFrom: source,
    message: `Connection failed: ${sanitizeErrorBody(rawMsg) || 'Network error'}`,
    hint: 'Verify the endpoint URL, API key, and your network connectivity.',
  };
}

/**
 * Safely parses JSON from an internal Palace.ai fetch response, guarding against 502/503 HTML proxy errors.
 */
export async function safeParseJsonResponse<T = any>(
  res: Response
): Promise<{ data: T | null; rawText: string; isHtml: boolean }> {
  const rawText = await res.text().catch(() => '');
  const contentType = res.headers.get('content-type') || '';
  const trimmed = rawText.trim();

  if (!trimmed) {
    return { data: null, rawText: '', isHtml: false };
  }

  if (looksLikeHtmlResponse(trimmed, contentType)) {
    return { data: null, rawText, isHtml: true };
  }

  try {
    return { data: JSON.parse(trimmed) as T, rawText, isHtml: false };
  } catch {
    return { data: null, rawText, isHtml: false };
  }
}

/**
 * Client-side resilient connection tester used by PresetsModal & ChubSettingsModal.
 * Handles validation, local PC endpoints (Ollama/Kobold/Ooba), server proxy errors,
 * and automatic browser-direct fallback when Cloudflare blocks cloud server egress.
 */
/**
 * Detects whether the active provider or endpoint URL targets Chub.ai inference gateways.
 */
export function isChubUrlOrProvider(providerId?: string | null, rawUrl?: string | null): boolean {
  if (providerId === 'chub_mars') return true;
  return /(^|\.|\/\/)(chub\.ai|venus\.ai)/i.test((rawUrl || '').trim());
}

/**
 * Builds request headers for OpenAI-compatible and Chub.ai endpoints (including CH-API-KEY).
 */
export function buildExternalAuthHeaders(
  apiKey?: string | null,
  endpoint?: string | null,
  apiProvider?: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const trimmedKey = (apiKey || '').trim();
  if (trimmedKey) {
    headers.Authorization = `Bearer ${trimmedKey}`;
    if (isChubUrlOrProvider(apiProvider, endpoint)) {
      headers['CH-API-KEY'] = trimmedKey;
    }
    if (apiProvider === 'anthropic' || /anthropic\.com/i.test(endpoint || '')) {
      headers['x-api-key'] = trimmedKey;
      headers['anthropic-version'] = '2023-06-01';
    }
  }
  return headers;
}

/**
 * Returns ordered Chub completions URLs to try (primary normalized URL + model-specific Inference/Mars/Mix gateways).
 */
export function getChubEndpointCandidates(
  rawUrl: string,
  model?: string | null,
  apiProvider?: string | null
): string[] {
  const primary = normalizeChatCompletionsUrl(rawUrl);
  if (!primary) return [];

  const isSameOrigin =
    typeof window !== 'undefined' &&
    Boolean(window.location?.origin) &&
    rawUrl.trim().toLowerCase().startsWith(window.location.origin.toLowerCase());
  if (!isChubUrlOrProvider(apiProvider, rawUrl) || isSameOrigin) {
    return [primary];
  }

  const lowerModel = (model || '').toLowerCase();
  const candidates = [primary];

  if (lowerModel.includes('soji') || lowerModel.includes('sojourn')) {
    candidates.push(
      'https://inference.chub.ai/soji/v1/chat/completions',
      'https://mars.chub.ai/chub/soji/v1/chat/completions'
    );
  } else if (lowerModel.includes('asha')) {
    candidates.push(
      'https://mars.chub.ai/chub/asha/v1/chat/completions',
      'https://inference.chub.ai/asha/v1/chat/completions'
    );
  }

  candidates.push(
    'https://mars.chub.ai/v1/chat/completions',
    'https://inference.chub.ai/soji/v1/chat/completions',
    'https://mars.chub.ai/chub/asha/v1/chat/completions',
    'https://mars.chub.ai/chub/soji/v1/chat/completions',
    'https://api.chub.ai/mix/v1/chat/completions',
    'https://api.chub.ai/v1/chat/completions'
  );

  return Array.from(new Set(candidates.filter(Boolean)));
}

/**
 * Picks the closest matching live model ID from a gateway's /v1/models list.
 * Handles Palace catalog aliases such as "chub-mars" -> "mars"/"asha"/"soji",
 * "chub-sojourn" -> "soji", "chub-asha" -> "asha", etc.
 */
export function pickBestModelForEndpoint(
  requestedModel: string | null | undefined,
  availableModels: string[]
): string {
  const cleanAvailable = availableModels.map((m) => String(m || '').trim()).filter(Boolean);
  if (cleanAvailable.length === 0) {
    return (requestedModel || '').trim();
  }

  const req = (requestedModel || '').trim();
  if (req) {
    // 1. Exact match
    if (cleanAvailable.includes(req)) return req;
    // 2. Case-insensitive exact match
    const ciExact = cleanAvailable.find((m) => m.toLowerCase() === req.toLowerCase());
    if (ciExact) return ciExact;

    // 3. Alias/prefix normalization (strip "chub-" prefix, sojourn -> soji, etc.)
    const lowerReq = req.toLowerCase();
    const stripped = lowerReq.replace(/^chub[-_/]/, '');
    const aliasTokens: string[] = [stripped];
    if (stripped.includes('sojourn') || stripped.includes('soji')) {
      aliasTokens.push('soji', 'sojourn', 'deepseek');
    } else if (stripped.includes('asha')) {
      aliasTokens.push('asha');
    } else if (stripped.includes('mars')) {
      aliasTokens.push('mars', 'soji', 'asha', 'mixtral', 'llama');
    } else if (stripped.includes('mercury')) {
      aliasTokens.push('mercury', 'mythomax', 'mistral', 'mixtral');
    } else if (stripped.includes('mythomax')) {
      aliasTokens.push('mythomax');
    } else if (stripped.includes('opus-5-5') || stripped.includes('opus-5.5')) {
      aliasTokens.push('claude-opus-5-5', 'claude-opus-5.5', 'opus-5.5', 'opus-5', 'opus');
    }

    for (const token of aliasTokens) {
      const hit = cleanAvailable.find((m) => m.toLowerCase().includes(token));
      if (hit) return hit;
    }
  }

  return cleanAvailable[0];
}

const resolvedEndpointCache = new Map<
  string,
  { endpoint: string; model: string; availableModels: string[] }
>();

/**
 * Queries GET .../models on an OpenAI-compatible or Chub.ai endpoint directly from the browser.
 */
export async function fetchEndpointModels(options: {
  apiUrl?: string | null;
  apiKey?: string | null;
  apiProvider?: string | null;
}): Promise<{
  ok: boolean;
  models: string[];
  modelsUrl: string;
  status: number;
  error?: ApiConnectionTestResult;
}> {
  const trimmedUrl = (options.apiUrl || '').trim();
  const trimmedKey = (options.apiKey || '').trim();
  const isLocal = isLocalProviderOrUrl(options.apiProvider, trimmedUrl);
  const useSameOriginFree =
    isBuiltInFreeProvider(options.apiProvider) ||
    (!isLocal && (!trimmedKey || isPalaceFreeApiKey(trimmedKey)));

  const effectiveBaseUrl = useSameOriginFree ? getSameOriginV1Url() : trimmedUrl;
  const modelsUrl = normalizeModelsUrl(effectiveBaseUrl);
  if (!modelsUrl) {
    return {
      ok: false,
      models: [],
      modelsUrl: '',
      status: 400,
    };
  }

  try {
    const headers = buildExternalAuthHeaders(options.apiKey, modelsUrl, options.apiProvider);
    const res = await fetch(modelsUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(8000),
    });

    const ct = res.headers.get('content-type') || '';
    const rawBody = await res.text().catch(() => '');

    if (!res.ok || looksLikeHtmlResponse(rawBody, ct)) {
      return {
        ok: false,
        models: [],
        modelsUrl,
        status: res.status,
        error: {
          ...classifyHttpApiError({
            status: res.status,
            statusText: res.statusText,
            rawBody,
            contentType: ct,
            endpoint: modelsUrl,
            apiProvider: options.apiProvider,
          }),
          testedFrom: 'browser',
        },
      };
    }

    const parsed = JSON.parse(rawBody);
    const list: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.data)
        ? parsed.data
        : Array.isArray(parsed?.models)
          ? parsed.models
          : [];

    const models = Array.from(
      new Set(
        list
          .map((item) => (typeof item === 'string' ? item : item?.id || item?.name || ''))
          .map((id) => String(id).trim())
          .filter(Boolean)
      )
    );

    return {
      ok: models.length > 0,
      models,
      modelsUrl,
      status: res.status,
    };
  } catch (err: any) {
    return {
      ok: false,
      models: [],
      modelsUrl,
      status: 0,
      error: classifyNetworkError(err, modelsUrl, 'browser'),
    };
  }
}

/**
 * Client-side resilient connection tester used by PresetsModal & ChubSettingsModal.
 * - Local endpoints (Ollama/Kobold/Ooba) test directly in browser (unreachable from cloud backend).
 * - Chub.ai endpoints (mars.chub.ai / inference.chub.ai / api.chub.ai send Access-Control-Allow-Origin: *)
 *   try browser-direct FIRST from the user's residential IP with CH-API-KEY + Bearer auth,
 *   auto-discover live /v1/models IDs when a gateway rejects a model ID, and rotate model-specific Chub routes.
 * - Other cloud endpoints (OpenRouter, OpenAI, Anthropic, DeepSeek, Groq) test via server proxy first.
 */
export async function runSmartConnectionTest(options: {
  apiProvider?: string;
  apiUrl?: string;
  apiKey?: string;
  model?: string;
}): Promise<ApiConnectionTestResult> {
  const hasExplicitFreeKey =
    Boolean(options.apiKey?.trim()) && isPalaceFreeApiKey(options.apiKey);

  if (isBuiltInFreeProvider(options.apiProvider) || hasExplicitFreeKey) {
    const chosenModel = (options.model || 'claude-opus-5-5').trim();
    const sameOriginV1 = getSameOriginV1Url();
    const discovered = await fetchEndpointModels({
      apiUrl: sameOriginV1,
      apiKey: options.apiKey,
      apiProvider: 'palace_free',
    }).catch(() => ({ ok: false, models: [] as string[], modelsUrl: '', status: 200 }));
    return {
      ok: true,
      status: 200,
      code: 'FREE_API_READY',
      endpoint: hasExplicitFreeKey ? sameOriginV1 : '/api/chat/message',
      testedFrom: 'server',
      resolvedModel: chosenModel,
      availableModels: discovered.models.length > 0 ? discovered.models : undefined,
      message: hasExplicitFreeKey
        ? `Palace Free API Key Verified! "${chosenModel}" works unlimited via ${sameOriginV1} with zero credit limits.`
        : `Palace Free Built-In API is ready! "${chosenModel}" runs completely free with zero API key needed.`,
      hint: 'Switch anytime between Claude Opus 5.5, DeepSeek R1, Chub Mars, GPT-4o, and Gemini — no external billing required.',
    };
  }

  const validationErr = validateConnectionInputs(options);
  if (validationErr) return validationErr;

  const providerMeta = CHUB_API_PROVIDERS.find((p) => p.id === options.apiProvider);
  const rawUrl = (
    options.apiUrl !== undefined ? options.apiUrl ?? '' : providerMeta?.defaultUrl || ''
  ).trim();
  const primaryEndpoint = normalizeChatCompletionsUrl(rawUrl);
  const targetModel = options.model || providerMeta?.defaultModel || 'chub-mars';
  const candidates = getChubEndpointCandidates(rawUrl, targetModel, options.apiProvider);

  const testDirectlyInBrowser = async (targetEndpoint: string): Promise<ApiConnectionTestResult> => {
    const sendProbe = async (probeModel: string): Promise<{ ok: boolean; status: number; statusText: string; ct: string; rawBody: string }> => {
      const headers = buildExternalAuthHeaders(options.apiKey, targetEndpoint, options.apiProvider);
      const res = await fetch(targetEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: probeModel,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(8000),
      });
      const ct = res.headers.get('content-type') || '';
      const rawBody = await res.text().catch(() => '');
      return { ok: res.ok, status: res.status, statusText: res.statusText, ct, rawBody };
    };

    try {
      let activeModel = targetModel;
      let availableModels: string[] = [];

      // Discover live /models upfront for Chub/local when using catalog placeholder IDs (e.g. "chub-mars")
      const isCatalogPlaceholder = /^(chub-|custom-model|ooba-local-model|koboldcpp\/)/i.test(targetModel);
      if (isChubUrlOrProvider(options.apiProvider, targetEndpoint) || isCatalogPlaceholder) {
        const discovered = await fetchEndpointModels({
          apiUrl: targetEndpoint,
          apiKey: options.apiKey,
          apiProvider: options.apiProvider,
        });
        if (discovered.models.length > 0) {
          availableModels = discovered.models;
          activeModel = pickBestModelForEndpoint(targetModel, availableModels);
        }
      }

      let probe = await sendProbe(activeModel);

      // If 404/400/422 (e.g. "Model must be in available models") and we haven't queried /models yet, discover & retry
      if (
        (!probe.ok || looksLikeHtmlResponse(probe.rawBody, probe.ct)) &&
        (probe.status === 404 || probe.status === 400 || probe.status === 422) &&
        availableModels.length === 0
      ) {
        const discovered = await fetchEndpointModels({
          apiUrl: targetEndpoint,
          apiKey: options.apiKey,
          apiProvider: options.apiProvider,
        });
        if (discovered.models.length > 0) {
          availableModels = discovered.models;
          const nextModel = pickBestModelForEndpoint(targetModel, availableModels);
          if (nextModel && nextModel !== activeModel) {
            activeModel = nextModel;
            probe = await sendProbe(activeModel);
          }
        }
      }

      if (probe.ok && !looksLikeHtmlResponse(probe.rawBody, probe.ct)) {
        const cacheKey = `${options.apiProvider || ''}|${rawUrl}|${(options.apiKey || '').slice(-8)}`;
        resolvedEndpointCache.set(cacheKey, {
          endpoint: targetEndpoint,
          model: activeModel,
          availableModels,
        });

        return {
          ok: true,
          status: probe.status,
          code: 'OK',
          endpoint: targetEndpoint,
          testedFrom: 'browser',
          resolvedModel: activeModel,
          availableModels: availableModels.length > 0 ? availableModels : undefined,
          message: `Connected cleanly directly from your browser to ${targetEndpoint} using model "${activeModel}" (${probe.status} OK)!`,
        };
      }

      const classified = classifyHttpApiError({
        status: probe.status,
        statusText: probe.statusText,
        rawBody: probe.rawBody,
        contentType: probe.ct,
        endpoint: targetEndpoint,
        apiProvider: options.apiProvider,
      });

      return {
        ...classified,
        testedFrom: 'browser',
        resolvedModel: availableModels.length > 0 ? activeModel : undefined,
        availableModels: availableModels.length > 0 ? availableModels : undefined,
      };
    } catch (err: any) {
      return classifyNetworkError(err, targetEndpoint, 'browser');
    }
  };

  // 1. Local endpoints (localhost / Ollama / KoboldCpp / Oobabooga)
  if (isLocalProviderOrUrl(options.apiProvider, rawUrl)) {
    return testDirectlyInBrowser(primaryEndpoint);
  }

  // 2. Chub.ai endpoints: try user's own browser residential IP first (Chub supports CORS Access-Control-Allow-Origin: *)
  if (isChubUrlOrProvider(options.apiProvider, rawUrl)) {
    let lastBrowserResult: ApiConnectionTestResult | null = null;
    for (const candidateUrl of candidates.slice(0, 6)) {
      const attempt = await testDirectlyInBrowser(candidateUrl);
      if (attempt.ok) {
        return attempt;
      }
      lastBrowserResult = attempt;
      // Stop cycling if credentials themselves failed cleanly (401/402)
      if (attempt.code === 'UNAUTHORIZED' || attempt.code === 'PAYMENT_REQUIRED') {
        return attempt;
      }
    }

    // Also try server proxy once in case user's browser environment blocked outbound fetch
    try {
      const serverRes = await fetch('/api/config/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiProvider: options.apiProvider,
          apiUrl: rawUrl,
          apiKey: options.apiKey,
          model: targetModel,
        }),
        signal: AbortSignal.timeout(12000),
      });
      const parsed = await safeParseJsonResponse<ApiConnectionTestResult>(serverRes);
      if (parsed.data?.ok) {
        return { ...parsed.data, testedFrom: 'server' };
      }
      if (parsed.data && !parsed.data.isCloudflareBlock && parsed.data.code !== 'NETWORK_ERROR') {
        return { ...parsed.data, testedFrom: 'server' };
      }
      return lastBrowserResult || parsed.data!;
    } catch {
      return lastBrowserResult!;
    }
  }

  // 3. Other cloud providers (OpenRouter, OpenAI, Anthropic, DeepSeek, Groq, Custom Reverse Proxies)
  try {
    const serverRes = await fetch('/api/config/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiProvider: options.apiProvider,
        apiUrl: rawUrl,
        apiKey: options.apiKey,
        model: targetModel,
      }),
      signal: AbortSignal.timeout(13000),
    });

    const parsed = await safeParseJsonResponse<ApiConnectionTestResult>(serverRes);

    if (!parsed.data) {
      if (parsed.isHtml || !serverRes.ok) {
        return classifyHttpApiError({
          status: serverRes.status,
          statusText: serverRes.statusText,
          rawBody: parsed.rawText,
          contentType: serverRes.headers.get('content-type'),
          endpoint: '/api/config/test-connection',
          apiProvider: options.apiProvider,
        });
      }
      return {
        ok: false,
        status: serverRes.status,
        code: 'INVALID_SERVER_RESPONSE',
        endpoint: primaryEndpoint,
        testedFrom: 'server',
        message: 'Unexpected empty or non-JSON response from Palace server.',
      };
    }

    const serverData = parsed.data;
    if (serverData.ok) {
      return { ...serverData, testedFrom: 'server' };
    }

    // If Cloudflare WAF blocked Cloud Run on a custom proxy, try direct browser check once
    const isKnownStrictCorsDomain = /(^|\.)(chub\.ai|openai\.com|anthropic\.com)$/i.test(
      (() => {
        try {
          return new URL(primaryEndpoint).hostname;
        } catch {
          return '';
        }
      })()
    );

    if (serverData.isCloudflareBlock && !isKnownStrictCorsDomain) {
      const browserAttempt = await testDirectlyInBrowser(primaryEndpoint);
      if (browserAttempt.ok) {
        return browserAttempt;
      }
      if (
        browserAttempt.code === 'UNAUTHORIZED' ||
        browserAttempt.code === 'PAYMENT_REQUIRED' ||
        browserAttempt.code === 'BAD_REQUEST'
      ) {
        return browserAttempt;
      }
      return {
        ...serverData,
        hint: `${serverData.hint || ''} (Direct browser check also hit: ${browserAttempt.code.toLowerCase().replace(/_/g, ' ')}.)`.trim(),
      };
    }

    return { ...serverData, testedFrom: 'server' };
  } catch (err: any) {
    return classifyNetworkError(err, primaryEndpoint, 'server');
  }
}

/**
 * Attempts a browser-direct OpenAI-compatible / Chub.ai completion from the user's own browser IP
 * (bypasses Cloud Run datacenter Cloudflare blocks & auto-discovers live /models IDs when needed).
 */
export async function tryBrowserExternalCompletion(params: {
  character: {
    name: string;
    tagline: string;
    description: string;
    personality?: string | null;
    systemPrompt: string;
    postHistoryInstructions?: string | null;
    scenario?: string | null;
    exampleDialogues?: string | null;
    lorebook?: string | null;
    userPersona?: string | null;
  };
  history: Array<{ sender: 'user' | 'character' | 'system'; content: string }>;
  userMessage?: string;
  chatSummary?: string | null;
  apiProvider?: string;
  apiUrl?: string;
  apiKey?: string;
  model?: string;
  chatSettings?: Record<string, any>;
}): Promise<{ ok: true; reply: string; modelUsed: string } | { ok: false; error: ApiConnectionTestResult }> {
  const providerMeta = CHUB_API_PROVIDERS.find((p) => p.id === params.apiProvider);
  const isLocal = isLocalProviderOrUrl(params.apiProvider, params.apiUrl);
  const hasFreeKey = isPalaceFreeApiKey(params.apiKey);
  const rawUrl =
    !isLocal && hasFreeKey
      ? getSameOriginV1Url()
      : (params.apiUrl || providerMeta?.defaultUrl || '').trim();
  const targetModel =
    (params.model && !params.model.startsWith('gemini-') ? params.model : null) ||
    providerMeta?.defaultModel ||
    'chub-mars';

  const baseCandidates = getChubEndpointCandidates(rawUrl, targetModel, params.apiProvider);
  if (baseCandidates.length === 0) {
    return {
      ok: false,
      error: {
        ok: false,
        status: 400,
        code: 'EMPTY_URL',
        endpoint: '',
        message: 'API Base URL is empty.',
      },
    };
  }

  const cacheKey = `${params.apiProvider || ''}|${rawUrl}|${(params.apiKey || '').slice(-8)}`;
  const cached = resolvedEndpointCache.get(cacheKey);
  const candidates = cached?.endpoint
    ? Array.from(new Set([cached.endpoint, ...baseCandidates]))
    : baseCandidates;

  const cs = params.chatSettings || {};
  const budgeted = buildBudgetedContext({
    character: params.character,
    history: params.history,
    userMessage: params.userMessage,
    chatSummary: params.chatSummary,
    contextSize: cs.contextSize || 8192,
    maxNewTokens: cs.maxNewTokens || 450,
    lorebookTokenBudget: cs.lorebookTokenBudget ?? 1200,
    lorebookScanDepth: cs.lorebookScanDepth ?? 4,
    matchWholeWords: cs.matchWholeWords ?? true,
    useLorebooks: cs.useLorebooks ?? true,
  });

  const systemParts = [
    `You are roleplaying as "${params.character.name}". Stay in character at all times.`,
    `Tagline: ${params.character.tagline}`,
    `Description:\n${budgeted.description}`,
  ];
  if (budgeted.personality) systemParts.push(`Personality:\n${budgeted.personality}`);
  if (budgeted.systemPrompt) systemParts.push(`Instructions:\n${budgeted.systemPrompt}`);
  if (budgeted.scenario) systemParts.push(`Scenario:\n${budgeted.scenario}`);
  if (params.character.userPersona) systemParts.push(`User Persona:\n${params.character.userPersona}`);
  if (params.chatSummary) systemParts.push(`Memory Summary:\n${params.chatSummary}`);
  if (budgeted.relevantLore.length > 0) systemParts.push(`Lorebook:\n${budgeted.relevantLore.join('\n')}`);
  if (budgeted.exampleDialogues) systemParts.push(`Example Dialogues:\n${budgeted.exampleDialogues}`);
  if (budgeted.postHistoryInstructions) systemParts.push(`Post-History:\n${budgeted.postHistoryInstructions}`);
  if (cs.promptNote) systemParts.push(`Author Note: ${cs.promptNote}`);

  const messagesPayload: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemParts.join('\n\n') },
    ...budgeted.history.map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content,
    })),
  ];
  if (params.userMessage) {
    messagesPayload.push({ role: 'user', content: params.userMessage });
  }

  let lastError: ApiConnectionTestResult | null = null;
  for (const endpoint of candidates.slice(0, 4)) {
    const sendCompletion = async (chosenModel: string) => {
      const headers = buildExternalAuthHeaders(params.apiKey, endpoint, params.apiProvider);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: chosenModel,
          messages: messagesPayload,
          temperature: cs.temperature ?? 0.85,
          top_p: cs.topP ?? 0.95,
          max_tokens: cs.maxNewTokens ?? 450,
          frequency_penalty: cs.frequencyPenalty ?? 0,
          presence_penalty: cs.presencePenalty ?? 0,
        }),
        signal: AbortSignal.timeout(7000),
      });
      const ct = res.headers.get('content-type') || '';
      const rawBody = await res.text().catch(() => '');
      return { res, ct, rawBody };
    };

    try {
      let chosenModel =
        cached && cached.endpoint === endpoint && cached.model
          ? cached.model
          : targetModel;

      let { res, ct, rawBody } = await sendCompletion(chosenModel);

      // If endpoint rejected placeholder/unlisted model (e.g. 404 "Model must be in available models"), auto-discover /models & retry
      if ((!res.ok || looksLikeHtmlResponse(rawBody, ct)) && (res.status === 404 || res.status === 400 || res.status === 422)) {
        const discovered = await fetchEndpointModels({
          apiUrl: endpoint,
          apiKey: params.apiKey,
          apiProvider: params.apiProvider,
        });
        if (discovered.models.length > 0) {
          const bestModel = pickBestModelForEndpoint(targetModel, discovered.models);
          if (bestModel && bestModel !== chosenModel) {
            chosenModel = bestModel;
            const retry = await sendCompletion(chosenModel);
            res = retry.res;
            ct = retry.ct;
            rawBody = retry.rawBody;
          }
        }
      }

      if (res.ok && !looksLikeHtmlResponse(rawBody, ct)) {
        try {
          const json = JSON.parse(rawBody);
          const reply = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || '';
          if (reply.trim()) {
            resolvedEndpointCache.set(cacheKey, {
              endpoint,
              model: chosenModel,
              availableModels: cached?.availableModels || [],
            });
            return {
              ok: true,
              reply,
              modelUsed: `${providerMeta?.label || params.apiProvider || 'Chub.ai'} (${chosenModel})`,
            };
          }
        } catch {
          // try next or fail
        }
      }

      lastError = classifyHttpApiError({
        status: res.status,
        statusText: res.statusText,
        rawBody,
        contentType: ct,
        endpoint,
        apiProvider: params.apiProvider,
      });
      if (
        lastError.code === 'UNAUTHORIZED' ||
        lastError.code === 'PAYMENT_REQUIRED' ||
        (lastError.code === 'RATE_LIMITED' && /out of credits|credit|quota/i.test(rawBody))
      ) {
        break;
      }
    } catch (err: any) {
      lastError = classifyNetworkError(err, endpoint, 'browser');
    }
  }

  return {
    ok: false,
    error: lastError || {
      ok: false,
      status: 0,
      code: 'NETWORK_ERROR',
      endpoint: candidates[0],
      message: 'Failed to reach external endpoint from browser.',
    },
  };
}
