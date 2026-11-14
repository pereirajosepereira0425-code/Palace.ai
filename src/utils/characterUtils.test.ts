import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTavernCard,
  exportTavernCard,
  formatRoleplaySegments,
  parseCharacterUrl,
  renderWikiMarkup,
  calculateTokenBreakdown,
  extractChubPngCard,
  TavernCardV2,
} from './characterUtils.ts';
import {
  normalizeTagName,
  slugifyTag,
  parseTagListInput,
  CHUB_TTS_APIS,
  CHUB_API_PROVIDERS,
  CHUB_ACTIVE_MODELS,
  CHUB_PROMPT_STRUCTURES,
  getPromptStructureGuidance,
} from './chubOptions.ts';

test('parseTavernCard correctly handles Chub.ai V2 card with NSFL and alternate greetings', () => {
  const v2Card: TavernCardV2 = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: 'Nemesis-X',
      description: 'Bioweapon experiment containment breach.',
      personality: 'Relentless, primal, predatory',
      scenario: 'Sub-level 4 bio-lab quarantine zone',
      first_mes: '*Heavy breathing echoes behind the steel bulkhead* You opened the door...',
      alternate_greetings: [
        '*Drips acid from claws onto the tile floor* Another trespasser.',
        '*The lights flicker and die. Crimson eyes ignite in the dark.*',
      ],
      mes_example: '<START>\n{{user}}: What are you?\n{{char}}: *growls*',
      creator_notes: 'Dangerous survival encounter',
      system_prompt: 'You are Nemesis-X. Gritty survival horror immersion.',
      post_history_instructions: 'Keep responses intense, visceral, and atmospheric.',
      tags: ['Horror', 'Monster', 'NSFL', 'Sci-Fi'],
      creator: 'BioHazard_Dev',
      character_version: '2.5',
      extensions: {
        avatar_url: 'https://example.com/nemesis.png',
        background_image: 'https://example.com/lab-bg.jpg',
        rating: 'NSFL',
        voiceName: 'Fenrir',
      },
    },
  };

  const parsed = parseTavernCard(v2Card);

  assert.equal(parsed.name, 'Nemesis-X');
  assert.equal(parsed.rating, 'NSFL');
  assert.equal(parsed.alternateGreetings.length, 2);
  assert.equal(parsed.postHistoryInstructions, 'Keep responses intense, visceral, and atmospheric.');
  assert.equal(parsed.characterVersion, '2.5');
  assert.equal(parsed.creatorNotes, 'Dangerous survival encounter');
  assert.equal(parsed.voiceName, 'Fenrir');
});

test('parseCharacterUrl detects Chub.ai, Janitor.ai, and SpicyChat URLs', () => {
  const chubUrl = 'https://chub.ai/characters/lorekeeper/seraphina-the-valkyrie';
  const chubRes = parseCharacterUrl(chubUrl);
  assert.equal(chubRes.source, 'chub');
  assert.equal(chubRes.idOrPath, 'lorekeeper/seraphina-the-valkyrie');

  const charHubUrl = 'https://characterhub.org/characters/author/dark-knight';
  const charHubRes = parseCharacterUrl(charHubUrl);
  assert.equal(charHubRes.source, 'chub');
  assert.equal(charHubRes.idOrPath, 'author/dark-knight');

  const janitorUrl = 'https://janitorai.com/characters/a1b2c3d4-5678-90ab-cdef-1234567890ab_character_name';
  const janitorRes = parseCharacterUrl(janitorUrl);
  assert.equal(janitorRes.source, 'janitor');
  assert.ok(janitorRes.idOrPath.includes('a1b2c3d4'));

  const spicyUrl = 'https://spicychat.ai/chat/spicy-dragon-queen-999';
  const spicyRes = parseCharacterUrl(spicyUrl);
  assert.equal(spicyRes.source, 'spicychat');
  assert.equal(spicyRes.idOrPath, 'spicy-dragon-queen-999');
});

