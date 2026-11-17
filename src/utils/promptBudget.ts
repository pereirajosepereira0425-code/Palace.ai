export interface PromptBudgetInput {
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
  contextSize?: number;
  maxNewTokens?: number;
  lorebookTokenBudget?: number;
  lorebookScanDepth?: number;
  matchWholeWords?: boolean;
  useLorebooks?: boolean;
}

export interface BudgetedPromptResult {
  description: string;
  personality: string;
  systemPrompt: string;
  scenario: string;
  exampleDialogues: string;
  postHistoryInstructions: string;
  relevantLore: string[];
  history: Array<{ sender: 'user' | 'character' | 'system'; content: string }>;
  estimatedTokens: number;
}

/**
 * Fast, deterministic token estimator (~4 chars per token).
 */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Truncates long text smoothly within a token budget while preserving intro and closing context.
 */
export function trimTextToTokenBudget(text: string | null | undefined, maxTokens: number): string {
  if (!text) return '';
  if (maxTokens <= 0) return '';
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;

  const headChars = Math.floor(maxChars * 0.72);
  const tailChars = Math.max(0, maxChars - headChars - 36);
  if (tailChars < 80) {
    return text.slice(0, Math.max(0, maxChars - 3)).trimEnd() + '...';
  }
  return (
    text.slice(0, headChars).trimEnd() +
    '\n...[trimmed for fast context]...\n' +
    text.slice(text.length - tailChars).trimStart()
  );
}

/**
 * Matches lorebook keywords within scan depth while enforcing a strict lorebook token budget.
 */
export function selectBudgetedLore(options: {
  lorebookJson: string | null | undefined;
  history: Array<{ content: string }>;
  userMessage?: string;
  scanDepth?: number;
  tokenBudget?: number;
  matchWholeWords?: boolean;
  enabled?: boolean;
}): string[] {
  const {
    lorebookJson,
    history,
    userMessage = '',
    scanDepth = 4,
    tokenBudget = 1200,
    matchWholeWords = true,
    enabled = true,
  } = options;

  if (!enabled || !lorebookJson || tokenBudget <= 0) return [];

  try {
    const entries: Array<{ key?: string; keys?: string[]; content?: string }> = JSON.parse(lorebookJson);
    if (!Array.isArray(entries)) return [];

    const recentText = [
      ...history.slice(-Math.max(1, scanDepth)).map((m) => m.content),
      userMessage,
    ]
      .join(' ')
      .toLowerCase();

    const matched: string[] = [];
    let usedTokens = 0;

    for (const entry of entries) {
      const content = (entry.content || '').trim();
      if (!content) continue;

      const rawKeys = Array.isArray(entry.keys)
        ? entry.keys
        : entry.key
          ? entry.key.split(',')
          : [];

      const isTriggered = rawKeys.some((k) => {
        const cleanKey = k.trim().toLowerCase();
        if (!cleanKey) return false;
        if (!matchWholeWords) {
          return recentText.includes(cleanKey);
        }
        const escaped = cleanKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu').test(recentText);
      });

      if (!isTriggered) continue;

      const label = rawKeys[0]?.trim() || 'World';
      const formatted = `[Lorebook - ${label}]: ${content}`;
      const tokens = estimateTokens(formatted);

      if (usedTokens + tokens > tokenBudget) {
        const remaining = tokenBudget - usedTokens;
        if (remaining >= 40) {
          matched.push(trimTextToTokenBudget(formatted, remaining));
        }
        break;
      }

      matched.push(formatted);
      usedTokens += tokens;
    }

    return matched;
  } catch {
    return [];
  }
}

/**
 * Windows character definitions, lore, and message history to keep high-token bots responsive.
 */
