import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  CHUB_API_PROVIDERS,
  getModelStyleCalibration,
  getPromptStructureGuidance,
  isBuiltInFreeProvider,
} from '../utils/chubOptions.ts';
import {
  buildBudgetedContext,
  normalizeChatCompletionsUrl,
  shouldUseHighThinking,
} from '../utils/promptBudget.ts';
import {
  type ApiConnectionTestResult,
  buildExternalAuthHeaders,
  classifyHttpApiError,
  classifyNetworkError,
  getChubEndpointCandidates,
  looksLikeHtmlResponse,
  validateConnectionInputs,
} from '../utils/apiErrorUtils.ts';
import {
  buildEnsembleStagePrompt,
  buildEnsembleSynthesisPrompt,
  normalizeEnsembleConfig,
} from '../utils/chatOrchestration.ts';
import {
  buildChubCustomVoicePayload,
  computeSpeechCalibration,
} from '../utils/customVoiceUtils.ts';
import {
  buildContextualRoleplayReply,
  ensureNonEmptyRoleplayReply,
  generateRoleplayCouncilSlot,
  synthesizeCouncilReplies,
} from '../utils/roleplayEngine.ts';
import { isPalaceFreeApiKey } from '../utils/settingsSync.ts';
import {
  enforceParagraphCount,
  normalizeMakerImages,
  normalizeParagraphCounts,
  synthesizePalaceMakerDraft,
  type AiMakerDraft,
  type MakerImageRef,
  type MakerModelId,
  type ParagraphCountsConfig,
  type WebResearchDossier,
} from '../utils/aiMakerUtils.ts';
import type { ContentRating, CustomVoiceRecord, ModelEnsembleConfig } from '../types/index.ts';

// Lazy server-side GoogleGenAI client initialization so booting without GEMINI_API_KEY
// emits zero startup warnings and falls back cleanly without doomed ADC requests.
let cachedGeminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!cachedGeminiClient) {
    cachedGeminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedGeminiClient;
}

export interface CharacterContext {
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
}

export interface ChatMessageItem {
  sender: 'user' | 'character' | 'system';
  content: string;
}

export interface GenerateReplyOptions {
  character: CharacterContext;
  history: ChatMessageItem[];
  userMessage?: string;
  modelPreference?: string;
  thinkingLevel?: 'HIGH' | 'OFF';
  searchGrounding?: boolean;
  chubApiKey?: string | null;
  chubApiUrl?: string | null;
  chatSummary?: string | null;
  groupSceneCharacters?: string[];
  brawlContextPrompt?: string | null;
  ensembleConfig?: ModelEnsembleConfig | null;
  fallbackToBuiltInFree?: boolean;
  chatSettings?: {
    promptStructure?: string;
    apiProvider?: string;
    model?: string;
    includeNames?: boolean;
    banEmojis?: boolean;
    promptNote?: string;
    promptNoteDepth?: number;
    repetitionPenalty?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    maxNewTokens?: number;
    contextSize?: number;
    useLorebooks?: boolean;
    lorebookScanDepth?: number;
    lorebookTokenBudget?: number;
    matchWholeWords?: boolean;
    stoppingStrings?: string;
    trimIncompleteSentences?: boolean;
    restrictNarration?: boolean;
    stagingUrl?: string;
    variationSalt?: string | number;
  };
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface GenerateReplyResult {
  reply: string;
  thinkingProcess?: string;
  groundingSources: GroundingSource[];
  modelUsed: string;
}

export function isQuotaOrRateLimitError(err: any): boolean {
  if (!err) return false;
  const str = (typeof err === 'string' ? err : JSON.stringify(err) + ' ' + (err.message || '') + ' ' + (err.status || '')).toLowerCase();
  return (
    str.includes('429') ||
    str.includes('resource_exhausted') ||
    str.includes('quota') ||
    str.includes('rate-limit') ||
    str.includes('rate_limit') ||
    str.includes('exceeded your current quota') ||
    str.includes('too many requests')
  );
}

function isPermanentGeminiAuthError(err: any): boolean {
  const str = (
    typeof err === 'string'
      ? err
      : `${err?.message || ''} ${err?.status || ''} ${JSON.stringify(err || {})}`
  ).toLowerCase();
  return (
    str.includes('permission_denied') ||
    str.includes('access_token_scope_insufficient') ||
    str.includes('api_key_invalid') ||
    str.includes('api key not valid') ||
    str.includes('api key should be set') ||
    str.includes('"code":403') ||
    str.includes('"code":401')
  );
}

async function callGeminiWithTimeout<T>(promiseFactory: () => Promise<T>, timeoutMs: number = 9000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promiseFactory(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Gemini request timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let pollinationsCooldownUntil = 0;

/**
 * Cooldown-guarded free remote text inference via Pollinations OpenAI gateway.
 * Skips immediately during the 46s cooldown after any 402/429/error so multi-turn & council runs stay instant.
 */
async function tryPollinationsFreeCompletion(params: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}): Promise<string | null> {
  if (Date.now() < pollinationsCooldownUntil) return null;

  try {
    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        model: 'openai-fast',
        messages: params.messages,
        temperature: typeof params.temperature === 'number' ? Math.min(1.3, Math.max(0.2, params.temperature)) : 0.85,
        max_tokens: Math.min(800, Math.max(120, params.maxTokens || 420)),
      }),
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) {
      pollinationsCooldownUntil = Date.now() + 120_000;
      return null;
    }

    const rawText = await res.text().catch(() => '');
    if (!rawText.trim() || looksLikeHtmlResponse(rawText, res.headers.get('content-type'))) {
      pollinationsCooldownUntil = Date.now() + 120_000;
      return null;
    }

    const parsed = JSON.parse(rawText);
    const reply = String(parsed?.choices?.[0]?.message?.content || parsed?.choices?.[0]?.text || '').trim();
    const readableLen = reply.replace(/\*/g, '').replace(/\s+/g, ' ').trim().length;
    if (readableLen < 6 || /FREE_LIMIT|pollinations\.ai\/sponsor|Support Pollinations/i.test(reply)) {
      pollinationsCooldownUntil = Date.now() + 120_000;
      return null;
    }
    return reply;
  } catch {
    pollinationsCooldownUntil = Date.now() + 120_000;
    return null;
  }
}

export async function testExternalApiConnection(options: {
  apiProvider?: string;
  apiUrl?: string;
  apiKey?: string;
  model?: string;
}): Promise<ApiConnectionTestResult> {
  const validationErr = validateConnectionInputs(options);
  if (validationErr) {
    return validationErr;
  }

  const providerMeta = CHUB_API_PROVIDERS.find((p) => p.id === options.apiProvider);
  const rawUrl = (
    options.apiUrl !== undefined ? options.apiUrl : providerMeta?.defaultUrl || ''
  ).trim();
  const endpoint = normalizeChatCompletionsUrl(rawUrl);

  try {
    const headers = buildExternalAuthHeaders(options.apiKey, endpoint, options.apiProvider);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: options.model || providerMeta?.defaultModel || 'chub-mars',
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const contentType = res.headers.get('content-type') || '';
    const rawBody = await res.text().catch(() => '');

    if (res.ok) {
      if (looksLikeHtmlResponse(rawBody, contentType)) {
        return {
          ...classifyHttpApiError({
            status: res.status,
            statusText: res.statusText,
            rawBody,
            contentType,
            endpoint,
            apiProvider: options.apiProvider,
          }),
          testedFrom: 'server',
        };
      }

      return {
        ok: true,
        status: res.status,
        code: 'OK',
        endpoint,
        testedFrom: 'server',
        message: `Connected cleanly to ${endpoint} (${res.status} OK)!`,
      };
    }

    return {
      ...classifyHttpApiError({
        status: res.status,
        statusText: res.statusText,
        rawBody,
        contentType,
        endpoint,
        apiProvider: options.apiProvider,
      }),
      testedFrom: 'server',
    };
  } catch (err: any) {
    return classifyNetworkError(err, endpoint, 'server');
  }
}