test('exportTavernCard includes NSFL, alternate greetings, and post history instructions', () => {
  const exported = exportTavernCard({
    name: 'Morrigan',
    tagline: 'Dark sorceress of the Raven Keep',
    avatar: 'https://example.com/morrigan.png',
    backgroundImage: 'https://example.com/keep.png',
    description: 'Ancient shadow necromancer.',
    personality: 'Ruthless, enigmatic, calculating',
    greeting: '*Dark mist swirls* Welcome to oblivion.',
    alternateGreetings: ['*Raven wings beat above* Dare you step inside?'],
    systemPrompt: 'You are Morrigan.',
    postHistoryInstructions: 'Never break dark fantasy immersion.',
    creatorNotes: 'High difficulty boss character.',
    characterVersion: '1.2',
    tags: ['Dark Fantasy', 'NSFW + NSFL'],
    rating: 'NSFW + NSFL',
    creatorName: 'RavenLord',
    voiceName: 'Charon',
    lorebook: [{ key: 'Raven Keep', content: 'Cursed mountain citadel.' }],
  });

  assert.equal(exported.spec, 'chara_card_v2');
  assert.equal(exported.data.name, 'Morrigan');
  assert.equal(exported.data.extensions?.rating, 'NSFW + NSFL');
  assert.equal(exported.data.extensions?.background_image, 'https://example.com/keep.png');
  assert.equal(exported.data.alternate_greetings?.length, 1);
  assert.equal(exported.data.post_history_instructions, 'Never break dark fantasy immersion.');
});

test('renderWikiMarkup correctly formats MediaWiki headings, wikitables, quotes and warnings', () => {
  const input = `== Background Story ==
{{Warning|Corrupted entity detected in Sector 4}}
{{Quote|The mud remembers what the sun forgets.|Lord Baconus}}
{| class="wikitable"
|-
! Stat !! Value
|-
| Power || 9000
|}
[[Category:Peppa Fanon]]
[[Lord Baconus|The Mud King]]`;

  const rendered = renderWikiMarkup(input, 'Peppa');
  assert.ok(rendered.includes('§</span> Background Story'));
  assert.ok(rendered.includes('Fanon / Warning Notice'));
  assert.ok(rendered.includes('The mud remembers'));
  assert.ok(rendered.includes('<table'));
  assert.ok(rendered.includes('🏷️ Peppa Fanon'));
  assert.ok(rendered.includes('The Mud King'));
});

test('calculateTokenBreakdown computes permanent and total tokens per section', () => {
  const breakdown = calculateTokenBreakdown({
    description: 'A'.repeat(38),
    personality: 'B'.repeat(38),
    scenario: 'C'.repeat(38),
    systemPrompt: 'D'.repeat(38),
    postHistoryInstructions: '',
    greeting: 'E'.repeat(76),
    exampleDialogues: 'F'.repeat(38),
  });

  assert.equal(breakdown.description, 10);
  assert.equal(breakdown.personality, 10);
  assert.equal(breakdown.scenario, 10);
  assert.equal(breakdown.systemPrompt, 10);
  assert.equal(breakdown.greeting, 20);
  assert.equal(breakdown.exampleDialogues, 10);
  assert.equal(breakdown.permanent, 40);
  assert.equal(breakdown.total, 70);
});

test('extractChubPngCard extracts embedded chara tEXt chunk from PNG bytes', () => {
  const cardJson = JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: 'PNG_Hero',
      description: 'Embedded inside a PNG card',
      personality: 'Brave',
      scenario: 'Cyber City',
      first_mes: 'Hello from PNG!',
      mes_example: '',
    },
  });
  const b64 = Buffer.from(cardJson, 'utf-8').toString('base64');
  const keyword = Buffer.from('chara\0', 'latin1');
  const payload = Buffer.from(b64, 'latin1');
  const chunkData = Buffer.concat([keyword, payload]);
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(chunkData.length, 0);
  const typeBuf = Buffer.from('tEXt', 'latin1');
  const crcBuf = Buffer.alloc(4);
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const fullBuf = Buffer.concat([pngSig, lengthBuf, typeBuf, chunkData, crcBuf]);

  const parsed = extractChubPngCard(fullBuf.buffer.slice(fullBuf.byteOffset, fullBuf.byteOffset + fullBuf.byteLength));
  assert.ok(parsed !== null);
  assert.equal(parsed?.name, 'PNG_Hero');
  assert.equal(parsed?.greeting, 'Hello from PNG!');
});

test('normalizeTagName, slugifyTag, and parseTagListInput handle arbitrary Chub.ai custom tags', () => {
  assert.equal(normalizeTagName('  ##Slow   Burn RP  '), 'Slow Burn RP');
  assert.equal(slugifyTag("Dandy's World!"), 'dandy-s-world');
  assert.deepEqual(
    parseTagListInput(' #Cyberpunk,  Slow Burn , cyberpunk,  Nextor wƴx '),
    ['Cyberpunk', 'Slow Burn', 'Nextor wƴx']
  );
});

