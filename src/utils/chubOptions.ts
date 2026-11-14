export interface ChubOptionItem {
  id: string;
  label: string;
  badge?: string;
  description: string;
  provider?: string;
  defaultUrl?: string;
  defaultModel?: string;
  formatTemplate?: string;
}

/**
 * Complete Chub.ai / Tavern Text-To-Speech (TTS) APIs
 */
export const CHUB_TTS_APIS: ChubOptionItem[] = [
  {
    id: 'none',
    label: 'None (Disabled)',
    badge: 'Off',
    description: 'Disable automatic and manual text-to-speech synthesis.',
  },
  {
    id: 'chub_tts',
    label: 'Chub TTS (Native Chub Voice)',
    badge: 'Chub.ai',
    description: 'Chub.ai built-in neural character voice synthesis.',
  },
  {
    id: 'gemini_flash_tts',
    label: 'Google Gemini Flash TTS (gemini-3.8-flash-tts)',
    badge: 'Palace Native',
    description: 'Expressive high-fidelity roleplay voice synthesis powered by Gemini 3.8 Flash TTS.',
  },
  {
    id: 'gemini_flash_lite_tts',
    label: 'Google Gemini Flash Lite TTS',
    badge: 'Fast',
    description: 'Low-latency lightweight voice generation.',
  },
  {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    badge: 'Premium Voice',
    description: 'Hyper-realistic Eleven v2/v3 voice cloning & multilingual synthesis via API key.',
  },
  {
    id: 'openai_tts',
    label: 'OpenAI TTS (tts-1 / tts-1-hd / gpt-4o-mini-tts)',
    badge: 'OpenAI',
    description: 'Alloy, Echo, Fable, Onyx, Nova, and Shimmer OpenAI speech models.',
  },
  {
    id: 'silero',
    label: 'Silero TTS',
    badge: 'Local / Free',
    description: 'Fast, lightweight local Silero speech server (v3 / v4).',
  },
  {
    id: 'alltalk',
    label: 'AllTalk TTS',
    badge: 'Local XTTS',
    description: 'Self-hosted AllTalk V2 TTS server with Coqui XTTSv2 voice cloning.',
  },
  {
    id: 'xttsv2',
    label: 'Coqui XTTSv2 (Local / HuggingFace)',
    badge: 'Clone',
    description: 'Multilingual voice cloning server for local GPU setups.',
  },
  {
    id: 'kokoro',
    label: 'Kokoro TTS (82M Fast Neural)',
    badge: 'Open-Source',
    description: 'Ultra-fast open-weights Kokoro-82M voice synthesis endpoint.',
  },
  {
    id: 'edge_tts',
    label: 'Microsoft Edge / Azure Neural TTS',
    badge: 'Cloud',
    description: 'Azure Cognitive & Edge Read Aloud neural voices.',
  },
  {
    id: 'browser_speech',
    label: 'Browser SpeechSynthesis (System Default Voice)',
    badge: 'Zero-Key',
    description: 'Native OS / Browser Web Speech API fallback requiring no API key.',
  },
  {
    id: 'custom_tts',
    label: 'Custom TTS Endpoint (OpenAI / SillyTavern Compatible)',
    badge: 'Custom URL',
    description: 'Connect any self-hosted or third-party TTS REST endpoint.',
  },
];

/**
 * Complete Chub.ai API Providers
 */