export function buildBudgetedContext(input: PromptBudgetInput): BudgetedPromptResult {
  const contextSize = Math.min(32768, Math.max(2048, input.contextSize || 8192));
  const maxNewTokens = Math.min(2048, Math.max(150, input.maxNewTokens || 450));
  const availableInputBudget = Math.max(1400, contextSize - maxNewTokens - 250);

  // Reserve ~55% max for static character card + lore so recent conversation never gets starved,
  // and keep hard speed caps on massive imported V2 character cards.
  const staticBudget = Math.min(4200, Math.floor(availableInputBudget * 0.58));

  const descriptionBudget = Math.min(1800, Math.floor(staticBudget * 0.42));
  const personalityBudget = Math.min(700, Math.floor(staticBudget * 0.16));
  const systemPromptBudget = Math.min(900, Math.floor(staticBudget * 0.22));
  const scenarioBudget = Math.min(600, Math.floor(staticBudget * 0.14));
  const postHistoryBudget = Math.min(450, Math.floor(staticBudget * 0.12));
  const exampleDialoguesBudget = Math.min(550, Math.floor(staticBudget * 0.14));

  const description = trimTextToTokenBudget(input.character.description, descriptionBudget);
  const personality = trimTextToTokenBudget(input.character.personality, personalityBudget);
  const systemPrompt = trimTextToTokenBudget(input.character.systemPrompt, systemPromptBudget);
  const scenario = trimTextToTokenBudget(input.character.scenario, scenarioBudget);
  const postHistoryInstructions = trimTextToTokenBudget(
    input.character.postHistoryInstructions,
    postHistoryBudget
  );
  const exampleDialogues = trimTextToTokenBudget(
    input.character.exampleDialogues,
    exampleDialoguesBudget
  );

  const relevantLore = selectBudgetedLore({
    lorebookJson: input.character.lorebook,
    history: input.history,
    userMessage: input.userMessage,
    scanDepth: input.lorebookScanDepth ?? 4,
    tokenBudget: Math.min(input.lorebookTokenBudget ?? 1200, Math.floor(staticBudget * 0.3)),
    matchWholeWords: input.matchWholeWords ?? true,
    enabled: input.useLorebooks ?? true,
  });

  const staticTokens =
    estimateTokens(input.character.name) +
    estimateTokens(input.character.tagline) +
    estimateTokens(description) +
    estimateTokens(personality) +
    estimateTokens(systemPrompt) +
    estimateTokens(scenario) +
    estimateTokens(postHistoryInstructions) +
    estimateTokens(exampleDialogues) +
    estimateTokens(input.character.userPersona) +
    estimateTokens(input.chatSummary) +
    relevantLore.reduce((sum, item) => sum + estimateTokens(item), 0);

  const userMsgTokens = estimateTokens(input.userMessage);
  let remainingHistoryBudget = Math.max(700, availableInputBudget - staticTokens - userMsgTokens);

  // Keep most recent turns up to a sane turn cap (max 28 recent turns) so requests stay snappy.
  const recentWindow = input.history.slice(-28);
  const selectedHistory: Array<{ sender: 'user' | 'character' | 'system'; content: string }> = [];

  for (let i = recentWindow.length - 1; i >= 0; i--) {
    const msg = recentWindow[i];
    const msgTokens = estimateTokens(msg.content) + 8;

    // Always keep at least the latest 2 messages even on tight budgets
    if (selectedHistory.length < 2) {
      const cappedContent =
        msgTokens > 900 ? trimTextToTokenBudget(msg.content, 850) : msg.content;
      selectedHistory.unshift({ sender: msg.sender, content: cappedContent });
      remainingHistoryBudget -= estimateTokens(cappedContent) + 8;
      continue;
    }

    if (remainingHistoryBudget - msgTokens < 0) break;
    selectedHistory.unshift(msg);
    remainingHistoryBudget -= msgTokens;
  }

  const totalTokens =
    staticTokens +
    userMsgTokens +
    selectedHistory.reduce((sum, item) => sum + estimateTokens(item.content) + 8, 0);

  return {
    description,
    personality,
    systemPrompt,
    scenario,
    exampleDialogues,
    postHistoryInstructions,
    relevantLore,
    history: selectedHistory,
    estimatedTokens: totalTokens,
  };
}

/**
 * Normalizes Chub.ai / OpenAI-compatible base or completions URLs without duplicating suffixes.
 */
export function normalizeChatCompletionsUrl(rawUrl: string): string {
  const cleaned = rawUrl.trim().replace(/\/+$/, '');
  if (!cleaned) return '';
  if (cleaned.endsWith('/chat/completions')) {
    return cleaned;
  }
  if (cleaned.endsWith('/v1') || cleaned.endsWith('/api/v1')) {
    return `${cleaned}/chat/completions`;
  }
  // If user pasted root chub.ai or custom base without /v1
  if (/^https?:\/\/(www\.)?(api\.)?chub\.ai$/i.test(cleaned)) {
    return 'https://mars.chub.ai/v1/chat/completions';
  }
  return `${cleaned}/chat/completions`;
}

/**
 * Maps an API base URL or /chat/completions endpoint to its corresponding /models discovery URL.
 */