test('Chub.ai catalogs include complete TTS APIs, API Providers, Active Models, and Prompt Structures', () => {
  assert.ok(CHUB_TTS_APIS.some((t) => t.id === 'elevenlabs'));
  assert.ok(CHUB_TTS_APIS.some((t) => t.id === 'silero'));
  assert.ok(CHUB_TTS_APIS.some((t) => t.id === 'chub_tts'));
  assert.ok(CHUB_API_PROVIDERS.some((p) => p.id === 'chub_mars'));
  assert.ok(CHUB_API_PROVIDERS.some((p) => p.id === 'openrouter'));
  assert.ok(CHUB_API_PROVIDERS.some((p) => p.id === 'kobold'));
  assert.ok(CHUB_ACTIVE_MODELS.some((m) => m.id === 'chub-mars'));
  assert.ok(CHUB_ACTIVE_MODELS.some((m) => m.id === 'chub-mercury'));
  assert.ok(CHUB_PROMPT_STRUCTURES.some((s) => s.id === 'chatml'));
  assert.ok(CHUB_PROMPT_STRUCTURES.some((s) => s.id === 'alpaca'));
  assert.ok(CHUB_PROMPT_STRUCTURES.some((s) => s.id === 'command_r'));
  assert.ok(getPromptStructureGuidance('chatml').includes('ChatML'));
});

test('parseCharacterUrl handles www/venus subdomains, trailing slashes, subpaths, and query strings', () => {
  const withSub = parseCharacterUrl('https://www.chub.ai/characters/CreatorOne/my-bot-123/chat?ref=home#top');
  assert.equal(withSub.source, 'chub');
  assert.equal(withSub.idOrPath, 'CreatorOne/my-bot-123');

  const venus = parseCharacterUrl('https://venus.chub.ai/characters/Author_X/hero-slug/');
  assert.equal(venus.source, 'chub');
  assert.equal(venus.idOrPath, 'Author_X/hero-slug');
});

test('extractChubPngCard uses fallbackAvatarUrl and handles V3 ccv3 iTXt chunks', () => {
  const cardJson = JSON.stringify({
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: 'V3_Astra',
      description: 'Starlight navigator.',
      personality: 'Calm',
      scenario: 'Orbital dock',
      first_mes: 'Telemetry online.',
      mes_example: '',
      tags: ['Sci-Fi', 'Navigator'],
    },
  });
  const keyword = Buffer.from('ccv3\0', 'latin1');
  const flags = Buffer.from([0, 0]); // compressionFlag=0, compressionMethod=0
  const langAndTrans = Buffer.from('\0\0', 'latin1'); // empty language + translated keyword
  const payload = Buffer.from(cardJson, 'utf-8');
  const chunkData = Buffer.concat([keyword, flags, langAndTrans, payload]);
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(chunkData.length, 0);
  const typeBuf = Buffer.from('iTXt', 'latin1');
  const crcBuf = Buffer.alloc(4);
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const fullBuf = Buffer.concat([pngSig, lengthBuf, typeBuf, chunkData, crcBuf]);

  const realAvatar = 'https://avatars.charhub.io/avatars/TestUser/v3-astra/avatar.webp';
  const parsed = extractChubPngCard(
    fullBuf.buffer.slice(fullBuf.byteOffset, fullBuf.byteOffset + fullBuf.byteLength),
    realAvatar
  );
  assert.ok(parsed !== null);
  assert.equal(parsed?.name, 'V3_Astra');
  assert.equal(parsed?.avatar, realAvatar);
  assert.deepEqual(parsed?.tags, ['Sci-Fi', 'Navigator']);
});