export const CHUB_API_PROVIDERS: ChubOptionItem[] = [
  {
    id: 'gemini',
    label: 'Google Gemini / Vertex AI',
    badge: 'Palace Default',
    description: 'Native Gemini 3.8 Flash & Gemini 4 Argon (High-Thinking + Google Search Grounding).',
    defaultUrl: '',
    defaultModel: 'gemini-3.8-flash',
  },
  {
    id: 'chub_mars',
    label: 'Chub AI (Mars / Mercury / Sojourn)',
    badge: 'Chub.ai Native',
    description: 'Chub.ai subscription inference engine (Mars 70B, Mercury, Asha, Sojourn).',
    defaultUrl: 'https://api.chub.ai/v1',
    defaultModel: 'chub-mars',
  },
  {
    id: 'openai',
    label: 'OpenAI (Direct / Reverse Proxy)',
    badge: 'Commercial',
    description: 'Connect GPT-4o, GPT-4.1, GPT-4.5, and o4 reasoning models.',
    defaultUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude Direct / Proxy)',
    badge: 'Commercial',
    description: 'Connect Claude 3.7 Sonnet, Claude 3.5 Sonnet, and Claude Opus.',
    defaultUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-7-sonnet-20250219',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    badge: '300+ Models',
    description: 'Unified routing for Claude, DeepSeek, Llama, Mistral, Qwen, and Gemini.',
    defaultUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },
  {
    id: 'kobold',
    label: 'KoboldAI / KoboldCpp (Local / Horde)',
    badge: 'Local / Free',
    description: 'Local GGUF / Kobold Horde server compatible endpoint.',
    defaultUrl: 'http://localhost:5001/v1',
    defaultModel: 'koboldcpp/mythomax-l2-13b',
  },
  {
    id: 'ooba',
    label: 'Oobabooga (Text Generation WebUI)',
    badge: 'Local',
    description: 'Self-hosted Text Generation WebUI OpenAI extension endpoint.',
    defaultUrl: 'http://localhost:5000/v1',
    defaultModel: 'ooba-local-model',
  },
  {
    id: 'novelai',
    label: 'NovelAI (Kayra / Erato)',
    badge: 'Creative RP',
    description: 'NovelAI storytelling and roleplay tuned text completion API.',
    defaultUrl: 'https://text.novelai.net/ai/generate',
    defaultModel: 'llama-3-erato-v1',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek Direct API',
    badge: 'Reasoning',
    description: 'DeepSeek V3 (deepseek-chat) and DeepSeek R1 (deepseek-reasoner).',
    defaultUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
  {
    id: 'mistral',
    label: 'Mistral AI (La Plateforme)',
    badge: 'Commercial',
    description: 'Mistral Large, Mistral Medium, and Nemo uncensored roleplay models.',
    defaultUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
  },
  {
    id: 'groq',
    label: 'Groq Cloud (LPU Ultra-Fast)',
    badge: 'Ultra Fast',
    description: 'Ultra-low-latency Llama 3.3 70B & Mixtral inference.',
    defaultUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    badge: 'Commercial',
    description: 'Grok-2 and Grok-3 conversational endpoints.',
    defaultUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-3',
  },
  {
    id: 'ollama',
    label: 'Ollama (Local Open-Source)',
    badge: 'Local',
    description: 'Local Ollama OpenAI-compatible runtime on port 11434.',
    defaultUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.3:70b',
  },
  {
    id: 'custom_openai',
    label: 'Custom OpenAI-Compatible Reverse Proxy',
    badge: 'Custom',
    description: 'Any custom OpenAI-compatible chat completions URL & bearer key.',
    defaultUrl: 'https://chub.ai/api/v1',
    defaultModel: 'custom-model',
  },
];

/**
 * Complete Chub.ai Active Models Catalog across Chub Native & Connected Providers
 */