export function normalizeModelsUrl(rawUrl: string): string {
  const cleaned = rawUrl.trim().replace(/\/+$/, '');
  if (!cleaned) return '';
  if (cleaned.endsWith('/models')) {
    return cleaned;
  }
  if (cleaned.endsWith('/chat/completions')) {
    return `${cleaned.slice(0, -'/chat/completions'.length)}/models`;
  }
  if (/^https?:\/\/(www\.)?(api\.)?chub\.ai$/i.test(cleaned)) {
    return 'https://mars.chub.ai/v1/models';
  }
  return `${cleaned}/models`;
}

/**
 * Determines whether High-Thinking (gemini-4-argon) should actually run.
 * Respects explicit 'OFF' thinking mode so normal chats stay ultra-fast.
 */
export function shouldUseHighThinking(
  thinkingLevel: 'HIGH' | 'OFF' | undefined,
  modelPreference: string | undefined
): boolean {
  if (thinkingLevel === 'HIGH') return true;
  if (thinkingLevel === 'OFF') return false;
  return modelPreference === 'gemini-4-argon';
}

export const CHUB_CREATE_TOKEN_URL = 'https://chub.ai/my_stages?active=tokens';
export const CHUB_SUBSCRIPTIONS_URL = 'https://chub.ai/subscriptions';
export const CHUB_SETTINGS_URL = 'https://chub.ai/settings';

export interface ProviderApiKeyInfo {
  label: string;
  url: string;
  helperText: string;
}

const PROVIDER_KEY_PORTALS: Record<string, ProviderApiKeyInfo> = {
  chub_mars: {
    label: '🔑 Create Chub.ai Token',
    url: CHUB_CREATE_TOKEN_URL,
    helperText: 'Generate Chub account/stage tokens at chub.ai/my_stages?active=tokens or manage Mars/Mercury plans at chub.ai/subscriptions.',
  },
  openrouter: {
    label: '🔑 Create OpenRouter Key',
    url: 'https://openrouter.ai/keys',
    helperText: 'Create a free or pay-as-you-go OpenRouter API key to unlock 300+ models.',
  },
  openai: {
    label: '🔑 Create OpenAI Key',
    url: 'https://platform.openai.com/api-keys',
    helperText: 'Generate an OpenAI secret key from your OpenAI developer platform dashboard.',
  },
  anthropic: {
    label: '🔑 Create Anthropic Key',
    url: 'https://console.anthropic.com/settings/keys',
    helperText: 'Create a Claude API key in the Anthropic Console.',
  },
  deepseek: {
    label: '🔑 Create DeepSeek Key',
    url: 'https://platform.deepseek.com/api_keys',
    helperText: 'Create a DeepSeek V3 / R1 API key in the DeepSeek Platform console.',
  },
  mistral: {
    label: '🔑 Create Mistral Key',
    url: 'https://console.mistral.ai/api-keys',
    helperText: 'Generate a Mistral AI API key in La Plateforme.',
  },
  groq: {
    label: '🔑 Create Groq Key',
    url: 'https://console.groq.com/keys',
    helperText: 'Create an ultra-fast Groq Cloud API key.',
  },
  xai: {
    label: '🔑 Create xAI Grok Key',
    url: 'https://console.x.ai/',
    helperText: 'Manage your Grok API keys inside the xAI Cloud Console.',
  },
  novelai: {
    label: '🔑 NovelAI Account Key',
    url: 'https://novelai.net/account',
    helperText: 'Generate a Persistent API Token in your NovelAI Account settings.',
  },
  palace_free: {
    label: '🎁 Free Built-In API Active',
    url: CHUB_CREATE_TOKEN_URL,
    helperText:
      'Palace Free Built-In API requires ZERO keys — works directly with Claude Opus 5.5, DeepSeek R1, Chub Mars, GPT-4o & Gemini.',
  },
  gemini: {
    label: '🔑 Google AI Studio Key',
    url: 'https://aistudio.google.com/app/apikey',
    helperText: 'Gemini runs natively on Palace.ai — or create Chub.ai tokens & Mars keys below.',
  },
};

export function getProviderApiKeyInfo(providerId?: string | null): ProviderApiKeyInfo {
  if (!providerId) {
    return PROVIDER_KEY_PORTALS.chub_mars;
  }
  return (
    PROVIDER_KEY_PORTALS[providerId] || {
      label: '🔑 Create Chub.ai Token',
      url: CHUB_CREATE_TOKEN_URL,
      helperText: 'Generate Chub tokens at chub.ai/my_stages?active=tokens or manage Chub settings.',
    }
  );
}