test('fetchChubCharacter imports real PNG card + CDN avatar and errors cleanly on 404', async () => {
  const { fetchChubCharacter, UrlImportError } = await import('../../server/urlImporter.ts');

  const cardJson = JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: 'Seraphina',
      description: 'Guardian of the Silver Spire.',
      personality: 'Noble and fierce',
      scenario: 'Atop the spire',
      first_mes: 'Who approaches?',
      mes_example: '',
      creator: 'LoreMaker',
      tags: ['Fantasy', 'Knight'],
    },
  });
  const b64 = Buffer.from(cardJson, 'utf-8').toString('base64');
  const chunkData = Buffer.concat([Buffer.from('chara\0', 'latin1'), Buffer.from(b64, 'latin1')]);
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(chunkData.length, 0);
  const pngBuf = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    lengthBuf,
    Buffer.from('tEXt', 'latin1'),
    chunkData,
    Buffer.alloc(4),
  ]);

  const mockFetch = async (input: string) => {
    if (input.endsWith('/chara_card_v2.png')) {
      return new Response(pngBuf, { status: 200, headers: { 'content-type': 'image/png' } });
    }
    if (input.endsWith('/max_res_avatar.webp')) {
      return new Response('', { status: 200, headers: { 'content-type': 'image/webp' } });
    }
    return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/html' } });
  };

  const imported = await fetchChubCharacter('LoreMaker/seraphina-123', mockFetch);
  assert.equal(imported.source, 'chub');
  assert.equal(imported.character.name, 'Seraphina');
  assert.equal(imported.character.creatorName, 'LoreMaker');
  assert.equal(
    imported.character.avatar,
    'https://avatars.charhub.io/avatars/LoreMaker/seraphina-123/max_res_avatar.webp'
  );
  assert.ok(!imported.character.avatar.includes('images.unsplash.com'));

  const always404 = async () =>
    new Response('Not found', { status: 404, headers: { 'content-type': 'text/html' } });
  await assert.rejects(() => fetchChubCharacter('MissingUser/no-such-bot', always404), UrlImportError);
});

test('fetchChubCharacter prefers full uncropped chara_card_v2.png over low-res avatar.webp thumbnail', async () => {
  const { fetchChubCharacter } = await import('../../server/urlImporter.ts');

  const cardJson = JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: 'UncroppedHero',
      description: 'Full resolution card image.',
      personality: 'Sharp',
      scenario: 'Studio',
      first_mes: 'Full portrait loaded!',
      mes_example: '',
      creator: 'Anonymous',
      extensions: {
        avatar_url: 'https://avatars.charhub.io/avatars/Anonymous/template-123/avatar.webp',
      },
    },
  });
  const b64 = Buffer.from(cardJson, 'utf-8').toString('base64');
  const chunkData = Buffer.concat([Buffer.from('chara\0', 'latin1'), Buffer.from(b64, 'latin1')]);
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(chunkData.length, 0);
  const pngBuf = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    lengthBuf,
    Buffer.from('tEXt', 'latin1'),
    chunkData,
    Buffer.alloc(4),
  ]);

  const mockFetch = async (input: string) => {
    if (input.endsWith('/max_res_avatar.webp') || input.endsWith('/max_res_avatar.png')) {
      return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/html' } });
    }
    if (input.endsWith('/chara_card_v2.png')) {
      return new Response(pngBuf, { status: 200, headers: { 'content-type': 'image/png' } });
    }
    if (input.endsWith('/avatar.webp')) {
      return new Response('', { status: 200, headers: { 'content-type': 'image/webp' } });
    }
    return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/html' } });
  };

  const imported = await fetchChubCharacter('Anonymous/template-123', mockFetch);
  assert.equal(
    imported.character.avatar,
    'https://avatars.charhub.io/avatars/Anonymous/template-123/chara_card_v2.png'
  );
});

test('importCharacterFromUrl preserves full-res direct image URL and parses embedded PNG card URLs', async () => {
  const { importCharacterFromUrl } = await import('../../server/urlImporter.ts');

  const directUrl = 'https://cdn.example.com/art/full_uncropped_portrait.webp';
  const mockImageFetch = async (input: string) => {
    assert.equal(input, directUrl);
    return new Response(new Uint8Array([0x52, 0x49, 0x46, 0x46]), {
      status: 200,
      headers: { 'content-type': 'image/webp' },
    });
  };

  const res = await importCharacterFromUrl(directUrl, mockImageFetch);
  assert.equal(res.source, 'web');
  assert.equal(res.character.avatar, directUrl);
  assert.equal(res.character.name, 'Full Uncropped Portrait');
});

test('isOwnedByRequester grants edit/delete access to creator UID, matching guestId, and legacy guest items while protecting system seeds', async () => {
  const { isOwnedByRequester } = await import('./ownership.ts');

  assert.equal(isOwnedByRequester('system', { userUid: 'uid-1', guestId: 'guest_abc' }), false);
  assert.equal(isOwnedByRequester('', { userUid: 'uid-1', guestId: 'guest_abc' }), false);
  assert.equal(isOwnedByRequester(null, { userUid: 'uid-1', guestId: 'guest_abc' }), false);

  assert.equal(isOwnedByRequester('uid-1', { userUid: 'uid-1', guestId: 'guest_abc' }), true);
  assert.equal(isOwnedByRequester('uid-2', { userUid: 'uid-1', guestId: 'guest_abc' }), false);

  assert.equal(isOwnedByRequester('guest_abc', { userUid: null, guestId: 'guest_abc' }), true);
  assert.equal(isOwnedByRequester('guest_other', { userUid: null, guestId: 'guest_abc' }), false);
  assert.equal(isOwnedByRequester('guest', { userUid: null, guestId: 'guest_abc' }), true);
});