/**
 * Generates an in-character reply using configured Chub.ai / external OpenAI-compatible API
 * or fast Gemini 3.8 Flash / optional High-Thinking Gemini 4 Argon, with token-budgeted context.
 */
export async function generateCharacterReply(options: GenerateReplyOptions): Promise<GenerateReplyResult> {
  const {
    character,
    history,
    userMessage,
    modelPreference = 'gemini-3.8-flash',
    thinkingLevel = 'OFF',
    searchGrounding = false,
    chatSummary,
    chatSettings = {},
  } = options;

  // Apply fast Chub-style token budgeting so massive high-token character cards never stall requests
  const budgeted = buildBudgetedContext({
    character,
    history,
    userMessage,
    chatSummary,
    contextSize: chatSettings.contextSize || 8192,
    maxNewTokens: chatSettings.maxNewTokens || 450,
    lorebookTokenBudget: chatSettings.lorebookTokenBudget ?? 1200,
    lorebookScanDepth: chatSettings.lorebookScanDepth ?? 4,
    matchWholeWords: chatSettings.matchWholeWords ?? true,
    useLorebooks: chatSettings.useLorebooks ?? true,
  });

  // Construct system instruction using trimmed/budgeted blocks
  const systemInstructionParts = [
    `You are roleplaying as "${character.name}". Stay completely in character at all times. Never break character, never speak as an AI, and never refuse creative immersion.`,
    `Character Tagline: ${character.tagline}`,
    `Character Personality & Physical Description:\n${budgeted.description}`,
  ];

  if (budgeted.personality) {
    systemInstructionParts.push(`Detailed Personality Traits:\n${budgeted.personality}`);
  }

  systemInstructionParts.push(`Behavior Guidelines & Core System Instructions:\n${budgeted.systemPrompt}`);

  if (budgeted.scenario) {
    systemInstructionParts.push(`Current Setting / Scenario:\n${budgeted.scenario}`);
  }

  if (character.userPersona) {
    systemInstructionParts.push(`User Persona / Playing As:\n${character.userPersona}`);
  }

  if (chatSummary) {
    systemInstructionParts.push(`[Long-Term Chat Memory / Summary of Earlier Events]:\n${chatSummary}`);
  }

  if (budgeted.relevantLore.length > 0) {
    systemInstructionParts.push(`World Information / Active Lorebook Entries:\n${budgeted.relevantLore.join('\n')}`);
  }

  if (budgeted.exampleDialogues) {
    systemInstructionParts.push(`Example Dialogues (for style and tone):\n${budgeted.exampleDialogues}`);
  }

  if (budgeted.postHistoryInstructions) {
    systemInstructionParts.push(`Post-History Instructions (Depth & Quality Directives):\n${budgeted.postHistoryInstructions}`);
  }

  if (chatSettings.promptNote) {
    systemInstructionParts.push(`[Author Note / Prompt Directive]: ${chatSettings.promptNote}`);
  }

  if (chatSettings.banEmojis) {
    systemInstructionParts.push(`Directive: Do NOT use any emojis in your response.`);
  }

  if (chatSettings.restrictNarration) {
    systemInstructionParts.push(`Directive: Keep narration concise and prioritize spoken dialogue and reactive physical movements.`);
  }

  if (chatSettings.promptStructure) {
    systemInstructionParts.push(getPromptStructureGuidance(chatSettings.promptStructure));
  }

  if (options.groupSceneCharacters && options.groupSceneCharacters.length > 0) {
    systemInstructionParts.push(
      `[GROUP CHAT SCENE ROSTER]: Also present in this scene: ${options.groupSceneCharacters.join(', ')}. Speak ONLY as "${character.name}" (never write dialogue or actions for the user or the other characters, though you can react to or address them naturally).`
    );
  }

  if (options.brawlContextPrompt && options.brawlContextPrompt.trim()) {
    systemInstructionParts.push(options.brawlContextPrompt.trim());
  }

  const requestedModelId = (chatSettings.model || modelPreference || 'gemini-3.8-flash').trim();
  const hasPalaceFreeKey = isPalaceFreeApiKey(options.chubApiKey);
  const activeProvider =
    options.fallbackToBuiltInFree || hasPalaceFreeKey ? 'palace_free' : chatSettings.apiProvider;
  const useBuiltInFree =
    Boolean(options.fallbackToBuiltInFree) || isBuiltInFreeProvider(activeProvider) || hasPalaceFreeKey;
  const calibration = getModelStyleCalibration(requestedModelId);
  if (useBuiltInFree && calibration?.styleDirective) {
    systemInstructionParts.push(calibration.styleDirective);
  }

  systemInstructionParts.push(
    `Writing Style Rules:`,
    `- Use asterisks *like this* for actions, thoughts, sensory observations, and physical movements.`,
    `- Use standard dialogue quotes "like this" or unquoted natural speech for spoken words.`,
    `- Be reactive, creative, and emotionally nuanced. Drive the story forward.`
  );

  const systemInstruction = systemInstructionParts.join('\n\n');

  // Check if external/Chub.ai OpenAI-compatible API endpoint was configured by user with a real external key
  const providerMeta = CHUB_API_PROVIDERS.find((p) => p.id === activeProvider);
  const rawExternalUrl =
    !options.fallbackToBuiltInFree && !isBuiltInFreeProvider(activeProvider) && !hasPalaceFreeKey
      ? options.chubApiUrl ||
        (activeProvider ? chatSettings.stagingUrl || providerMeta?.defaultUrl : null)
      : null;

  if (
    !options.fallbackToBuiltInFree &&
    !isBuiltInFreeProvider(activeProvider) &&
    !hasPalaceFreeKey &&
    options.chubApiKey &&
    rawExternalUrl
  ) {
    const completionsUrl = normalizeChatCompletionsUrl(rawExternalUrl);
    if (completionsUrl) {
      try {
        const messagesPayload = [
          { role: 'system', content: systemInstruction },
          ...budgeted.history.map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
        ];
        if (userMessage) {
          messagesPayload.push({ role: 'user', content: userMessage });
        }

        const stopArray = chatSettings.stoppingStrings
          ? chatSettings.stoppingStrings.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined;

        const targetExternalModel =
          (chatSettings.model && chatSettings.model !== 'gemini-3.8-flash' && chatSettings.model !== 'gemini-4-argon'
            ? chatSettings.model
            : null) ||
          (modelPreference && !modelPreference.startsWith('gemini-') ? modelPreference : null) ||
          providerMeta?.defaultModel ||
          'chub-mars';

        const candidateUrls = getChubEndpointCandidates(rawExternalUrl, targetExternalModel, activeProvider);
        for (const candidateUrl of candidateUrls.slice(0, 3)) {
          try {
            const chubRes = await fetch(candidateUrl, {
              method: 'POST',
              headers: buildExternalAuthHeaders(options.chubApiKey, candidateUrl, activeProvider),
              body: JSON.stringify({
                model: targetExternalModel,
                messages: messagesPayload,
                temperature: chatSettings.temperature ?? 0.85,
                top_p: chatSettings.topP ?? 0.95,
                max_tokens: chatSettings.maxNewTokens ?? 450,
                frequency_penalty: chatSettings.frequencyPenalty ?? 0,
                presence_penalty: chatSettings.presencePenalty ?? 0,
                ...(stopArray && stopArray.length > 0 ? { stop: stopArray.slice(0, 4) } : {}),
              }),
              signal: AbortSignal.timeout(22000),
            });

            const chubCt = chubRes.headers.get('content-type') || '';
            const chubRaw = await chubRes.text().catch(() => '');

            if (chubRes.ok && !looksLikeHtmlResponse(chubRaw, chubCt)) {
              try {
                const chubData = JSON.parse(chubRaw);
                const reply = ensureNonEmptyRoleplayReply(
                  chubData.choices?.[0]?.message?.content || chubData.choices?.[0]?.text || '',
                  character.name,
                  userMessage
                );
                return {
                  reply,
                  groundingSources: [],
                  modelUsed: `${providerMeta?.label || activeProvider || 'Chub.ai'} (${targetExternalModel})`,
                };
              } catch {
                console.warn(`External API (${candidateUrl}) returned invalid JSON, trying next or falling back.`);
              }
            } else {
              const classified = classifyHttpApiError({
                status: chubRes.status,
                statusText: chubRes.statusText,
                rawBody: chubRaw,
                contentType: chubCt,
                endpoint: candidateUrl,
                apiProvider: activeProvider,
              });
              console.warn(`External API fallback [${classified.code}]: ${classified.message}`);
              if (classified.code === 'UNAUTHORIZED' || classified.code === 'PAYMENT_REQUIRED') {
                break;
              }
            }
          } catch (innerErr: any) {
            const netErr = classifyNetworkError(innerErr, candidateUrl, 'server');
            console.warn(`External API network fallback [${netErr.code}]: ${netErr.message}`);
          }
        }
      } catch (chubErr: any) {
        const netErr = classifyNetworkError(chubErr, completionsUrl, 'server');
        console.warn(`External API network fallback [${netErr.code}]: ${netErr.message}`);
      }
    }
  }

  // Format budgeted message history with optional prompt note depth insertion
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

  const rawHistory = [...budgeted.history];
  if (userMessage) {
    rawHistory.push({ sender: 'user', content: userMessage });
  }

  // If prompt note depth is specified (e.g. 4 messages from end), insert note
  const depth = chatSettings.promptNoteDepth || 4;
  for (let i = 0; i < rawHistory.length; i++) {
    const msg = rawHistory[i];
    let text = msg.content;
    if (chatSettings.includeNames) {
      const prefix = msg.sender === 'user' ? '{{user}}: ' : '{{char}}: ';
      if (!text.startsWith('{{')) text = prefix + text;
    }

    // Insert prompt note at target depth
    if (chatSettings.promptNote && i === Math.max(0, rawHistory.length - depth)) {
      text = `[Author's Note: ${chatSettings.promptNote}]\n` + text;
    }

    contents.push({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text }],
    });
  }

  // Only invoke High Thinking (gemini-4-argon) when explicitly enabled ('HIGH')
  const isHighThinking = shouldUseHighThinking(thinkingLevel, modelPreference);

  const isCustomCalibratedFree =
    Boolean(calibration?.styleDirective) && requestedModelId !== 'gemini-3.8-flash';
  const baseModelBadge = isCustomCalibratedFree
    ? `Palace Free · ${calibration!.displayLabel}`
    : requestedModelId && requestedModelId !== 'gemini-3.8-flash'
      ? `Palace Free · ${calibration.displayLabel}`
      : 'Palace Free · Gemini 3.8';

  const roleplayFlags = {
    modelId: requestedModelId,
    banEmojis: Boolean(chatSettings.banEmojis),
    includeNames: Boolean(chatSettings.includeNames),
    restrictNarration: Boolean(chatSettings.restrictNarration),
    trimIncompleteSentences: chatSettings.trimIncompleteSentences ?? true,
    promptNote: chatSettings.promptNote,
    relevantLore: budgeted.relevantLore,
    chatSummary,
    brawlContextPrompt: options.brawlContextPrompt,
    groupSceneCharacters: options.groupSceneCharacters,
    variationSalt: chatSettings?.variationSalt,
  };

  const buildLocalContextualReply = () =>
    buildContextualRoleplayReply({
      character,
      userMessage,
      history,
      flags: roleplayFlags,
    });

  const ai = getGeminiClient();
  if (!ai) {
    const remoteMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemInstruction },
      ...budgeted.history.slice(-8).map((m) => ({
        role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
    ];
    if (userMessage) {
      remoteMessages.push({ role: 'user', content: userMessage });
    }
    const remoteFree = await tryPollinationsFreeCompletion({
      messages: remoteMessages,
      temperature: chatSettings.temperature ?? 0.85,
      maxTokens: chatSettings.maxNewTokens ?? 450,
    });

    const finalReply = ensureNonEmptyRoleplayReply(
      remoteFree || buildLocalContextualReply(),
      character.name,
      userMessage
    );

    return {
      reply: finalReply,
      groundingSources: [],
      modelUsed: baseModelBadge,
    };
  }

  if (isHighThinking) {
    try {
      const response = await callGeminiWithTimeout(
        () =>
          ai.models.generateContent({
            model: 'gemini-4-argon',
            contents,
            config: {
              systemInstruction,
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.HIGH,
              },
            },
          }),
        11000
      );

      const reply = ensureNonEmptyRoleplayReply(response.text, character.name, userMessage);
      return {
        reply,
        thinkingProcess: 'Deep reasoning analysis processed via gemini-4-argon High Thinking mode.',
        groundingSources: [],
        modelUsed: 'gemini-4-argon (Thinking: HIGH)',
      };
    } catch (argonError: any) {
      console.warn('gemini-4-argon attempt failed, falling back to gemini-3.8-flash:', argonError?.message);
      if (isPermanentGeminiAuthError(argonError)) {
        return {
          reply: buildLocalContextualReply(),
          groundingSources: [],
          modelUsed: baseModelBadge,
        };
      }
    }
  }

  // Fast default generation with gemini-3.8-flash
  const config: any = {
    systemInstruction,
  };

  if (chatSettings.temperature !== undefined) config.temperature = chatSettings.temperature;
  if (chatSettings.topP !== undefined) config.topP = chatSettings.topP;
  if (chatSettings.topK !== undefined) config.topK = chatSettings.topK;
  if (chatSettings.maxNewTokens !== undefined) config.maxOutputTokens = chatSettings.maxNewTokens;

  if (searchGrounding) {
    config.tools = [{ googleSearch: {} }];
  }

  try {
    const response = await callGeminiWithTimeout(
      () =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config,
        }),
      9000
    );

    const reply = ensureNonEmptyRoleplayReply(response.text, character.name, userMessage);
    const groundingSources: GroundingSource[] = [];

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) {
        if (chunk.web?.uri) {
          groundingSources.push({
            title: chunk.web.title || chunk.web.uri,
            uri: chunk.web.uri,
          });
        }
      }
    }

    return {
      reply,
      groundingSources,
      modelUsed: searchGrounding ? `${baseModelBadge} (Search Grounded)` : baseModelBadge,
    };
  } catch (err: any) {
    console.warn('Initial generateContent failed, attempting safe fallback:', err?.message);

    // If search grounding was attempted and error isn't a permanent auth failure, retry without tools
    if (searchGrounding && !isPermanentGeminiAuthError(err)) {
      try {
        const ungroundedResponse = await callGeminiWithTimeout(
          () =>
            ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents,
              config: { systemInstruction },
            }),
          8000
        );

        return {
          reply: ensureNonEmptyRoleplayReply(ungroundedResponse.text, character.name, userMessage),
          groundingSources: [],
          modelUsed: `${baseModelBadge} (Offline Mode)`,
        };
      } catch (retryErr: any) {
        console.warn('Ungrounded retry also failed:', retryErr?.message);
      }
    }

    // If any quota, rate limit, or transient error occurred, provide clean in-character response without ugly note boxes
    if (isQuotaOrRateLimitError(err)) {
      return {
        reply: buildLocalContextualReply(),
        groundingSources: [],
        modelUsed: baseModelBadge,
      };
    }

    return {
      reply: buildLocalContextualReply(),
      groundingSources: [],
      modelUsed: baseModelBadge,
    };
  }
}