export const CHUB_ACTIVE_MODELS: ChubOptionItem[] = [
  // Chub.ai Native Models
  { id: 'chub-mars', label: 'Chub Mars (70B Uncensored RP)', provider: 'Chub.ai', description: 'Flagship Chub.ai uncensored 70B roleplay model.' },
  { id: 'chub-mercury', label: 'Chub Mercury (Fast Roleplay)', provider: 'Chub.ai', description: 'Chub.ai fast conversational tier model.' },
  { id: 'chub-asha', label: 'Chub Asha (Mars Tier)', provider: 'Chub.ai', description: 'Fine-tuned Chub narrative & character card model.' },
  { id: 'chub-sojourn', label: 'Chub Sojourn / Soji (Mars Tier)', provider: 'Chub.ai', description: 'Long-context Chub roleplay and prose specialist.' },
  { id: 'chub-mythomax', label: 'MythoMax-L2-13B (Classic RP)', provider: 'Chub.ai', description: 'Community legend tuned for Alpaca creative roleplay.' },
  // Google Gemini
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Fast & Search Grounded)', provider: 'Google Gemini', description: 'Palace default high-speed roleplay & grounding engine.' },
  { id: 'gemini-4-argon', label: 'Gemini 4 Argon (High Thinking)', provider: 'Google Gemini', description: 'Deep reasoning psychological roleplay engine.' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'Google Gemini', description: 'Extended context literary & multi-character roleplay.' },
  // Anthropic Claude
  { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', provider: 'Anthropic', description: 'Nuanced prose, extended thinking & complex character voices.' },
  { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'Anthropic', description: 'Beloved roleplay dialogue & subtle characterization.' },
  { id: 'claude-3-5-haiku', label: 'Claude 3.5 Haiku', provider: 'Anthropic', description: 'Fast, low-cost Anthropic model.' },
  { id: 'claude-3-opus', label: 'Claude 3 Opus', provider: 'Anthropic', description: 'Rich literary prose and deep character consistency.' },
  // OpenAI
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI', description: 'Balanced multimodal flagship model.' },
  { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'OpenAI', description: 'High instruction following & long-context memory.' },
  { id: 'gpt-4.5-preview', label: 'GPT-4.5 Preview', provider: 'OpenAI', description: 'High emotional intelligence & creative writing.' },
  { id: 'o4-mini', label: 'o4-mini', provider: 'OpenAI', description: 'Fast OpenAI reasoning model.' },
  // OpenRouter / Open-Weights RP Favorites
  { id: 'deepseek/deepseek-chat-v3', label: 'DeepSeek V3 (Chat)', provider: 'DeepSeek / OpenRouter', description: 'Top-tier value & expressive long-form RP.' },
  { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (Reasoner)', provider: 'DeepSeek / OpenRouter', description: 'Chain-of-thought reasoning roleplay.' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct', provider: 'Meta / OpenRouter', description: 'Strong open-weights conversational realism.' },
  { id: 'mistralai/mistral-large-2411', label: 'Mistral Large 2', provider: 'Mistral', description: 'Sharp multilingual prose & instruction adherence.' },
  { id: 'cohere/command-r-plus', label: 'Cohere Command R+', provider: 'Cohere / OpenRouter', description: 'Excellent RAG, lorebook & multi-turn recall.' },
  { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B Instruct', provider: 'Qwen / OpenRouter', description: 'Versatile roleplay & structured formatting.' },
  { id: 'sao10k/l3.3-euryale-70b', label: 'Llama 3.3 Euryale 70B (RP Fine-Tune)', provider: 'OpenRouter', description: 'Dedicated roleplay merge popular on Chub.ai.' },
  { id: 'neversleep/llama-3-lumimaid-70b', label: 'Lumimaid 70B (RP Fine-Tune)', provider: 'OpenRouter', description: 'Creative uncensored storytelling merge.' },
  { id: 'novelai-erato', label: 'NovelAI Erato / Kayra', provider: 'NovelAI', description: 'Fiction & dialogue completion specialist.' },
  { id: 'grok-3', label: 'xAI Grok 3', provider: 'xAI', description: 'Uncensored-leaning conversational reasoning.' },
  { id: 'koboldcpp-local', label: 'Local KoboldCpp / Oobabooga GGUF', provider: 'Local Backend', description: 'Uses whichever GGUF/EXL2 model is loaded locally.' },
];

/**
 * Complete Chub.ai & SillyTavern Prompt Structures
 */
export const CHUB_PROMPT_STRUCTURES: ChubOptionItem[] = [
  {
    id: 'tavern_v2',
    label: 'Tavern V2 / Normal (Chub Standard)',
    badge: 'Default',
    description: 'Standard Chub.ai Tavern Card V2 ordering: System Prompt -> Description -> Personality -> Scenario -> Lore -> History -> Post-History.',
    formatTemplate: 'System -> Definitions -> Lorebook -> Chat History -> Post-History / Prompt Note',
  },
  {
    id: 'agnai_macros',
    label: 'AGNAI (Prompt Macros {{personality}} / {{scenario}})',
    badge: 'Chub Macros',
    description: 'Chub AI dynamic macro placement supporting {{char}}, {{user}}, {{personality}}, {{scenario}}, {{memory}}, and {{summary}}.',
    formatTemplate: 'Dynamic macro substitution ({{personality}}, {{scenario}}, {{summary}})',
  },
  {
    id: 'chatml',
    label: 'ChatML (<|im_start|>system / user / assistant<|im_end|>)',
    badge: 'Standard',
    description: 'OpenAI / Qwen / Yi / Dolphin ChatML turn tags for strict speaker separation.',
    formatTemplate: '<|im_start|>system\n...\n<|im_end|>',
  },
  {
    id: 'alpaca',
    label: 'Alpaca (### Instruction: / ### Response:)',
    badge: 'MythoMax',
    description: 'Classic Stanford Alpaca instruction format preferred by MythoMax & older RP merges.',
    formatTemplate: '### Instruction:\n...\n### Response:\n',
  },
  {
    id: 'vicuna',
    label: 'Vicuna (USER: / ASSISTANT:)',
    badge: 'Classic',
    description: 'LMSYS Vicuna 1.1 conversational turn structure.',
    formatTemplate: 'USER: ...\nASSISTANT: ',
  },
  {
    id: 'llama3',
    label: 'Llama 3 (<|begin_of_text|><|start_header_id|>)',
    badge: 'Llama 3 / 3.3',
    description: 'Meta Llama 3/3.1/3.3 header-delimited instruct template.',
    formatTemplate: '<|start_header_id|>system<|end_header_id|>',
  },
  {
    id: 'mistral_instruct',
    label: 'Mistral / Mixtral ([INST] ... [/INST])',
    badge: 'Mistral',
    description: 'Mistral & Mixtral instruction brackets format.',
    formatTemplate: '[INST] ... [/INST]',
  },
  {
    id: 'command_r',
    label: 'Command R / R+ (<|START_OF_TURN_TOKEN|>)',
    badge: 'Cohere',
    description: 'Cohere Command R+ turn-token structure for strong lorebook grounding.',
    formatTemplate: '<|START_OF_TURN_TOKEN|><|SYSTEM_TOKEN|>...',
  },
  {
    id: 'metharme',
    label: 'Metharme (<|system|> / <|user|> / <|model|>)',
    badge: 'Pygmalion',
    description: 'KoboldAI & Pygmalion Metharme special-token dialogue format.',
    formatTemplate: '<|system|>...<|user|>...<|model|>',
  },
  {
    id: 'pygmalion',
    label: 'Pygmalion Classic ({{char}}\'s Persona / <START>)',
    badge: 'RP Legacy',
    description: 'Classic Pygmalion dialogue format with <START> scene separators.',
    formatTemplate: "{{char}}'s Persona: ...\n<START>\n{{user}}: ...\n{{char}}:",
  },
  {
    id: 'roleplay_classic',
    label: 'Roleplay Plain / Novel Mode',
    badge: 'Narrative',
    description: 'Minimal structural overhead; flows seamlessly like collaborative novel prose.',
    formatTemplate: 'Narrative prose without explicit instruction headers',
  },
  {
    id: 'instruct',
    label: 'Generic Instruct (System / User / Assistant)',
    badge: 'General',
    description: 'Clean universal instruct framing compatible with most APIs.',
    formatTemplate: 'System -> User -> Assistant turns',
  },
  {
    id: 'custom_raw',
    label: 'Custom / Raw Prompt Pass-Through',
    badge: 'Advanced',
    description: 'Sends raw prompt sections without wrapper transformations.',
    formatTemplate: 'Raw pass-through',
  },
];

/**
 * Returns formatting & structural guidance injected into the model context based on selected Prompt Structure
 */
export function getPromptStructureGuidance(structureId?: string): string {
  switch (structureId) {
    case 'agnai_macros':
      return 'Prompt Structure [AGNAI Macros]: Respect character memory, summary, personality, and scenario boundaries strictly.';
    case 'chatml':
      return 'Prompt Structure [ChatML]: Maintain strict role separation between user and character turns without impersonating the user.';
    case 'alpaca':
      return 'Prompt Structure [Alpaca]: Follow character directives faithfully and respond vividly from the character perspective only.';
    case 'vicuna':
      return 'Prompt Structure [Vicuna]: Respond directly as the character assistant turn with rich sensory immersion.';
    case 'llama3':
      return 'Prompt Structure [Llama 3]: Adhere to system roleplay headers, avoid meta-commentary, and stay grounded in scene continuity.';
    case 'mistral_instruct':
      return 'Prompt Structure [Mistral Instruct]: Deliver expressive, unfiltered roleplay matching the tone and formatting rules.';
    case 'command_r':
      return 'Prompt Structure [Command R+]: Ground responses deeply in active Lorebook entries, summary memory, and established world facts.';
    case 'metharme':
    case 'pygmalion':
      return 'Prompt Structure [Pygmalion/Metharme]: Prioritize authentic character voice, action framing (*actions*), and natural dialogue.';
    case 'roleplay_classic':
      return 'Prompt Structure [Novel / Classic RP]: Write in seamless collaborative fiction style without breaking narrative immersion.';
    case 'custom_raw':
      return 'Prompt Structure [Custom Raw]: Follow exact system instructions and post-history notes verbatim.';
    default:
      return 'Prompt Structure [Tavern V2]: Standard Chub.ai V2 character card execution with full lorebook and post-history depth adherence.';
  }
}

/**
 * Normalize a free-form user tag name (Chub.ai style: trims whitespace, collapses multiple spaces, strips leading #)
 */
export function normalizeTagName(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
}

/**
 * Create a URL/DB-safe unique slug for a tag
 */
export function slugifyTag(raw: string): string {
  const normalized = normalizeTagName(raw).toLowerCase();
  const asciiSlug = normalized
    .replace(/[^a-z0-9\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return asciiSlug || encodeURIComponent(normalized).toLowerCase();
}

/**
 * Split comma/newline-separated tag input into clean deduplicated tag names
 */
export function parseTagListInput(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of input.split(/[,\n]+/)) {
    const clean = normalizeTagName(part);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
  }
  return out;
}