test('buildBudgetedContext caps oversized high-token character cards and trims history cleanly', async () => {
  const { buildBudgetedContext } = await import('./promptBudget.ts');

  const hugeDescription = 'Ancient dragon lore and stats. '.repeat(2500); // ~75k chars (~18.7k tokens)
  const longHistory = Array.from({ length: 40 }, (_, i) => ({
    sender: (i % 2 === 0 ? 'user' : 'character') as 'user' | 'character',
    content: `Turn ${i}: ` + 'Roleplay action and dialogue segment. '.repeat(20),
  }));

  const budgeted = buildBudgetedContext({
    character: {
      name: 'MassiveBot',
      tagline: 'Giant card',
      description: hugeDescription,
      personality: 'Wise and fierce. '.repeat(800),
      systemPrompt: 'Stay in character. '.repeat(800),
      scenario: 'Volcanic peak. '.repeat(800),
      exampleDialogues: '<START>\n{{user}}: Hi\n{{char}}: Roar!\n'.repeat(600),
      postHistoryInstructions: 'Be descriptive. '.repeat(400),
      lorebook: JSON.stringify([
        { key: 'dragon', content: 'Dragons breathe cosmic fire.' },
        { key: 'unrelated_secret', content: 'Should not inject when untriggered.' },
      ]),
    },
    history: longHistory,
    userMessage: 'Tell me about the dragon cavern.',
    contextSize: 8192,
    maxNewTokens: 450,
    lorebookTokenBudget: 600,
    useLorebooks: true,
  });

  assert.ok(budgeted.estimatedTokens < 8192);
  assert.ok(budgeted.description.length < hugeDescription.length);
  assert.ok(budgeted.history.length < longHistory.length);
  assert.ok(budgeted.history.length >= 2);
  assert.equal(budgeted.relevantLore.length, 1);
  assert.ok(budgeted.relevantLore[0].includes('dragon'));
});

test('normalizeChatCompletionsUrl and shouldUseHighThinking avoid double paths and unintended Argon stalls', async () => {
  const { normalizeChatCompletionsUrl, shouldUseHighThinking } = await import('./promptBudget.ts');

  assert.equal(
    normalizeChatCompletionsUrl('https://api.chub.ai/v1'),
    'https://api.chub.ai/v1/chat/completions'
  );
  assert.equal(
    normalizeChatCompletionsUrl('https://api.chub.ai/v1/chat/completions/'),
    'https://api.chub.ai/v1/chat/completions'
  );
  assert.equal(
    normalizeChatCompletionsUrl('https://chub.ai'),
    'https://mars.chub.ai/v1/chat/completions'
  );

  assert.equal(shouldUseHighThinking('OFF', 'gemini-4-argon'), false);
  assert.equal(shouldUseHighThinking('OFF', 'gemini-3.8-flash'), false);
  assert.equal(shouldUseHighThinking('HIGH', 'gemini-3.8-flash'), true);
});

test('profileCustomization safely serializes visual settings and sanitizes custom CSS', async () => {
  const {
    parseSocialAndCustomization,
    serializeSocialAndCustomization,
    getProfileTheme,
    sanitizeCustomCss,
  } = await import('./profileCustomization.ts');

  const packed = serializeSocialAndCustomization(
    { discord: 'wizard#1234', github: 'palacedev' },
    {
      profileBackgroundUrl: 'https://example.com/bg.webp',
      backgroundBlur: 8,
      backgroundDim: 0.7,
      avatarFrame: 'royal_gold',
      cardEffect: 'neon_border',
      fontStyle: 'serif',
      favoriteTags: ['Dark Fantasy', 'RPG'],
    }
  );

  const unpacked = parseSocialAndCustomization(JSON.stringify(packed));
  assert.equal(unpacked.socials.discord, 'wizard#1234');
  assert.equal(unpacked.socials.github, 'palacedev');
  assert.equal(unpacked.customization.profileBackgroundUrl, 'https://example.com/bg.webp');
  assert.equal(unpacked.customization.avatarFrame, 'royal_gold');
  assert.equal(unpacked.customization.fontStyle, 'serif');
  assert.deepEqual(unpacked.customization.favoriteTags, ['Dark Fantasy', 'RPG']);

  assert.equal(getProfileTheme('royal_gold').id, 'royal_gold');
  assert.equal(getProfileTheme('nonexistent').id, 'purple');

  const safe = sanitizeCustomCss('h1 { color: gold; } </style><script>alert(1)</script> @import url(x);');
  assert.ok(!safe.includes('</style'));
  assert.ok(!safe.includes('@import url(x)'));
});