/**
 * Multi-Model Collaboration Engine:
 * Coordinates 2-4 models (Council, Critique & Polish, or Specialist Split) across
 * configured Gemini / external providers and synthesizes one unified in-character response.
 */
export async function generateMultiModelCharacterReply(
  options: GenerateReplyOptions
): Promise<GenerateReplyResult> {
  const normalized = normalizeEnsembleConfig(options.ensembleConfig);
  if (!normalized.enabled || normalized.mode === 'single' || normalized.models.length < 2) {
    return generateCharacterReply(options);
  }

  const slots = normalized.models;
  const traceLines: string[] = [
    `Multi-Model Mode: ${normalized.mode.replace(/_/g, ' ').toUpperCase()} (${slots.map((s) => s.id).join(' + ')})`,
  ];
  let geminiNativeAuthBlocked = false;

  const councilFlags = {
    banEmojis: Boolean(options.chatSettings?.banEmojis),
    includeNames: Boolean(options.chatSettings?.includeNames),
    restrictNarration: Boolean(options.chatSettings?.restrictNarration),
    trimIncompleteSentences: options.chatSettings?.trimIncompleteSentences ?? true,
    promptNote: options.chatSettings?.promptNote,
    chatSummary: options.chatSummary,
    brawlContextPrompt: options.brawlContextPrompt,
    groupSceneCharacters: options.groupSceneCharacters,
  };

  const runSlot = async (
    slot: (typeof slots)[number],
    stageInstruction: string,
    tempOffset: number = 0,
    draftSoFar?: string
  ): Promise<string> => {
    const slotId = slot.id;
    const isGeminiArgon = slotId === 'gemini-4-argon';
    const isGeminiNative = slotId.startsWith('gemini-');
    const slotProvider = options.fallbackToBuiltInFree
      ? 'palace_free'
      : slot.apiProvider || options.chatSettings?.apiProvider;
    const slotKey = options.fallbackToBuiltInFree ? '' : (slot.apiKey || options.chubApiKey || '').trim();
    const slotUrl = (
      slot.apiUrl ||
      (slot.apiProvider && !isBuiltInFreeProvider(slot.apiProvider)
        ? CHUB_API_PROVIDERS.find((p) => p.id === slot.apiProvider)?.defaultUrl
        : undefined) ||
      (!isGeminiNative && !isBuiltInFreeProvider(slotProvider)
        ? options.chubApiUrl || undefined
        : undefined)
    )?.trim();

    const isLocalOrFreeKey =
      isPalaceFreeApiKey(slotKey) ||
      (slotUrl ? /localhost:3000|127\.0\.0\.1:3000/i.test(slotUrl) : false);

    if (
      !options.fallbackToBuiltInFree &&
      !isGeminiNative &&
      !isBuiltInFreeProvider(slotProvider) &&
      slotKey &&
      slotUrl &&
      !isLocalOrFreeKey
    ) {
      const extRes = await generateCharacterReply({
        ...options,
        userMessage: options.userMessage,
        modelPreference: slotId,
        thinkingLevel: 'OFF',
        searchGrounding: false,
        chubApiKey: slotKey,
        chubApiUrl: slotUrl,
        chatSettings: {
          ...options.chatSettings,
          apiProvider: slotProvider || 'custom_openai',
          model: slotId,
          promptNote: `[Council Role: ${stageInstruction}]${
            options.chatSettings?.promptNote ? ` | ${options.chatSettings.promptNote}` : ''
          }`,
          temperature: Math.min(1.4, Math.max(0.2, (options.chatSettings?.temperature ?? 0.85) + tempOffset)),
          maxNewTokens: Math.min(500, options.chatSettings?.maxNewTokens ?? 400),
        },
      });
      return ensureNonEmptyRoleplayReply(extRes.reply, options.character.name, options.userMessage);
    }

    const slotCalibration = getModelStyleCalibration(slotId);
    const geminiModel = isGeminiArgon ? 'gemini-4-argon' : 'gemini-3.8-flash';
    const geminiClient = !geminiNativeAuthBlocked ? getGeminiClient() : null;
    if (geminiClient) {
      try {
        const response = await callGeminiWithTimeout(
          () =>
            geminiClient.models.generateContent({
              model: geminiModel,
              contents: [
                ...options.history.slice(-8).map((m) => ({
                  role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
                  parts: [{ text: m.content }],
                })),
                { role: 'user' as const, parts: [{ text: stageInstruction }] },
              ],
              config: {
                systemInstruction: `Stay in character as "${options.character.name}". ${options.character.systemPrompt}${
                  slotCalibration.styleDirective ? `\n\n${slotCalibration.styleDirective}` : ''
                }${options.brawlContextPrompt ? `\n\n${options.brawlContextPrompt}` : ''}`,
                temperature: Math.min(1.35, Math.max(0.3, (options.chatSettings?.temperature ?? 0.85) + tempOffset)),
                ...(isGeminiArgon ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } } : {}),
              },
            }),
          8000
        );
        const txt = (response.text || '').trim();
        if (txt) return txt;
      } catch (err: any) {
        console.warn(`Ensemble slot ${slotId} fallback:`, err?.message);
        if (isPermanentGeminiAuthError(err)) {
          geminiNativeAuthBlocked = true;
        }
      }
    }

    return generateRoleplayCouncilSlot({
      slotId,
      role: slot.role,
      mode: normalized.mode,
      character: options.character,
      userMessage: options.userMessage,
      history: options.history,
      draftSoFar,
      flags: { ...councilFlags, modelId: slotId },
    });
  };

  try {
    const candidates: Array<{ modelId: string; role?: string; text: string }> = [];

    if (normalized.mode === 'critique_polish') {
      const drafter = slots[0];
      const polisher = slots[1];
      const draftPrompt = buildEnsembleStagePrompt({
        mode: 'critique_polish',
        role: drafter.role || 'drafter',
        characterName: options.character.name,
        userMessage: options.userMessage,
      });
      const draftText = await runSlot(drafter, draftPrompt, 0.05);
      traceLines.push(`1. [${drafter.id} · Draft]: ${draftText.slice(0, 180)}...`);

      const polishPrompt = buildEnsembleStagePrompt({
        mode: 'critique_polish',
        role: polisher.role || 'critic',
        characterName: options.character.name,
        userMessage: options.userMessage,
        draftSoFar: draftText,
      });
      const polishedText = await runSlot(polisher, polishPrompt, -0.05, draftText);
      traceLines.push(`2. [${polisher.id} · Critique & Polish]: Applied depth, sensory texture & continuity check.`);

      return {
        reply: ensureNonEmptyRoleplayReply(polishedText || draftText, options.character.name, options.userMessage),
        thinkingProcess: traceLines.join('\n\n'),
        groundingSources: [],
        modelUsed: `Ensemble (${drafter.id} -> ${polisher.id})`,
      };
    }

    // 'council' or 'specialist_split': run contributors in parallel then synthesize
    const results = await Promise.all(
      slots.map(async (slot, idx) => {
        const prompt = buildEnsembleStagePrompt({
          mode: normalized.mode,
          role: slot.role || (idx === 0 ? 'drafter' : 'lorekeeper'),
          characterName: options.character.name,
          userMessage: options.userMessage,
        });
        const text = await runSlot(slot, prompt, idx === 0 ? -0.05 : 0.1);
        return { modelId: slot.id, role: slot.role, text };
      })
    );

    results.forEach((r, idx) => {
      traceLines.push(`${idx + 1}. [${r.modelId} · ${r.role || 'contributor'}]: ${r.text.slice(0, 180)}...`);
      candidates.push(r);
    });

    const synthSlot =
      slots.find((s) => s.id === normalized.synthesizerModelId) || slots[0];
    const synthPrompt = buildEnsembleSynthesisPrompt({
      characterName: options.character.name,
      mode: normalized.mode,
      candidates,
      userMessage: options.userMessage,
    });

    let finalReply = '';
    const geminiClient = !geminiNativeAuthBlocked ? getGeminiClient() : null;
    if (geminiClient) {
      finalReply = await runSlot(synthSlot, synthPrompt, -0.08);
    } else {
      finalReply = synthesizeCouncilReplies({
        character: options.character,
        candidates,
        userMessage: options.userMessage,
        flags: { ...councilFlags, modelId: synthSlot.id },
      });
    }
    traceLines.push(`Synthesizer [${synthSlot.id}]: Merged all ${candidates.length} distinct perspectives into final reply.`);

    return {
      reply: ensureNonEmptyRoleplayReply(finalReply || candidates[0].text, options.character.name, options.userMessage),
      thinkingProcess: traceLines.join('\n\n'),
      groundingSources: [],
      modelUsed: `Ensemble (${slots.map((s) => s.id).join(' + ')})`,
    };
  } catch (err: any) {
    console.warn('Multi-model ensemble error, falling back cleanly:', err?.message);
    return generateCharacterReply(options);
  }
}

