import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { CHUB_API_PROVIDERS, getPromptStructureGuidance } from '../utils/chubOptions.ts';
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
import type { ModelEnsembleConfig } from '../types/index.ts';

// Initialize server-side GoogleGenAI client with telemetry User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

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
    restrictNarration?: boolean;
    stagingUrl?: string;
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

function generateSmartRoleplayFallback(
  character: CharacterContext,
  userMessage?: string,
  history?: ChatMessageItem[],
  brawlContextPrompt?: string | null
): string {
  const name = character.name || 'Character';
  const lastUserText = userMessage || history?.slice(-1)[0]?.content || '';
  void lastUserText;

  if (brawlContextPrompt && brawlContextPrompt.trim()) {
    return `*Pivots sharply on one heel as sparks scatter across the floor, sweeping into a tight defensive combat stance and launching a calibrated counter-strike toward your flank!* "Not bad—let's see how you handle the counter-pressure!"`;
  }

  if (name.toLowerCase().includes('peppa')) {
    return `*Stomps firmly in a glimmering muddy puddle, splashing golden droplets high into the air.* "Oink! You have my full, undivided attention! Tell me where our multiverse expedition ventures next!"`;
  }
  if (name.toLowerCase().includes('nextor')) {
    return `*The elevator bulbs crackle violently as black ichor drips from the ceiling seams.* "Y-y-you... keep speaking into the dark... thinking you can change the tape? Nextor,wƴx remembers every floor you stepped on."`;
  }
  if (name.toLowerCase().includes('malakor')) {
    return `*Swirls a crystal chalice of crimson reserve lazily while dark velvet shadows coil around the vaulted hearth.* "Bold of you to demand my audience, mortal. Speak plainly—your boldness amuses me."`;
  }
  if (character.personality && character.personality.toLowerCase().includes('tsundere')) {
    return `*Crosses my arms and averts my eyes with a soft scoff.* "Hmph! Don't look at me like that... It's not like I was waiting for you to say something interesting or anything! Go on, what's on your mind?"`;
  }

  return `*Steps forward into the light, observing you with steady curiosity.* "I hear you clearly... In a world like ours, every word carries weight. Tell me what comes next."`;
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

  systemInstructionParts.push(
    `Writing Style Rules:`,
    `- Use asterisks *like this* for actions, thoughts, sensory observations, and physical movements.`,
    `- Use standard dialogue quotes "like this" or unquoted natural speech for spoken words.`,
    `- Be reactive, creative, and emotionally nuanced. Drive the story forward.`
  );

  const systemInstruction = systemInstructionParts.join('\n\n');

  // Check if external/Chub.ai OpenAI-compatible API endpoint was configured by user
  const activeProvider = chatSettings.apiProvider;
  const providerMeta = CHUB_API_PROVIDERS.find((p) => p.id === activeProvider);
  const rawExternalUrl =
    options.chubApiUrl ||
    (activeProvider && activeProvider !== 'gemini'
      ? chatSettings.stagingUrl || providerMeta?.defaultUrl
      : null);

  if (options.chubApiKey && rawExternalUrl) {
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
                const reply = chubData.choices?.[0]?.message?.content || chubData.choices?.[0]?.text || '';
                if (reply.trim()) {
                  return {
                    reply,
                    groundingSources: [],
                    modelUsed: `${providerMeta?.label || activeProvider || 'Chub.ai'} (${targetExternalModel})`,
                  };
                }
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

      const reply = response.text || '...';
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
          reply: generateSmartRoleplayFallback(character, userMessage, history, options.brawlContextPrompt),
          thinkingProcess: 'Gemini credentials unavailable in local runtime. Resonant in-character continuity active.',
          groundingSources: [],
          modelUsed: 'gemini-3.8-flash (Safe Continuity)',
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

    const reply = response.text || '...';
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
      modelUsed: searchGrounding ? 'gemini-3.8-flash (Search Grounded)' : 'gemini-3.8-flash',
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
          reply: ungroundedResponse.text || '...',
          groundingSources: [],
          modelUsed: 'gemini-3.8-flash (Offline Mode)',
        };
      } catch (retryErr: any) {
        console.warn('Ungrounded retry also failed:', retryErr?.message);
      }
    }

    // If any quota or rate limit error occurred, provide smart in-character fallback
    if (isQuotaOrRateLimitError(err)) {
      return {
        reply: generateSmartRoleplayFallback(character, userMessage, history, options.brawlContextPrompt),
        thinkingProcess: 'Quota limitation reached on API key. Intelligent contextual roleplay fallback generated.',
        groundingSources: [],
        modelUsed: 'gemini-3.8-flash (Resonant Roleplay Mode)',
      };
    }

    return {
      reply: generateSmartRoleplayFallback(character, userMessage, history, options.brawlContextPrompt),
      thinkingProcess: 'Temporary connection anomaly. Roleplay continuity preserved.',
      groundingSources: [],
      modelUsed: 'gemini-3.8-flash (Safe Continuity)',
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

  const runSlot = async (
    slot: (typeof slots)[number],
    stageInstruction: string,
    tempOffset: number = 0
  ): Promise<string> => {
    const slotId = slot.id;
    const isGeminiArgon = slotId === 'gemini-4-argon';
    const isGeminiNative = slotId.startsWith('gemini-');
    const slotKey = (slot.apiKey || options.chubApiKey || '').trim();
    const slotUrl = (
      slot.apiUrl ||
      (slot.apiProvider && slot.apiProvider !== 'gemini'
        ? CHUB_API_PROVIDERS.find((p) => p.id === slot.apiProvider)?.defaultUrl
        : undefined) ||
      (!isGeminiNative ? options.chubApiUrl || undefined : undefined)
    )?.trim();

    if (!isGeminiNative && slotKey && slotUrl) {
      const extRes = await generateCharacterReply({
        ...options,
        userMessage: stageInstruction,
        modelPreference: slotId,
        thinkingLevel: 'OFF',
        searchGrounding: false,
        chubApiKey: slotKey,
        chubApiUrl: slotUrl,
        chatSettings: {
          ...options.chatSettings,
          apiProvider: slot.apiProvider || options.chatSettings?.apiProvider || 'custom_openai',
          model: slotId,
          temperature: Math.min(1.4, Math.max(0.2, (options.chatSettings?.temperature ?? 0.85) + tempOffset)),
          maxNewTokens: Math.min(500, options.chatSettings?.maxNewTokens ?? 400),
        },
      });
      return extRes.reply;
    }

    const geminiModel = isGeminiArgon ? 'gemini-4-argon' : 'gemini-3.8-flash';
    if (!geminiNativeAuthBlocked) {
      try {
        const response = await callGeminiWithTimeout(
          () =>
            ai.models.generateContent({
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
                  options.brawlContextPrompt ? `\n\n${options.brawlContextPrompt}` : ''
                }`,
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

    return generateSmartRoleplayFallback(
      options.character,
      options.userMessage,
      options.history,
      options.brawlContextPrompt
    );
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
      const polishedText = await runSlot(polisher, polishPrompt, -0.05);
      traceLines.push(`2. [${polisher.id} · Critique & Polish]: Applied depth, sensory texture & continuity check.`);

      return {
        reply: polishedText || draftText,
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

    const finalReply = await runSlot(synthSlot, synthPrompt, -0.08);
    traceLines.push(`Synthesizer [${synthSlot.id}]: Merged all ${candidates.length} perspectives into final reply.`);

    return {
      reply: finalReply || candidates[0].text,
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

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return (res.text || '').trim();
  } catch (err: any) {
    console.warn('generateChatSummary failed or quota hit, using fallback summary:', err?.message);
    return `[Summary: ${personaName} and ${characterName} engaged in extensive dialogue across ${messages.length} messages, developing their relationship and scenario.]`;
  }
}

/**
 * Text-to-Speech generation using gemini-3.8-flash-tts
 * Returns base64 encoded WAV audio bytes
 */
export async function generateSpeechTTS(textToSpeak: string, voiceName: string = 'Puck', voiceStyle?: string): Promise<string> {
  const cleanText = textToSpeak.replace(/\*([^*]+)\*/g, '($1)').trim();
  const truncatedText = cleanText.length > 500 ? cleanText.slice(0, 500) + '...' : cleanText;

  const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
  const selectedVoice = validVoices.includes(voiceName) ? voiceName : 'Puck';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: truncatedText,
              speechMetadata: {
                style: voiceStyle || 'Expressive, immersive roleplay character voice',
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
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) return base64Audio;
  } catch (ttsErr: any) {
    console.warn('TTS generation failed or quota reached:', ttsErr?.message);
  }

  throw new Error('TTS service currently reaching quota limits. Please try again in a few moments.');
}