test('getProviderApiKeyInfo and Chub URLs point directly to token and API key pages rather than /profile', async () => {
  const {
    CHUB_CREATE_TOKEN_URL,
    CHUB_SUBSCRIPTIONS_URL,
    getProviderApiKeyInfo,
  } = await import('./promptBudget.ts');

  assert.equal(CHUB_CREATE_TOKEN_URL, 'https://chub.ai/my_stages?active=tokens');
  assert.equal(CHUB_SUBSCRIPTIONS_URL, 'https://chub.ai/subscriptions');
  assert.ok(!CHUB_CREATE_TOKEN_URL.includes('/profile'));
  assert.equal(getProviderApiKeyInfo('chub_mars').url, CHUB_CREATE_TOKEN_URL);
  assert.equal(getProviderApiKeyInfo('openrouter').url, 'https://openrouter.ai/keys');
  assert.equal(getProviderApiKeyInfo('openai').url, 'https://platform.openai.com/api-keys');
  assert.equal(getProviderApiKeyInfo('anthropic').url, 'https://console.anthropic.com/settings/keys');
  assert.equal(getProviderApiKeyInfo('unknown_custom').url, CHUB_CREATE_TOKEN_URL);
});

test('apiErrorUtils scrubs Cloudflare 403 HTML and classifies all HTTP, validation, and network errors cleanly', async () => {
  const {
    classifyHttpApiError,
    classifyNetworkError,
    sanitizeErrorBody,
    validateConnectionInputs,
    isCloudflareOrWafHtml,
  } = await import('./apiErrorUtils.ts');

  const cfHtml = `<!DOCTYPE html><!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]--><head><title>Attention Required! | Cloudflare</title></head><body><h1>Sorry, you have been blocked</h1></body></html>`;
  assert.equal(isCloudflareOrWafHtml(cfHtml, 'text/html; charset=UTF-8'), true);

  const cfResult = classifyHttpApiError({
    status: 403,
    rawBody: cfHtml,
    contentType: 'text/html; charset=UTF-8',
    endpoint: 'https://api.chub.ai/v1/chat/completions',
    apiProvider: 'chub_mars',
  });
  assert.equal(cfResult.ok, false);
  assert.equal(cfResult.code, 'CLOUDFLARE_BLOCK');
  assert.equal(cfResult.isCloudflareBlock, true);
  assert.ok(!cfResult.message.includes('<!DOCTYPE') && !cfResult.message.includes('<html'));
  assert.ok(cfResult.hint && cfResult.hint.includes('OpenRouter'));

  const html200 = classifyHttpApiError({
    status: 200,
    rawBody: '<!DOCTYPE html><html><body>Home Page</body></html>',
    contentType: 'text/html',
    endpoint: 'https://example.com/chat/completions',
  });
  assert.equal(html200.code, 'HTML_INSTEAD_OF_JSON');

  assert.equal(classifyHttpApiError({ status: 401, rawBody: '{"error":{"message":"Invalid key"}}', endpoint: 'https://api.openai.com/v1/chat/completions' }).code, 'UNAUTHORIZED');
  assert.equal(classifyHttpApiError({ status: 402, rawBody: 'Insufficient balance', endpoint: 'https://openrouter.ai/api/v1/chat/completions' }).code, 'PAYMENT_REQUIRED');
  assert.equal(classifyHttpApiError({ status: 404, endpoint: 'https://api.openai.com/v1/bad' }).code, 'NOT_FOUND');
  assert.equal(classifyHttpApiError({ status: 413, endpoint: 'https://api.openai.com/v1/chat/completions' }).code, 'PAYLOAD_TOO_LARGE');
  assert.equal(classifyHttpApiError({ status: 429, rawBody: 'Rate limit reached', endpoint: 'https://api.openai.com/v1/chat/completions' }).code, 'RATE_LIMITED');
  assert.equal(classifyHttpApiError({ status: 503, endpoint: 'https://api.openai.com/v1/chat/completions' }).code, 'UPSTREAM_SERVER_ERROR');

  assert.equal(sanitizeErrorBody('<script>bad()</script><div>Gateway Bad</div>', 'text/html'), 'Gateway Bad');

  // Validation: missing URL, bad protocol, local server allowed without API key, cloud server requires key
  assert.equal(validateConnectionInputs({ apiProvider: 'custom_openai', apiUrl: '', apiKey: '' })?.code, 'EMPTY_URL');
  assert.equal(validateConnectionInputs({ apiProvider: 'custom_openai', apiUrl: 'not a url', apiKey: 'abc' })?.code, 'INVALID_URL');
  assert.equal(validateConnectionInputs({ apiProvider: 'ollama', apiUrl: 'http://localhost:11434/v1', apiKey: '' }), null);
  assert.equal(validateConnectionInputs({ apiProvider: 'openrouter', apiUrl: 'https://openrouter.ai/api/v1', apiKey: '' })?.code, 'MISSING_API_KEY');

  // Network errors
  assert.equal(classifyNetworkError({ name: 'TimeoutError' }, 'https://api.example.com/v1').code, 'TIMEOUT');
  assert.equal(classifyNetworkError({ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND' }, 'https://bad.invalid/v1').code, 'DNS_NOT_FOUND');
  assert.equal(classifyNetworkError({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' }, 'http://localhost:11434/v1').code, 'CONNECTION_REFUSED');
  assert.equal(classifyNetworkError({ code: 'CERT_HAS_EXPIRED', message: 'certificate has expired' }, 'https://expired.bad/v1').code, 'TLS_ERROR');
  assert.equal(classifyNetworkError(new TypeError('Failed to fetch'), 'https://api.chub.ai/v1', 'browser').code, 'CORS_OR_NETWORK_BLOCK');
});

test('Chub.ai auth helpers inject CH-API-KEY + Bearer headers and prioritize Mars/model gateways', async () => {
  const {
    isChubUrlOrProvider,
    buildExternalAuthHeaders,
    getChubEndpointCandidates,
  } = await import('./apiErrorUtils.ts');

  assert.equal(isChubUrlOrProvider('chub_mars', ''), true);
  assert.equal(isChubUrlOrProvider('custom_openai', 'https://mars.chub.ai/v1'), true);
  assert.equal(isChubUrlOrProvider('openrouter', 'https://openrouter.ai/api/v1'), false);

  const chubHeaders = buildExternalAuthHeaders('chub-secret-key', 'https://mars.chub.ai/v1/chat/completions', 'chub_mars');
  assert.equal(chubHeaders.Authorization, 'Bearer chub-secret-key');
  assert.equal(chubHeaders['CH-API-KEY'], 'chub-secret-key');

  const orHeaders = buildExternalAuthHeaders('or-secret-key', 'https://openrouter.ai/api/v1/chat/completions', 'openrouter');
  assert.equal(orHeaders.Authorization, 'Bearer or-secret-key');
  assert.equal(orHeaders['CH-API-KEY'], undefined);

  const ashaCandidates = getChubEndpointCandidates('https://mars.chub.ai/v1', 'asha', 'chub_mars');
  assert.equal(ashaCandidates[0], 'https://mars.chub.ai/v1/chat/completions');
  assert.ok(ashaCandidates.includes('https://mars.chub.ai/chub/asha/v1/chat/completions'));
  assert.ok(ashaCandidates.includes('https://api.chub.ai/mix/v1/chat/completions'));

  const sojiCandidates = getChubEndpointCandidates('https://mars.chub.ai/v1', 'soji', 'chub_mars');
  assert.ok(sojiCandidates.includes('https://mars.chub.ai/chub/soji/v1/chat/completions'));
  assert.ok(sojiCandidates.includes('https://inference.chub.ai/soji/v1/chat/completions'));
});

test('normalizeModelsUrl and pickBestModelForEndpoint resolve Chub /v1/models IDs cleanly', async () => {
  const { normalizeModelsUrl } = await import('./promptBudget.ts');
  const { pickBestModelForEndpoint } = await import('./apiErrorUtils.ts');

  assert.equal(normalizeModelsUrl('https://mars.chub.ai/v1'), 'https://mars.chub.ai/v1/models');
  assert.equal(
    normalizeModelsUrl('https://inference.chub.ai/soji/v1/chat/completions'),
    'https://inference.chub.ai/soji/v1/models'
  );

  assert.equal(pickBestModelForEndpoint('chub-sojourn', ['asha', 'soji']), 'soji');
  assert.equal(pickBestModelForEndpoint('chub-asha', ['soji', 'asha']), 'asha');
  assert.equal(pickBestModelForEndpoint('chub-mars', ['mistralai/mixtral-8x22b', 'soji']), 'soji');
  assert.equal(pickBestModelForEndpoint('unknown-model', ['default-live-model']), 'default-live-model');
});

test('viewportUnload helpers correctly paginate, chunk tags, and compute virtual overscan windows', async () => {
  const {
    parsePageParams,
    slicePaginatedRows,
    chunkItems,
    computeVirtualWindow,
    resolveSlotDimension,
  } = await import('./viewportUnload.ts');

  assert.deepEqual(
    parsePageParams({ limitParam: '500', offsetParam: '-10', defaultLimit: 24, maxLimit: 100 }),
    { limit: 100, offset: 0 }
  );
  assert.deepEqual(
    parsePageParams({ limitParam: undefined, offsetParam: '48', defaultLimit: 24, maxLimit: 100 }),
    { limit: 24, offset: 48 }
  );

  const pageWithMore = slicePaginatedRows([1, 2, 3, 4], 3, 6);
  assert.deepEqual(pageWithMore, { items: [1, 2, 3], hasMore: true, nextOffset: 9 });

  const lastPage = slicePaginatedRows([1, 2], 3, 9);
  assert.deepEqual(lastPage, { items: [1, 2], hasMore: false, nextOffset: 11 });

  const chunks = chunkItems(['a', 'b', 'c', 'd', 'e'], 2);
  assert.deepEqual(chunks, [['a', 'b'], ['c', 'd'], ['e']]);
  assert.deepEqual(chunkItems([], 10), []);

  const win = computeVirtualWindow({
    totalCount: 100,
    scrollOffset: 2000,
    viewportSize: 800,
    itemSize: 100,
    overscanCount: 3,
  });
  assert.equal(win.startIndex, 17);
  assert.equal(win.endIndex, 31);
  assert.equal(win.paddingBefore, 1700);
  assert.equal(win.paddingAfter, 6800);

  assert.equal(resolveSlotDimension(412.6, 300), 413);
  assert.equal(resolveSlotDimension(0, 300), 300);
  assert.equal(resolveSlotDimension(null, 250), 250);
});

test('communityUtils validates follow targets, normalizes stage sliders, and merges global active lorebooks', async () => {
  const {
    canFollowTarget,
    clampBlurLevel,
    normalizeOverlayOpacity,
    parseLorebookEntries,
    mergeGlobalActiveLorebook,
  } = await import('./communityUtils.ts');

  assert.deepEqual(canFollowTarget('guest_1', 'uid_2'), { allowed: true });
  assert.equal(canFollowTarget('uid_1', 'uid_1').allowed, false);
  assert.equal(canFollowTarget('', 'uid_2').allowed, false);

  assert.equal(clampBlurLevel(-5), 0);
  assert.equal(clampBlurLevel(99), 20);
  assert.equal(clampBlurLevel(3.6), 4);

  assert.deepEqual(normalizeOverlayOpacity(0.68), { pct: 68, float: 0.68 });
  assert.deepEqual(normalizeOverlayOpacity(75), { pct: 75, float: 0.75 });
  assert.deepEqual(normalizeOverlayOpacity(2), { pct: 10, float: 0.1 });

  const parsedEntries = parseLorebookEntries([
    { keys: 'Citadel, Keep', content: 'Dark stone fortress.', enabled: true },
    { key: 'Disabled', content: 'Ignored if skipped', enabled: false },
  ]);
  assert.equal(parsedEntries.length, 2);
  assert.equal(parsedEntries[0].keys, 'Citadel, Keep');
  assert.equal(parsedEntries[1].enabled, false);

  const mergedJson = mergeGlobalActiveLorebook(
    JSON.stringify([{ key: 'Hero', content: 'Built-in hero lore.' }]),
    JSON.stringify({
      name: 'World Codex',
      entries: [
        { keys: 'Vespera, Academy', content: 'Floating magic school.', enabled: true },
        { keys: 'Hidden', content: 'Disabled entry', enabled: false },
      ],
    })
  );
  const merged = JSON.parse(mergedJson);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].key, 'Hero');
  assert.equal(merged[1].key, 'Vespera, Academy');
});