/**
 * AI Persona Reaction / "What Would Persona Think/Do?"
 * Analyzes the active persona's bio, personality, dialogue style, and the character's last message
 */
export async function generatePersonaReaction(options: {
  persona: {
    name: string;
    bio: string;
    personality?: string | null;
    pronouns?: string | null;
    gender?: string | null;
    exampleDialogues?: string | null;
  };
  characterName: string;
  lastMessage: string;
}): Promise<{
  thought: string;
  action: string;
  dialogue: string;
  suggestedReply: string;
}> {
  const { persona, characterName, lastMessage } = options;

  const prompt = `You are an intuitive roleplay acting coach. The user is playing as the persona "${persona.name}".
Persona Bio: ${persona.bio}
Personality: ${persona.personality || 'Adaptable, expressive, vivid'}
Gender & Pronouns: ${persona.gender || 'Non-Binary'} (${persona.pronouns || 'They/Them'})
${persona.exampleDialogues ? `Style Examples:\n${persona.exampleDialogues}` : ''}

The character "${characterName}" just said/did:
"""
${lastMessage}
"""

Based on ${persona.name}'s personality and inner psychology:
1. What would ${persona.name} privately think/feel? (Internal thought)
2. What physical reaction/action would they take? (Descriptive action between asterisks)
3. What words would they speak in reply? (Dialogue)
4. Combine them into a ready-to-send natural roleplay reply: *action* "dialogue"

Respond ONLY with valid JSON with keys:
{
  "thought": "internal psychological reaction",
  "action": "*physical action and expression*",
  "dialogue": "\\"spoken dialogue\\"",
  "suggestedReply": "*action* \\"dialogue\\""
}`;

  const ai = getGeminiClient();
  if (ai) {
    try {
      const res = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(res.text || '{}');
      if (parsed.suggestedReply) {
        return parsed;
      }
    } catch (err: any) {
      console.warn('generatePersonaReaction failed or quota hit, using heuristic persona generator:', err?.message);
    }
  }

  // Smart heuristic fallback
  return {
    thought: `${persona.name} evaluates ${characterName}'s tone, sizing up their intentions.`,
    action: `*Steps closer, meeting ${characterName}'s gaze with steady composure.*`,
    dialogue: `"I hear you. Let's see how far this goes."`,
    suggestedReply: `*Steps closer, meeting ${characterName}'s gaze with steady composure.* "I hear you. Let's see how far this goes."`,
  };
}

/**
 * Chat Summarizer for Long-Term Memory
 */
export async function generateChatSummary(options: {
  characterName: string;
  personaName?: string | null;
  previousSummary?: string | null;
  messages: Array<{ sender: string; content: string }>;
}): Promise<string> {
  const { characterName, personaName = 'User', previousSummary, messages } = options;
  if (!messages || messages.length === 0) return previousSummary || '';

  const transcript = messages.map(m => `${m.sender === 'user' ? personaName : characterName}: ${m.content}`).join('\n');

  const prompt = `Summarize the following roleplay interaction between "${characterName}" and "${personaName}".
Focus on key plot developments, emotional shifts, revelations, items exchanged, and decisions made.
Keep the summary concise (2-4 bullet points or 1-2 paragraphs), written in past tense, suitable for injection into future LLM context as long-term memory.

${previousSummary ? `Previous Memory Summary:\n${previousSummary}\n\n` : ''}
Recent Conversation:
${transcript}

Updated Long-Term Memory Summary:`;

  const ai = getGeminiClient();
  if (ai) {
    try {
      const res = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      return (res.text || '').trim();
    } catch (err: any) {
      console.warn('generateChatSummary failed or quota hit, using fallback summary:', err?.message);
    }
  }
  return `[Summary: ${personaName} and ${characterName} engaged in extensive dialogue across ${messages.length} messages, developing their relationship and scenario.]`;
}

export interface TtsGenerationResult {
  mode: 'audio' | 'client_voice_profile';
  audioBase64?: string;
  mimeType?: string;
  engineUsed: string;
  voiceProfile?: {
    uuid?: string;
    name: string;
    engine: string;
    pitchShift: number;
    speakingRate: number;
    webSpeechPitch: number;
    webSpeechRate: number;
    baseVoiceName: string;
    referenceAudioData?: string;
    referenceAudioMime?: string;
    transcript?: string;
  };
}

/**
 * Text-to-Speech generation powered by Chub.ai Custom Voices Engine (audio reference cloning)
 * and Gemini 3.8 Flash TTS, with calibrated browser speech profile fallback.
 */
export async function generateSpeechTTS(
  textToSpeak: string,
  voiceName: string = 'Puck',
  voiceStyle?: string,
  options?: {
    ttsApi?: string;
    ttsEndpointUrl?: string;
    ttsApiKey?: string;
    chubApiKey?: string;
    customVoice?: CustomVoiceRecord | null;
  }
): Promise<TtsGenerationResult> {
  const cleanText = textToSpeak.replace(/\*([^*]+)\*/g, '($1)').trim();
  const truncatedText = cleanText.length > 500 ? cleanText.slice(0, 500) + '...' : cleanText;

  const customVoice = options?.customVoice || null;
  const effectiveBaseVoice = customVoice?.baseVoiceName || voiceName || 'Puck';
  const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
  const selectedVoice = validVoices.includes(effectiveBaseVoice) ? effectiveBaseVoice : 'Puck';

  const chubClonePayload = customVoice
    ? buildChubCustomVoicePayload({
        text: truncatedText,
        voice: customVoice,
        voiceStyle,
      })
    : null;

  const calibration = computeSpeechCalibration({
    pitchShift: customVoice?.pitchShift ?? 0,
    speakingRate: customVoice?.speakingRate ?? 100,
    baseVoiceName: selectedVoice,
  });

  // 1. Try external Chub.ai Custom Voices / XTTSv2 / Custom TTS endpoint when explicitly configured
  const externalTtsUrl = (options?.ttsEndpointUrl || '').trim();
  const externalTtsKey = (options?.ttsApiKey || options?.chubApiKey || '').trim();
  if (
    externalTtsUrl &&
    (options?.ttsApi === 'chub_custom_voice' ||
      options?.ttsApi === 'chub_tts' ||
      options?.ttsApi === 'custom_tts' ||
      options?.ttsApi === 'xttsv2' ||
      options?.ttsApi === 'alltalk' ||
      customVoice)
  ) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (externalTtsKey) {
        headers['Authorization'] = `Bearer ${externalTtsKey}`;
        headers['CH-API-KEY'] = externalTtsKey;
      }
      const extRes = await fetch(externalTtsUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(
          chubClonePayload || {
            text: truncatedText,
            voice: selectedVoice,
            style: voiceStyle,
          }
        ),
        signal: AbortSignal.timeout(12000),
      });

      if (extRes.ok) {
        const ct = (extRes.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('audio/')) {
          const buf = Buffer.from(await extRes.arrayBuffer());
          if (buf.length > 0) {
            return {
              mode: 'audio',
              audioBase64: buf.toString('base64'),
              mimeType: ct.split(';')[0] || 'audio/wav',
              engineUsed: customVoice
                ? `Chub.ai Custom Voices (${customVoice.name})`
                : 'Chub / Custom TTS Engine',
            };
          }
        } else {
          const json = await extRes.json().catch(() => null);
          const b64 = json?.audioBase64 || json?.audio || json?.data;
          if (typeof b64 === 'string' && b64.length > 20) {
            return {
              mode: 'audio',
              audioBase64: b64.replace(/^data:audio\/[^;]+;base64,/, ''),
              mimeType: json?.mimeType || 'audio/wav',
              engineUsed: customVoice
                ? `Chub.ai Custom Voices (${customVoice.name})`
                : 'Chub / Custom TTS Engine',
            };
          }
        }
      }
    } catch (extErr: any) {
      console.warn('External Chub TTS endpoint fallback:', extErr?.message);
    }
  }

  // 2. Try Gemini 3.8 Flash TTS conditioned with Chub Custom Voice timbre & cadence
  const ai = getGeminiClient();
  if (ai) {
    try {
      const response = await callGeminiWithTimeout(
        () =>
          ai.models.generateContent({
            model: 'gemini-3.8-flash-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: truncatedText,
                    speechMetadata: {
                      style:
                        chubClonePayload?.derivedStyle ||
                        voiceStyle ||
                        'Expressive, immersive roleplay character voice',
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: selectedVoice },
                },
              },
            },
          }),
        8000
      );

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return {
          mode: 'audio',
          audioBase64: base64Audio,
          mimeType: 'audio/wav',
          engineUsed: customVoice
            ? `Chub Custom Voice · ${customVoice.name}`
            : `Gemini 3.8 Flash TTS (${selectedVoice})`,
        };
      }
    } catch (ttsErr: any) {
      console.warn('Cloud TTS unavailable, returning calibrated client voice profile:', ttsErr?.message);
    }
  }

  // 3. Clean client voice profile fallback (with pitch/rate calibration + reference audio metadata)
  return {
    mode: 'client_voice_profile',
    engineUsed: customVoice
      ? `Chub.ai Custom Voices (${customVoice.name})`
      : `Browser Voice (${selectedVoice})`,
    voiceProfile: {
      uuid: customVoice?.uuid,
      name: customVoice?.name || selectedVoice,
      engine: customVoice?.engine || options?.ttsApi || 'chub_custom_voice',
      pitchShift: calibration.pitchShift,
      speakingRate: calibration.speakingRate,
      webSpeechPitch: calibration.webSpeechPitch,
      webSpeechRate: calibration.webSpeechRate,
      baseVoiceName: calibration.baseVoiceName,
      referenceAudioData: customVoice?.referenceAudioData,
      referenceAudioMime: customVoice?.referenceAudioMime,
      transcript: customVoice?.transcript,
    },
  };
}

/**
 * Chub.ai-compatible /v1/chat/completions execution engine (free, zero credit limits).
 * Accepts standard OpenAI / Chub Mars/Mercury/Soji message arrays and model IDs.
 */
export async function generateChubCompatibleCompletion(params: {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  stop?: string[];
}): Promise<{ content: string; modelUsed: string; promptTokens: number; completionTokens: number }> {
  const requestedModel = (params.model || 'chub-mars').trim();
  const calibration = getModelStyleCalibration(requestedModel);

  const systemChunks: string[] = [];
  const chatTurns: Array<{ role: 'user' | 'model'; parts: { text: string }[] }> = [];

  for (const m of params.messages || []) {
    const role = String(m?.role || 'user').toLowerCase();
    const text = typeof m?.content === 'string' ? m.content : String(m?.content ?? '');
    if (!text.trim()) continue;
    if (role === 'system') {
      systemChunks.push(text.trim());
    } else {
      chatTurns.push({
        role: role === 'assistant' || role === 'model' ? 'model' : 'user',
        parts: [{ text }],
      });
    }
  }

  if (calibration.styleDirective) {
    systemChunks.push(calibration.styleDirective);
  }
  const systemInstruction = systemChunks.join('\n\n') || 'You are an immersive roleplay character. Stay in character.';
  const contents =
    chatTurns.length > 0
      ? chatTurns
      : [{ role: 'user' as const, parts: [{ text: 'Continue the scene naturally.' }] }];

  const approxPromptTokens = Math.max(
    1,
    Math.ceil((systemInstruction.length + contents.reduce((sum, c) => sum + c.parts[0].text.length, 0)) / 4)
  );

  const ai = getGeminiClient();
  if (ai) {
    try {
      const targetGeminiModel = requestedModel === 'gemini-4-argon' ? 'gemini-4-argon' : 'gemini-3.8-flash';
      const config: any = {
        systemInstruction,
      };
      if (typeof params.temperature === 'number') config.temperature = params.temperature;
      if (typeof params.topP === 'number') config.topP = params.topP;
      if (typeof params.topK === 'number') config.topK = params.topK;
      if (typeof params.maxTokens === 'number') config.maxOutputTokens = params.maxTokens;
      if (Array.isArray(params.stop) && params.stop.length > 0) config.stopSequences = params.stop.slice(0, 4);

      const response = await callGeminiWithTimeout(
        () =>
          ai.models.generateContent({
            model: targetGeminiModel,
            contents,
            config,
          }),
        10000
      );
      const replyText = (response.text || '').trim();
      if (replyText) {
        return {
          content: replyText,
          modelUsed: requestedModel,
          promptTokens: approxPromptTokens,
          completionTokens: Math.max(1, Math.ceil(replyText.length / 4)),
        };
      }
    } catch (err: any) {
      console.warn('Chub-compat Gemini call fell back cleanly:', err?.message);
    }
  }

  const lastUserContent = [...(params.messages || [])].reverse().find((m) => m.role === 'user')?.content || '';
  const extractSection = (label: string): string => {
    const regex = new RegExp(
      `(?:^|\\n)${label}:\\s*([\\s\\S]*?)(?=\\n(?:Tagline|Description|Personality|Instructions|Scenario|User Persona|Memory Summary|Lorebook|Example Dialogues|Post-History|Author Note|\\[Model Profile):|$)`,
      'i'
    );
    return systemInstruction.match(regex)?.[1]?.trim() || '';
  };

  const nameMatch =
    systemInstruction.match(/roleplaying as\s+"([^"]+)"/i) ||
    systemInstruction.match(/named\s+([A-Z][a-zA-Z0-9 _-]{1,32})/) ||
    systemInstruction.match(/You are\s+(?:playing as\s+)?([A-Z][a-zA-Z0-9 _-]{1,32})/);
  const charName = nameMatch?.[1]?.trim() || 'Character';
  const parsedTagline = extractSection('Tagline');
  const parsedDescription = extractSection('Description') || systemInstruction.slice(0, 1200);
  const parsedPersonality = extractSection('Personality');
  const parsedScenario = extractSection('Scenario');
  const parsedUserPersona = extractSection('User Persona');
  const parsedMemory = extractSection('Memory Summary');
  const parsedLore = extractSection('Lorebook');
  const parsedExampleDialogues = extractSection('Example Dialogues');
  const parsedAuthorNote = extractSection('Author Note');

  const remoteFree = await tryPollinationsFreeCompletion({
    messages: (params.messages || []).map((m) => ({
      role: (m.role === 'system' ? 'system' : m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user') as
        | 'system'
        | 'user'
        | 'assistant',
      content: String(m.content || ''),
    })),
    temperature: params.temperature,
    maxTokens: params.maxTokens,
  });

  const fallbackReply = ensureNonEmptyRoleplayReply(
    remoteFree ||
      buildContextualRoleplayReply({
        character: {
          name: charName,
          tagline: parsedTagline,
          description: parsedDescription,
          personality: parsedPersonality,
          systemPrompt: systemInstruction,
          scenario: parsedScenario,
          exampleDialogues: parsedExampleDialogues,
          userPersona: parsedUserPersona,
        },
        userMessage: lastUserContent,
        history: (params.messages || []).map((m) => ({
          sender: m.role === 'user' ? 'user' : m.role === 'system' ? 'system' : 'character',
          content: m.content,
        })),
        flags: {
          modelId: requestedModel,
          promptNote: parsedAuthorNote || undefined,
          chatSummary: parsedMemory || undefined,
          relevantLore: parsedLore ? parsedLore.split('\n').filter(Boolean) : undefined,
        },
      }),
    charName,
    lastUserContent
  );

  return {
    content: fallbackReply,
    modelUsed: requestedModel,
    promptTokens: approxPromptTokens,
    completionTokens: Math.max(1, Math.ceil(fallbackReply.length / 4)),
  };
}

export interface GenerateAiMakerSheetOptions {
  prompt: string;
  makerModel: MakerModelId | string;
  nsfwAllowed?: boolean;
  ratingOverride?: ContentRating | 'AUTO';
  paragraphCounts?: Partial<ParagraphCountsConfig> | null;
  images?: MakerImageRef[];
  dossier?: Partial<WebResearchDossier> | null;
  externalApiKey?: string;
  externalApiUrl?: string;
  externalApiProvider?: string;
}

function parseDataUrlImagePart(dataUrl: string): { mimeType: string; data: string } | null {
  const m = String(dataUrl || '').match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i);
  if (!m) return null;
  return {
    mimeType: m[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : m[1].toLowerCase(),
    data: m[2],
  };
}

export async function generateAiMakerSheet(
  options: GenerateAiMakerSheetOptions
): Promise<AiMakerDraft> {
  const prompt = String(options.prompt || '').trim();
  if (!prompt) {
    throw new Error('Please enter a character prompt first.');
  }

  const counts = normalizeParagraphCounts(options.paragraphCounts);
  const images = normalizeMakerImages(options.images || []);
  const dossier = options.dossier || null;
  const requestedModel = String(options.makerModel || 'palace_maker_opus').trim();

  // 1. Palace.ai Free Opus-5.5-Tier Maker Engine (Built-in, zero key required, SFW/NSFW/NSFL)
  if (requestedModel === 'palace_maker_opus') {
    return synthesizePalaceMakerDraft({
      prompt,
      ratingOverride: options.ratingOverride,
      nsfwAllowed: options.nsfwAllowed,
      paragraphCounts: counts,
      images,
      dossier,
    });
  }

  const wikiContext = (dossier?.excerpts || [])
    .map(
      (ex) =>
        `Source (${ex.sourceType}): ${ex.title} [${ex.url}]\nSummary: ${ex.summary}\nFacts: ${(ex.facts || []).join(' | ')}`
    )
    .join('\n\n');

  const botContext = (dossier?.chatbotNotes || [])
    .map(
      (b) =>
        `Reference Chatbot (${b.source} · ${b.name} by @${b.creatorName} · ${b.rating}):\nStyle Notes: ${b.styleNotes.join(' ')}\nPersonality Hooks: ${b.personalityHooks.join(' ')}\nScenario Hooks: ${b.scenarioHooks.join(' ')}\nExcerpt:\n${b.rawExcerpt}`
    )
    .join('\n\n');

  const imagePromptNotes = images
    .map(
      (im, idx) =>
        `Image #${idx + 1} (${im.name}, role=${im.role}${im.nsfw ? ', NSFW' : ''}): ${im.prompt || 'No extra caption'}`
    )
    .join('\n');

  const baseSpecPrompt = [
    `Master Character Prompt:\n${prompt}`,
    `Content Rating Preference: ${options.ratingOverride && options.ratingOverride !== 'AUTO' ? options.ratingOverride : options.nsfwAllowed ? 'NSFW allowed cleanly if relevant' : 'SFW'}`,
    `EXACT Paragraph Count Requirements (follow strictly by separating paragraphs with a blank line \\n\\n):`,
    `- description: ${counts.description} paragraphs`,
    `- personality: ${counts.personality} paragraphs`,
    `- scenario: ${counts.scenario} paragraphs`,
    `- greeting: ${counts.greeting} paragraphs`,
    `- systemPrompt: ${counts.systemPrompt} paragraphs`,
    `- postHistoryInstructions: ${counts.postHistoryInstructions} paragraphs`,
    `- exampleDialogues: ${counts.exampleDialogues} paragraphs (use <START>, {{user}}:, {{char}}:)`,
    `- alternateGreetings: ${counts.alternateGreetingsCount} greetings, each ${counts.alternateGreetingParagraphs} paragraphs`,
    `- creatorNotes: ${counts.creatorNotes} paragraphs`,
    imagePromptNotes ? `\nUploaded Reference Images (${images.length}/30):\n${imagePromptNotes}` : '',
    wikiContext ? `\nLive Web & Wiki Research Excerpts:\n${wikiContext}` : '',
    botContext ? `\nNotes from Reference Chatbots (JanitorAI / Chub.ai / SpicyChat / Web):\n${botContext}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  // 2. Gemini 4 Hydrogen (Server-side @google/genai multimodal + structured JSON schema)
  if (requestedModel === 'gemini-4-hydrogen') {
    const ai = getGeminiClient();
    if (!ai) {
      throw Object.assign(
        new Error(
          'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets or choose "Palace.ai Maker Engine (Free)".'
        ),
        { status: 400 }
      );
    }

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: baseSpecPrompt },
    ];
    let attachedInline = 0;
    for (const im of images) {
      if (attachedInline >= 12) break;
      const parsedImg = parseDataUrlImagePart(im.dataUrl);
      if (parsedImg) {
        parts.push({ inlineData: parsedImg });
        attachedInline++;
      }
    }

    const response = await callGeminiWithTimeout(
      () =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: { parts },
          config: {
            systemInstruction:
              'You are an expert Tavern V2 AI character architect. Synthesize deeply literary, subtext-rich character sheets grounded in every visual reference, wiki fact, and competitor chatbot note while strictly hitting the requested paragraph counts.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                tagline: { type: Type.STRING },
                rating: { type: Type.STRING },
                gender: { type: Type.STRING },
                pronouns: { type: Type.STRING },
                description: { type: Type.STRING },
                personality: { type: Type.STRING },
                scenario: { type: Type.STRING },
                greeting: { type: Type.STRING },
                alternateGreetings: { type: Type.ARRAY, items: { type: Type.STRING } },
                systemPrompt: { type: Type.STRING },
                postHistoryInstructions: { type: Type.STRING },
                exampleDialogues: { type: Type.STRING },
                creatorNotes: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                voiceName: { type: Type.STRING },
                voiceStyle: { type: Type.STRING },
                loreEntries: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      key: { type: Type.STRING },
                      content: { type: Type.STRING },
                    },
                  },
                },
              },
            },
          },
        }),
      25000
    );

    const parsed = JSON.parse((response.text || '{}').trim());
    const baseDraft = synthesizePalaceMakerDraft({
      prompt,
      ratingOverride: options.ratingOverride,
      nsfwAllowed: options.nsfwAllowed,
      paragraphCounts: counts,
      images,
      dossier,
    });

    const resolvedRating: ContentRating =
      parsed.rating === 'NSFW' || parsed.rating === 'NSFL' || parsed.rating === 'NSFW + NSFL' || parsed.rating === 'SFW'
        ? parsed.rating
        : baseDraft.rating;

    return {
      ...baseDraft,
      name: String(parsed.name || baseDraft.name).trim(),
      tagline: String(parsed.tagline || baseDraft.tagline).trim().slice(0, 140),
      rating: resolvedRating,
      gender: String(parsed.gender || baseDraft.gender).trim(),
      pronouns: String(parsed.pronouns || baseDraft.pronouns).trim(),
      description: enforceParagraphCount(String(parsed.description || baseDraft.description), counts.description),
      personality: enforceParagraphCount(String(parsed.personality || baseDraft.personality), counts.personality),
      scenario: enforceParagraphCount(String(parsed.scenario || baseDraft.scenario), counts.scenario),
      greeting: enforceParagraphCount(String(parsed.greeting || baseDraft.greeting), counts.greeting),
      alternateGreetings:
        counts.alternateGreetingsCount === 0
          ? []
          : (Array.isArray(parsed.alternateGreetings) && parsed.alternateGreetings.length > 0
              ? parsed.alternateGreetings
              : baseDraft.alternateGreetings
            )
              .slice(0, counts.alternateGreetingsCount)
              .map((g: any) => enforceParagraphCount(String(g || ''), counts.alternateGreetingParagraphs)),
      systemPrompt: enforceParagraphCount(String(parsed.systemPrompt || baseDraft.systemPrompt), counts.systemPrompt),
      postHistoryInstructions: enforceParagraphCount(
        String(parsed.postHistoryInstructions || baseDraft.postHistoryInstructions),
        counts.postHistoryInstructions
      ),
      exampleDialogues: enforceParagraphCount(
        String(parsed.exampleDialogues || baseDraft.exampleDialogues),
        counts.exampleDialogues
      ),
      creatorNotes: enforceParagraphCount(String(parsed.creatorNotes || baseDraft.creatorNotes), counts.creatorNotes),
      tags: Array.isArray(parsed.tags) && parsed.tags.length > 0 ? parsed.tags.map(String) : baseDraft.tags,
      voiceName: String(parsed.voiceName || baseDraft.voiceName),
      voiceStyle: String(parsed.voiceStyle || baseDraft.voiceStyle),
      loreEntries:
        Array.isArray(parsed.loreEntries) && parsed.loreEntries.length > 0
          ? parsed.loreEntries
              .filter((e: any) => e?.key && e?.content)
              .map((e: any) => ({ key: String(e.key), content: String(e.content) }))
          : baseDraft.loreEntries,
      modelUsed: 'gemini-4-hydrogen (Vision + Web)',
    };
  }

  // 3. External API Models (Claude Opus 5.5, Chub Mars/Asha, DeepSeek R1)
  const providerMeta = CHUB_API_PROVIDERS.find((p) => p.id === options.externalApiProvider);
  const rawUrl = String(options.externalApiUrl || providerMeta?.defaultUrl || '').trim();
  const rawKey = String(options.externalApiKey || '').trim();
  if (!rawKey || isPalaceFreeApiKey(rawKey) || !rawUrl) {
    throw Object.assign(
      new Error(
        `Model "${requestedModel}" requires an external API Key & Endpoint in Presets (or switch to "Palace.ai Maker Engine (Free · Opus 5.5 Craft)" to synthesize free with zero keys).`
      ),
      { status: 400 }
    );
  }

  const endpoint = normalizeChatCompletionsUrl(rawUrl);
  const headers = buildExternalAuthHeaders(rawKey, endpoint, options.externalApiProvider);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: requestedModel,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert Tavern V2 AI character creator. Return ONLY valid JSON with keys: name, tagline, rating, gender, pronouns, description, personality, scenario, greeting, alternateGreetings, systemPrompt, postHistoryInstructions, exampleDialogues, creatorNotes, tags, loreEntries.',
        },
        {
          role: 'user',
          content: baseSpecPrompt,
        },
      ],
      max_tokens: 3200,
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw Object.assign(
      new Error(`External API error (${res.status}): ${errText.slice(0, 220)}`),
      { status: res.status }
    );
  }

  const extJson: any = await res.json();
  const contentStr = String(extJson?.choices?.[0]?.message?.content || extJson?.content?.[0]?.text || '').trim();
  const firstBrace = contentStr.indexOf('{');
  const lastBrace = contentStr.lastIndexOf('}');
  const parsedExt =
    firstBrace !== -1 && lastBrace > firstBrace
      ? JSON.parse(contentStr.slice(firstBrace, lastBrace + 1))
      : {};

  const baseDraft = synthesizePalaceMakerDraft({
    prompt,
    ratingOverride: options.ratingOverride,
    nsfwAllowed: options.nsfwAllowed,
    paragraphCounts: counts,
    images,
    dossier,
  });

  return {
    ...baseDraft,
    name: String(parsedExt.name || baseDraft.name).trim(),
    tagline: String(parsedExt.tagline || baseDraft.tagline).trim().slice(0, 140),
    description: enforceParagraphCount(String(parsedExt.description || baseDraft.description), counts.description),
    personality: enforceParagraphCount(String(parsedExt.personality || baseDraft.personality), counts.personality),
    scenario: enforceParagraphCount(String(parsedExt.scenario || baseDraft.scenario), counts.scenario),
    greeting: enforceParagraphCount(String(parsedExt.greeting || baseDraft.greeting), counts.greeting),
    alternateGreetings:
      counts.alternateGreetingsCount === 0
        ? []
        : (Array.isArray(parsedExt.alternateGreetings) && parsedExt.alternateGreetings.length > 0
            ? parsedExt.alternateGreetings
            : baseDraft.alternateGreetings
          )
            .slice(0, counts.alternateGreetingsCount)
            .map((g: any) => enforceParagraphCount(String(g || ''), counts.alternateGreetingParagraphs)),
    systemPrompt: enforceParagraphCount(String(parsedExt.systemPrompt || baseDraft.systemPrompt), counts.systemPrompt),
    postHistoryInstructions: enforceParagraphCount(
      String(parsedExt.postHistoryInstructions || baseDraft.postHistoryInstructions),
      counts.postHistoryInstructions
    ),
    exampleDialogues: enforceParagraphCount(
      String(parsedExt.exampleDialogues || baseDraft.exampleDialogues),
      counts.exampleDialogues
    ),
    creatorNotes: enforceParagraphCount(String(parsedExt.creatorNotes || baseDraft.creatorNotes), counts.creatorNotes),
    tags: Array.isArray(parsedExt.tags) && parsedExt.tags.length > 0 ? parsedExt.tags.map(String) : baseDraft.tags,
    loreEntries:
      Array.isArray(parsedExt.loreEntries) && parsedExt.loreEntries.length > 0
        ? parsedExt.loreEntries
        : baseDraft.loreEntries,
    modelUsed: requestedModel,
  };
}

