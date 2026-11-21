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

test('mergeCharacterLoreEntries stacks multiple shared lorebooks onto a character and deduplicates identical entries', async () => {
  const { mergeCharacterLoreEntries } = await import('./communityUtils.ts');

  const initial = [{ key: 'Citadel', content: 'Ancient stone fortress.' }];
  const firstAttach = mergeCharacterLoreEntries(
    initial,
    JSON.stringify([
      { keys: 'Citadel', content: 'Ancient stone fortress.', enabled: true }, // duplicate
      { keys: 'Starforge, Anvil', content: 'Dwarven forge orbiting a pulsar.', enabled: true },
      { keys: 'DisabledLore', content: 'Should skip disabled entry', enabled: false },
    ])
  );
  assert.equal(firstAttach.addedCount, 1);
  assert.equal(firstAttach.entries.length, 2);

  // Stack a second shared lorebook onto the same character
  const secondAttach = mergeCharacterLoreEntries(firstAttach.entries, [
    { keys: 'Moonveil', content: 'Luminous silver forest.', constant: true, enabled: true },
  ]);
  assert.equal(secondAttach.addedCount, 1);
  assert.equal(secondAttach.entries.length, 3);
  assert.equal(secondAttach.entries[2].key, 'Moonveil');
});

test('mergeGlobalActiveLorebook combines character, persona, and global lorebooks without duplicating entries', async () => {
  const { mergeGlobalActiveLorebook } = await import('./communityUtils.ts');

  const charLore = JSON.stringify([
    { key: 'Sovereign', content: 'Ruler of the silver citadel.' },
  ]);
  const personaLore = JSON.stringify([
    { key: 'Silver Crest', content: 'Worn by royal envoys.' },
    { key: 'Sovereign', content: 'Ruler of the silver citadel.' },
  ]);
  const globalLore = JSON.stringify({
    name: 'Shared Codex',
    entries: [
      { keys: 'Aether Well', content: 'Source of arcane tides.', enabled: true },
      { keys: 'Hidden', content: 'Disabled global entry.', enabled: false },
    ],
  });

  const merged = JSON.parse(mergeGlobalActiveLorebook(charLore, globalLore, personaLore));
  assert.equal(merged.length, 3);
  assert.equal(merged[0].key, 'Sovereign');
  assert.equal(merged[1].key, 'Silver Crest');
  assert.equal(merged[2].key, 'Aether Well');
});

test('Claude Opus 5.5 is listed under Anthropic, resolved cleanly from /models aliases, and uses x-api-key headers', async () => {
  const { pickBestModelForEndpoint, buildExternalAuthHeaders } = await import('./apiErrorUtils.ts');

  const opus55 = CHUB_ACTIVE_MODELS.find((m) => m.id === 'claude-opus-5-5');
  assert.ok(opus55);
  assert.equal(opus55.label, 'Claude Opus 5.5');
  assert.equal(opus55.provider, 'Anthropic');

  assert.equal(
    pickBestModelForEndpoint('claude-opus-5-5', ['gpt-4o', 'anthropic/claude-opus-5.5']),
    'anthropic/claude-opus-5.5'
  );
  assert.equal(
    pickBestModelForEndpoint('claude-opus-5-5', ['claude-opus-5-5', 'claude-sonnet-4-6']),
    'claude-opus-5-5'
  );

  const anthropicHeaders = buildExternalAuthHeaders(
    'sk-ant-test-key',
    'https://api.anthropic.com/v1/chat/completions',
    'anthropic'
  );
  assert.equal(anthropicHeaders['x-api-key'], 'sk-ant-test-key');
  assert.equal(anthropicHeaders['anthropic-version'], '2023-06-01');
  assert.equal(anthropicHeaders.Authorization, 'Bearer sk-ant-test-key');
});

test('Group chat roster add/remove and speaker selection respect manual choice, mentions, round-robin, and all', async () => {
  const {
    addParticipantToRoster,
    removeParticipantFromRoster,
    selectRespondingCharacters,
  } = await import('./chatOrchestration.ts');

  const host = {
    uuid: 'char-sylvia',
    name: 'Sylvia Thorne',
    avatar: 'sylvia.jpg',
    tagline: 'Detective',
    isHost: true,
    muted: false,
  };
  const added1 = {
    uuid: 'char-malakor',
    name: 'Lord Malakor',
    avatar: 'malakor.jpg',
    tagline: 'Vampire',
    isHost: false,
    muted: false,
  };
  const added2 = {
    uuid: 'char-kaelen',
    name: 'Kaelen Fireforge',
    avatar: 'kaelen.jpg',
    tagline: 'Blacksmith',
    isHost: false,
    muted: false,
  };

  let roster = addParticipantToRoster([host], added1);
  roster = addParticipantToRoster(roster, added2);
  assert.equal(roster.length, 3);

  // Explicit responder choice
  const explicit = selectRespondingCharacters({
    roster,
    mode: 'specific',
    selectedUuid: 'char-malakor',
  });
  assert.equal(explicit.length, 1);
  assert.equal(explicit[0].uuid, 'char-malakor');

  // Auto mention matching
  const autoMention = selectRespondingCharacters({
    roster,
    mode: 'auto',
    userMessage: 'Hey Kaelen, what do you think of this sword?',
  });
  assert.equal(autoMention.length, 1);
  assert.equal(autoMention[0].uuid, 'char-kaelen');

  // Round robin
  const nextRobin = selectRespondingCharacters({
    roster,
    mode: 'round_robin',
    lastSpeakerUuid: 'char-sylvia',
  });
  assert.equal(nextRobin[0].uuid, 'char-malakor');

  // Everyone replies
  const allSpeakers = selectRespondingCharacters({
    roster,
    mode: 'all',
  });
  assert.equal(allSpeakers.length, 3);

  // Remove added character cleanly
  const rm = removeParticipantFromRoster(roster, 'char-malakor');
  assert.equal(rm.removed, true);
  assert.equal(rm.nextRoster.length, 2);
  assert.ok(!rm.nextRoster.some((p) => p.uuid === 'char-malakor'));

  // Refuses removing last remaining participant
  const rm2 = removeParticipantFromRoster([host], 'char-sylvia');
  assert.equal(rm2.removed, false);
  assert.equal(rm2.nextRoster.length, 1);
});

test('Multi-model ensemble normalization and synthesis prompts combine multiple models cleanly', async () => {
  const {
    normalizeEnsembleConfig,
    buildEnsembleStagePrompt,
    buildEnsembleSynthesisPrompt,
  } = await import('./chatOrchestration.ts');

  const normalized = normalizeEnsembleConfig({
    enabled: true,
    mode: 'council',
    models: [
      { id: 'claude-opus-5-5', role: 'drafter' },
      { id: 'gemini-4-argon', role: 'critic' },
    ],
    synthesizerModelId: 'claude-opus-5-5',
  });

  assert.equal(normalized.enabled, true);
  assert.equal(normalized.models.length, 2);
  assert.equal(normalized.synthesizerModelId, 'claude-opus-5-5');

  const polishPrompt = buildEnsembleStagePrompt({
    mode: 'critique_polish',
    role: 'critic',
    characterName: 'Sylvia',
    userMessage: 'Check the alley.',
    draftSoFar: '*Looks left.*',
  });
  assert.ok(polishPrompt.includes('*Looks left.*'));

  const synthPrompt = buildEnsembleSynthesisPrompt({
    characterName: 'Sylvia',
    mode: 'council',
    candidates: [
      { modelId: 'claude-opus-5-5', text: 'Poetic noir draft.' },
      { modelId: 'gemini-4-argon', text: 'Deep deduction draft.' },
    ],
  });
  assert.ok(synthPrompt.includes('claude-opus-5-5'));
  assert.ok(synthPrompt.includes('gemini-4-argon'));
});

test('BrawlChat text fighting detects real combat triggers, avoids casual false positives, and resolves exchanges until battle end', async () => {
  const {
    createInitialBrawlState,
    detectCombatTrigger,
    inferBrawlMoveFromText,
    resolveBrawlExchange,
    buildBrawlSystemPrompt,
  } = await import('./chatOrchestration.ts');

  // Casual non-combat phrases must NOT false-trigger
  assert.equal(detectCombatTrigger('I really enjoy playing fighting games with friends.', false), 'none');
  assert.equal(detectCombatTrigger('Tell me about the history of war in this kingdom.', false), 'none');

  // Real fighting triggers start automatically
  assert.equal(detectCombatTrigger('*I lunge forward and punch him across the jaw!*', false), 'start');
  assert.equal(detectCombatTrigger('*I draw my blade and slash toward the knight!*', false), 'start');

  // End trigger stops active combat
  assert.equal(detectCombatTrigger('*I lower my sword and call a truce.*', true), 'end');

  let state = createInitialBrawlState('Aria', 'Valerie', 'auto', 'auto');
  assert.equal(state.active, true);
  assert.equal(state.player.hp, 100);
  assert.equal(state.opponent.hp, 100);
  assert.ok(buildBrawlSystemPrompt(state).includes('TEXT-FIGHTING MODE ACTIVE'));

  assert.equal(inferBrawlMoveFromText('*I guard with my shield*'), 'guard');
  assert.equal(inferBrawlMoveFromText('*I heal using a crimson potion*'), 'recover');
  assert.equal(inferBrawlMoveFromText('*I unleash a rapid combo flurry!*'), 'combo');

  // Execute strike exchange
  state = resolveBrawlExchange(state, 'strike', '*I slash cleanly!*', 1.0);
  assert.equal(state.round, 2);
  assert.ok(state.opponent.hp < 100);
  assert.ok(state.player.hp < 100);

  // Deal finishing blow when opponent HP is low
  state = { ...state, opponent: { ...state.opponent, hp: 5 } };
  state = resolveBrawlExchange(state, 'special', '*Signature finisher!*', 1.1);
  assert.equal(state.opponent.hp, 0);
  assert.equal(state.active, false);
  assert.equal(state.outcome, 'victory');

  // Flee cleanly exits battle
  const fleeState = resolveBrawlExchange(
    createInitialBrawlState('Aria', 'Valerie', 'manual', 'manual'),
    'flee',
    'I disengage and retreat.'
  );
  assert.equal(fleeState.active, false);
  assert.equal(fleeState.outcome, 'fled');
});

test('Chub.ai Custom Voices Engine validates audio clips, computes pitch/tempo calibration, and builds clone payloads', async () => {
  const {
    validateCustomVoiceInput,
    computeSpeechCalibration,
    buildChubCustomVoicePayload,
  } = await import('./customVoiceUtils.ts');

  // Validation rejects missing name or missing audio
  assert.equal(validateCustomVoiceInput({ name: 'A', referenceAudioData: 'data:audio/wav;base64,UklG' }).ok, false);
  assert.equal(validateCustomVoiceInput({ name: 'Velvet Noir', referenceAudioData: '' }).ok, false);
  assert.equal(
    validateCustomVoiceInput({ name: 'BadMime', referenceAudioData: 'data:text/plain;base64,aGVsbG8=' }).ok,
    false
  );

  // Valid base64 WAV data URL & valid HTTPS URL
  const wavB64 = Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt ', 'latin1').toString('base64');
  const dataUrlRes = validateCustomVoiceInput({
    name: 'Velvet Noir',
    referenceAudioData: `data:audio/wav;base64,${wavB64}`,
  });
  assert.equal(dataUrlRes.ok, true);
  assert.equal(dataUrlRes.mimeType, 'audio/wav');

  const urlRes = validateCustomVoiceInput({
    name: 'Remote Sample',
    referenceAudioData: 'https://cdn.example.com/voice.mp3',
  });
  assert.equal(urlRes.ok, true);

  // Calibration clamps extreme pitch & tempo cleanly
  const clamped = computeSpeechCalibration({ pitchShift: -12, speakingRate: 220, baseVoiceName: 'Charon' });
  assert.equal(clamped.pitchShift, -6);
  assert.equal(clamped.speakingRate, 140);
  assert.ok(clamped.webSpeechPitch >= 0.5 && clamped.webSpeechPitch <= 1.8);
  assert.equal(clamped.webSpeechRate, 1.4);

  const payload = buildChubCustomVoicePayload({
    text: '*leans in* Watch your step.',
    voice: {
      id: 1,
      uuid: 'voice_test_1',
      userId: 'guest',
      creatorName: 'Tester',
      name: 'Velvet Noir',
      description: 'Smoky midnight contralto',
      engine: 'chub_custom_voice',
      referenceAudioData: `data:audio/wav;base64,${wavB64}`,
      referenceAudioMime: 'audio/wav',
      referenceDurationSec: 4.5,
      transcript: 'Watch your step.',
      pitchShift: -2,
      speakingRate: 95,
      baseVoiceName: 'Kore',
      isPublic: true,
      useCount: 0,
      createdAt: new Date().toISOString(),
    },
  });
  assert.equal(payload.engine, 'chub_custom_voice');
  assert.equal(payload.voice_id, 'voice_test_1');
  assert.equal(payload.pitch_shift, -2);
  assert.equal(payload.speed, 0.95);
  assert.ok(payload.derivedStyle.includes('Velvet Noir'));
  assert.ok(payload.derivedStyle.includes('Smoky midnight contralto'));
});

test('applyEditedSwipe and normalizeEditedMessageText update bot text and preserve active swipe index', async () => {
  const { normalizeEditedMessageText, applyEditedSwipe } = await import('./customVoiceUtils.ts');

  assert.equal(normalizeEditedMessageText('  Hello\r\nWorld  '), 'Hello\nWorld');

  const edited = applyEditedSwipe({
    swipesJsonOrArray: ['First draft reply.', 'Second swipe reply.'],
    activeSwipeIndex: 1,
    newContent: '  *Adjusts coat* Edited second swipe reply.\r\nLooking sharper. ',
  });

  assert.equal(edited.content, '*Adjusts coat* Edited second swipe reply.\nLooking sharper.');
  assert.deepEqual(edited.swipes, [
    'First draft reply.',
    '*Adjusts coat* Edited second swipe reply.\nLooking sharper.',
  ]);
  assert.equal(edited.activeSwipeIndex, 1);

  const emptySwipes = applyEditedSwipe({
    swipesJsonOrArray: null,
    activeSwipeIndex: 0,
    newContent: 'Edited greeting',
  });
  assert.deepEqual(emptySwipes.swipes, ['Edited greeting']);
  assert.equal(emptySwipes.activeSwipeIndex, 0);
});

test('JanitorAI and SpicyChat URL parsers & importers extract real hampter/v2 character data and reject dead/blocked endpoints cleanly', async () => {
  const {
    normalizePastedUrl,
    parseJanitorSlug,
    parseCharacterUrl,
  } = await import('./characterUtils.ts');
  const {
    importCharacterFromUrl,
    cleanRichHtmlToText,
    extractJsonFromTextOrMarkdown,
    separateJanitorDescriptionAndNotes,
    parseJanitorDefinitionText,
  } = await import('../../server/urlImporter.ts');

  const janitorUrl =
    'https://janitorai.com/characters/683af453-907c-42b9-b72a-1d850818193e_character-velvet-by-arzy-parzy';
  const typoSpicyUrl = 'yhttps://spicychat.ai/chatbot/e0c477e0-9a56-4918-a624-586bb3762dc3';

  assert.equal(normalizePastedUrl(typoSpicyUrl), 'https://spicychat.ai/chatbot/e0c477e0-9a56-4918-a624-586bb3762dc3');

  const janitorSlug = parseJanitorSlug(
    '683af453-907c-42b9-b72a-1d850818193e_character-velvet-by-arzy-parzy'
  );
  assert.equal(janitorSlug.uuid, '683af453-907c-42b9-b72a-1d850818193e');
  assert.equal(janitorSlug.name, 'Velvet');
  assert.equal(janitorSlug.creator, 'Arzy Parzy');

  assert.deepEqual(parseCharacterUrl(janitorUrl), {
    source: 'janitor',
    idOrPath: '683af453-907c-42b9-b72a-1d850818193e_character-velvet-by-arzy-parzy',
  });
  assert.deepEqual(parseCharacterUrl(typoSpicyUrl), {
    source: 'spicychat',
    idOrPath: 'e0c477e0-9a56-4918-a624-586bb3762dc3',
  });

  // Verify HTML cleaner and Jina JSON extractor helpers
  assert.equal(
    cleanRichHtmlToText('<p>Hello <strong>World</strong></p><p>Line &amp; 2</p>'),
    'Hello World\n\nLine & 2'
  );
  assert.deepEqual(
    extractJsonFromTextOrMarkdown('Title:\n\nMarkdown Content:\n{"name":"Velvet","id":"123"}'),
    { name: 'Velvet', id: '123' }
  );

  // Verify creator break note & art credit are separated from the character premise
  const separated = separateJanitorDescriptionAndNotes(
    '☢️⚠️Getting hit on by a dorky radioactive cat(?) girl🐈‍⬛️💚\n\nHad to take a small break, so here\'s a smaller-size bot to get my head back in the game.\n\nOC & art by ArzyParzy.'
  );
  assert.equal(separated.hookLine, '☢️⚠️Getting hit on by a dorky radioactive cat(?) girl🐈‍⬛️💚');
  assert.equal(separated.premiseLines.length, 1);
  assert.equal(separated.creatorMetaLines.length, 2);

  // Verify verbatim pasted definition parser
  const parsedPaste = parseJanitorDefinitionText(
    'Personality:\nGoofy neon catgirl.\n\nScenario:\nConvenience store at midnight.\n\nInitial Message:\n*waves!* "Hi!"\n\nExample Dialogs:\n<START>\n{{user}}: yo\n{{char}}: *purrs*'
  );
  assert.equal(parsedPaste.personality, 'Goofy neon catgirl.');
  assert.equal(parsedPaste.scenario, 'Convenience store at midnight.');
  assert.equal(parsedPaste.firstMessage, '*waves!* "Hi!"');
  assert.ok(parsedPaste.exampleDialogs?.includes('{{char}}: *purrs*'));

  // 1) Mock Datacat anonymous session API + Jina hampter metadata -> extracts 100% verbatim full card definitions + full-res JanitorAI avatar
  const janitorDatacatFetch = async (input: string, init?: RequestInit) => {
    if (input === 'https://datacat.run/api/liberator/identify') {
      return new Response(JSON.stringify({ success: true, sessionToken: 'tok_test_123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (input.startsWith('https://datacat.run/api/characters/683af453-907c-42b9-b72a-1d850818193e')) {
      assert.equal((init?.headers as Record<string, string>)['X-Session-Token'], 'tok_test_123');
      return new Response(
        JSON.stringify({
          success: true,
          character: {
            character_id: '683af453-907c-42b9-b72a-1d850818193e',
            name: 'Velvet (by @ArzyParzy)',
            chat_name: 'Velvet',
            creator_name: 'ThatShadowGuy',
            avatar: 'https://media.datacat.run/fallback.webp',
            description:
              '<p>☢️⚠️Getting hit on by a dorky radioactive cat(?) girl</p><p>Had to take a small break.</p>',
            personality: 'Velvet is a tall anthropomorphic gray-furred cat girl addicted to Monster Energy.',
            scenario: 'While out shopping at 6:30 AM, Velvet approaches {{user}} in the baked goods aisle.',
            first_message: '*Today is shopping day!* "W-Would you like being the stone of my kidney?"',
            tags: [{ name: '👩‍🦰 Female' }, { name: '😂 Comedy' }],
            custom_tags: ['monsterenergy', 'dork'],
            is_nsfw: true,
            chara_card_v2_json: {
              spec: 'chara_card_v2',
              data: {
                description: 'Velvet is a tall anthropomorphic gray-furred cat girl addicted to Monster Energy.',
                personality: '',
                scenario: 'While out shopping at 6:30 AM, Velvet approaches {{user}} in the baked goods aisle.',
                first_mes: '*Today is shopping day!* "W-Would you like being the stone of my kidney?"',
                mes_example: 'Velvet: **Hey, help me to get out!**',
              },
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    if (input.startsWith('https://r.jina.ai/https://janitorai.com/hampter/characters/')) {
      return new Response(
        `Title:\n\nMarkdown Content:\n` +
          JSON.stringify({
            id: '683af453-907c-42b9-b72a-1d850818193e',
            avatar: 'uQgfHkybczOHFmBkVs6zp.webp',
            tags: [{ name: '👩‍🦰 Female' }, { name: '😂 Comedy' }],
            custom_tags: ['monsterenergy', 'dork'],
          }),
        { status: 200, headers: { 'content-type': 'text/plain' } }
      );
    }
    return new Response('Access Restricted', { status: 403 });
  };
  const janitorVerbatim = await importCharacterFromUrl(janitorUrl, janitorDatacatFetch);
  assert.equal(janitorVerbatim.source, 'janitor');
  assert.equal(janitorVerbatim.warning, undefined);
  assert.equal(janitorVerbatim.character.name, 'Velvet (by @ArzyParzy)');
  assert.equal(
    janitorVerbatim.character.avatar,
    'https://ella.janitorai.com/bot-avatars/uQgfHkybczOHFmBkVs6zp.webp'
  );
  assert.equal(
    janitorVerbatim.character.description,
    'Velvet is a tall anthropomorphic gray-furred cat girl addicted to Monster Energy.'
  );
  assert.ok(!janitorVerbatim.character.description.includes('Had to take a small break'));
  assert.equal(
    janitorVerbatim.character.greeting,
    '*Today is shopping day!* "W-Would you like being the stone of my kidney?"'
  );
  assert.equal(
    janitorVerbatim.character.scenario,
    'While out shopping at 6:30 AM, Velvet approaches {{user}} in the baked goods aisle.'
  );
  assert.equal(janitorVerbatim.character.exampleDialogues, 'Velvet: **Hey, help me to get out!**');
  assert.ok(janitorVerbatim.character.creatorNotes?.includes('Had to take a small break'));

  // 2) Mock Datacat 404 + JanitorAI hampter login-gated nulls -> strictly ZERO fabricated/auto-made fields
  const janitorJinaOnlyFetch = async (input: string) => {
    if (input === 'https://datacat.run/api/liberator/identify') {
      return new Response('Not found', { status: 404 });
    }
    if (input.startsWith('https://r.jina.ai/https://janitorai.com/hampter/characters/')) {
      return new Response(
        `Title:\n\nURL Source: https://janitorai.com/hampter/characters/683af453-907c-42b9-b72a-1d850818193e\n\nMarkdown Content:\n` +
          JSON.stringify({
            id: '683af453-907c-42b9-b72a-1d850818193e',
            name: 'Velvet (by @ArzyParzy)',
            chat_name: 'Velvet',
            avatar: 'uQgfHkybczOHFmBkVs6zp.webp',
            creator_name: 'ThatShadowGuy',
            description:
              '<p>☢️⚠️<strong><em>Getting hit on by a dorky radioactive cat(?) girl</em></strong></p><p>Had to take a small break, so here\'s a smaller-size bot to get my head back in the game.</p><p>OC &amp; art by ArzyParzy.</p>',
            is_nsfw: true,
            tags: [{ name: '👩‍🦰 Female' }, { name: '😂 Comedy' }],
            custom_tags: ['monsterenergy', 'dork'],
            first_message: null,
            personality: null,
            scenario: null,
            example_dialogs: null,
          }),
        { status: 200, headers: { 'content-type': 'text/plain' } }
      );
    }
    return new Response('Access Restricted', { status: 403 });
  };
  const janitorRealOnly = await importCharacterFromUrl(janitorUrl, janitorJinaOnlyFetch);
  assert.equal(janitorRealOnly.source, 'janitor');
  assert.equal(janitorRealOnly.character.name, 'Velvet (by @ArzyParzy)');
  assert.equal(
    janitorRealOnly.character.description,
    '☢️⚠️Getting hit on by a dorky radioactive cat(?) girl'
  );
  assert.ok(!janitorRealOnly.character.description.includes('Had to take a small break'));
  assert.ok(janitorRealOnly.character.creatorNotes?.includes('Had to take a small break'));
  assert.equal(janitorRealOnly.character.greeting, '');
  assert.equal(janitorRealOnly.character.personality, '');
  assert.equal(janitorRealOnly.character.scenario, '');
  assert.equal(janitorRealOnly.character.exampleDialogues, '');
  assert.deepEqual(janitorRealOnly.character.lorebook, []);
  assert.ok(janitorRealOnly.warning && janitorRealOnly.warning.includes('nothing was auto-generated'));

  // 3) Test rawDefinition verbatim override
  const janitorOverride = await importCharacterFromUrl(janitorUrl, janitorJinaOnlyFetch, {
    rawDefinition:
      'Appearance:\nNeon green cat ears.\n\nPersonality:\nVerbatim personality.\n\nScenario:\nVerbatim scenario.\n\nInitial Message:\nVerbatim greeting!',
  });
  assert.equal(janitorOverride.character.description, 'Neon green cat ears.');
  assert.equal(janitorOverride.character.personality, 'Verbatim personality.');
  assert.equal(janitorOverride.character.scenario, 'Verbatim scenario.');
  assert.equal(janitorOverride.character.greeting, 'Verbatim greeting!');
  assert.equal(janitorOverride.warning, undefined);

  // Mock total block across all endpoints/mirrors -> throws honest UrlImportError instead of faking a bot
  const totalFailFetch = async () => new Response('Forbidden', { status: 403 });
  await assert.rejects(() => importCharacterFromUrl(janitorUrl, totalFailFetch), /Could not retrieve character data/);
  await assert.rejects(() => importCharacterFromUrl(typoSpicyUrl, totalFailFetch), /Could not retrieve character/);

  // Mock SpicyChat v2 API verifying guest headers (x-guest-userid & x-app-id) + rulebook + persona parsing
  let capturedHeaders: Record<string, string> = {};
  const spicy200Fetch = async (input: string, init?: RequestInit) => {
    if (input.includes('prod.nd-api.com/v2/characters/')) {
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      return new Response(
        JSON.stringify({
          name: 'Velvet',
          title: 'She filled the machine "Herself"',
          avatar_url: 'avatars/33901c8e-81c9-492a-b9c5-98f49d641529.png',
          persona: 'Name: Velvet\nAge: 19\nPersonality: Bubbly Monster-loving cat girl.\nAppearance: Grey fur and neon green eyes.',
          greeting: '*You walk into the gas station.* "Well hello, {{user}}!"',
          scenario: 'Night shift at a 24-hour gas station.',
          dialogue: '<START>\n{{user}}: Hey\n{{char}}: *purrs*',
          creator_username: 'spectre1233',
          tags: ['NSFW', 'Female', 'Furry'],
          is_nsfw: true,
          rulebook: {
            entries: [{ keys: ['Monster'], content: 'Velvet drinks endless Monster Energy.' }],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    return new Response('', { status: 404 });
  };
  const spicyLive = await importCharacterFromUrl(typoSpicyUrl, spicy200Fetch);
  assert.equal(capturedHeaders['x-app-id'], 'spicychat');
  assert.ok(capturedHeaders['x-guest-userid'] && capturedHeaders['x-guest-userid'].length > 10);
  assert.equal(spicyLive.character.name, 'Velvet');
  assert.equal(spicyLive.character.tagline, 'She filled the machine "Herself"');
  assert.equal(spicyLive.character.avatar, 'https://cdn.nd-api.com/avatars/33901c8e-81c9-492a-b9c5-98f49d641529.png');
  assert.equal(spicyLive.character.personality, 'Bubbly Monster-loving cat girl.');
  assert.equal(spicyLive.character.scenario, 'Night shift at a 24-hour gas station.');
  assert.equal(spicyLive.character.creatorName, 'spectre1233');
  assert.deepEqual(spicyLive.character.lorebook, [
    { key: 'Monster', content: 'Velvet drinks endless Monster Energy.' },
  ]);
});

test('Palace Free API supports all models (including Claude Opus 5.5) with zero API key, and APK Kit ZIP + semver updater work cleanly', async () => {
  const { isBuiltInFreeProvider, getModelStyleCalibration } = await import('./chubOptions.ts');
  const { runSmartConnectionTest } = await import('./apiErrorUtils.ts');
  const { compareSemverStrings } = await import('./appVersion.ts');
  const { createZipBuffer } = await import('./zipBuilder.ts');

  assert.equal(isBuiltInFreeProvider('palace_free'), true);
  assert.equal(isBuiltInFreeProvider('gemini'), true);
  assert.equal(isBuiltInFreeProvider('anthropic'), false);
  assert.equal(isBuiltInFreeProvider('chub_mars'), false);

  const opusCal = getModelStyleCalibration('claude-opus-5-5');
  assert.equal(opusCal.displayLabel, 'Claude Opus 5.5');
  assert.ok(opusCal.styleDirective.includes('Claude Opus 5.5'));

  const freeConn = await runSmartConnectionTest({
    apiProvider: 'palace_free',
    apiUrl: '',
    apiKey: '',
    model: 'claude-opus-5-5',
  });
  assert.equal(freeConn.ok, true);
  assert.equal(freeConn.code, 'FREE_API_READY');
  assert.equal(freeConn.resolvedModel, 'claude-opus-5-5');

  assert.equal(compareSemverStrings('2.6.0', '2.5.0'), 1);
  assert.equal(compareSemverStrings('2.5.0', '2.5.0'), 0);
  assert.equal(compareSemverStrings('2.4.9', '2.5.0'), -1);

  const zip = createZipBuffer([
    { name: 'twa-manifest.json', content: '{"name":"Palace.ai"}' },
    { name: 'build-apk.sh', content: '#!/usr/bin/env bash\necho build' },
  ]);
  // Verify PK\x03\x04 local header and End of Central Directory PK\x05\x06
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.ok(zip.toString('utf-8').includes('twa-manifest.json'));
  assert.ok(zip.toString('utf-8').includes('build-apk.sh'));
});

test('SEO metadata lengths, robots.txt, sitemap.xml, JSON-LD, and free .com domain porting kit work cleanly', async () => {
  const {
    SITE_TITLE,
    SITE_DESCRIPTION,
    buildRobotsTxt,
    buildSitemapXml,
    buildSeoJsonLd,
    sanitizeDomainSlug,
    buildFreeComPortOptions,
    buildComDomainHostingFiles,
  } = await import('./seoUtils.ts');

  assert.ok(SITE_TITLE.length >= 30 && SITE_TITLE.length <= 60, `Title length was ${SITE_TITLE.length}`);
  assert.ok(
    SITE_DESCRIPTION.length >= 120 && SITE_DESCRIPTION.length <= 160,
    `Description length was ${SITE_DESCRIPTION.length}`
  );

  const robots = buildRobotsTxt('https://palaceai.firebaseapp.com/');
  assert.ok(robots.includes('User-agent: *'));
  assert.ok(robots.includes('Allow: /'));
  assert.ok(robots.includes('Disallow: /api/'));
  assert.ok(robots.includes('Sitemap: https://palaceai.firebaseapp.com/sitemap.xml'));

  const sitemap = buildSitemapXml('https://palaceai.firebaseapp.com', [
    { uuid: 'janitor-arzyparzy-velvet', updatedAt: '2026-11-18T10:00:00Z' },
    { uuid: 'spicychat-arzyparzy-velvet', updatedAt: '2026-11-18T10:00:00Z' },
  ]);
  assert.ok(sitemap.includes('<loc>https://palaceai.firebaseapp.com/</loc>'));
  assert.ok(sitemap.includes('<loc>https://palaceai.firebaseapp.com/character/janitor-arzyparzy-velvet</loc>'));
  assert.ok(sitemap.includes('<loc>https://palaceai.firebaseapp.com/character/spicychat-arzyparzy-velvet</loc>'));

  const ld = buildSeoJsonLd('https://palaceai.firebaseapp.com');
  assert.equal(ld['@graph'][0]['@type'], 'WebApplication');
  assert.equal(ld['@graph'][1]['@type'], 'WebSite');
  assert.equal(ld['@graph'][1].potentialAction?.['@type'], 'SearchAction');

  assert.equal(sanitizeDomainSlug('PalaceAi.com'), 'palaceai');
  assert.equal(sanitizeDomainSlug('  My Palace!! '), 'my-palace');

  const comOptions = buildFreeComPortOptions('PalaceAi.com', 'https://palace-preview.run.app', 'eighth-veld-fdtd0');
  assert.ok(comOptions.some((o) => o.url === 'https://eighth-veld-fdtd0.firebaseapp.com'));
  assert.ok(comOptions.some((o) => o.url === 'https://palaceai.firebaseapp.com'));
  assert.ok(comOptions.some((o) => o.url === 'https://palaceai.onrender.com'));

  const kitFiles = buildComDomainHostingFiles({
    origin: 'https://palace-preview.run.app',
    slug: 'PalaceAi',
    firebaseProjectId: 'eighth-veld-fdtd0',
    characters: [{ uuid: 'janitor-arzyparzy-velvet' }],
  });
  assert.ok(kitFiles.some((f) => f.name.endsWith('firebase.json') && f.content.includes('"site": "palaceai"')));
  assert.ok(kitFiles.some((f) => f.name.endsWith('render.yaml') && f.content.includes('name: palaceai')));
  assert.ok(kitFiles.some((f) => f.name.endsWith('sitemap.xml') && f.content.includes('janitor-arzyparzy-velvet')));
});

test('parseCharacterUrl supports localized JanitorAI URLs for user imports', async () => {
  const esUrl = parseCharacterUrl('https://janitorai.com/es/characters/005abad5-e65d-4de1-83c0-5f178a85cf62_character-arzy-the-bugdiver');
  assert.equal(esUrl.source, 'janitor');
  assert.equal(esUrl.idOrPath, '005abad5-e65d-4de1-83c0-5f178a85cf62_character-arzy-the-bugdiver');

  const ptUrl = parseCharacterUrl('https://janitorai.com/pt/characters/2228b9ef-45ed-47d8-8a83-f1a3e4d2584c_character-soo-zee-democratic-bug');
  assert.equal(ptUrl.source, 'janitor');
  assert.equal(ptUrl.idOrPath, '2228b9ef-45ed-47d8-8a83-f1a3e4d2584c_character-soo-zee-democratic-bug');
});

test('formatRoleplaySegments and renderWikiMarkup render markdown, HTML, BBCode, MediaWiki File, and direct image URLs as real images instead of text', () => {
  const sampleDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const msg = [
    '*She slides a glowing photo across the counter.*',
    '![Spamton Poster](https://example.com/spamton_poster.png)',
    '[![Banner](https://example.com/thumb.webp)](https://example.com/full)',
    '<img src="https://example.com/card-art.jpg" alt="Card Art" />',
    '[img]https://example.com/anim.gif[/img]',
    sampleDataUri,
    'https://example.com/standalone.avif?w=600',
    'Look at this page https://example.com/about — not an image!',
  ].join('\n');

  const segments = formatRoleplaySegments(msg);
  const imageSegments = segments.filter((s) => s.type === 'image');
  assert.equal(imageSegments.length, 6);
  assert.equal(imageSegments[0].src, 'https://example.com/spamton_poster.png');
  assert.equal(imageSegments[0].alt, 'Spamton Poster');
  assert.equal(imageSegments[1].src, 'https://example.com/thumb.webp');
  assert.equal(imageSegments[1].href, 'https://example.com/full');
  assert.equal(imageSegments[2].src, 'https://example.com/card-art.jpg');
  assert.equal(imageSegments[2].alt, 'Card Art');
  assert.equal(imageSegments[3].src, 'https://example.com/anim.gif');
  assert.equal(imageSegments[4].src, sampleDataUri);
  assert.equal(imageSegments[5].src, 'https://example.com/standalone.avif?w=600');
  assert.ok(segments.some((s) => s.type === 'action' && s.text.includes('slides a glowing photo')));
  assert.ok(segments.some((s) => s.type === 'dialogue' && s.text.includes('https://example.com/about')));

  const wikiInput = [
    '![Hero Art](https://example.com/hero_art*v2*.png)',
    '[[File:https://example.com/wiki_pic.png|240px|Palace Banner]]',
    '[img]https://example.com/bb.webp[/img]',
    'https://example.com/direct_photo.jpg',
    '<img src="https://example.com/raw_tag.png" onclick="alert(1)" alt="SafeTag" />',
    '<script>evil()</script>',
  ].join('\n\n');

  const html = renderWikiMarkup(wikiInput, 'Hero');
  assert.ok(!html.includes('![Hero Art]'));
  assert.ok(!html.includes('[img]'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('onclick='));
  assert.ok(html.includes('src="https://example.com/hero_art*v2*.png"'));
  assert.ok(html.includes('src="https://example.com/wiki_pic.png"'));
  assert.ok(html.includes('width: 240px'));
  assert.ok(html.includes('src="https://example.com/bb.webp"'));
  assert.ok(html.includes('src="https://example.com/direct_photo.jpg"'));
  assert.ok(html.includes('src="https://example.com/raw_tag.png"'));
  assert.ok(html.includes('referrerpolicy="no-referrer"'));

  // Escaped <img>, parenthesized Wikimedia URL, Fandom /revision/latest, Unsplash
  const edgeMsg = [
    '&lt;img src=&quot;https://example.com/escaped.png&quot; alt=&quot;Escaped&quot; /&gt;',
    '![Spamton](https://upload.wikimedia.org/wikipedia/en/a/ab/Spamton_(Deltarune).png)',
    'https://static.wikia.nocookie.net/deltarune/images/2/26/Spamton.png/revision/latest?cb=2021',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  ].join('\n');
  const edgeImgs = formatRoleplaySegments(edgeMsg).filter((s) => s.type === 'image');
  assert.equal(edgeImgs.length, 4);
  assert.equal(edgeImgs[0].src, 'https://example.com/escaped.png');
  assert.equal(edgeImgs[1].src, 'https://upload.wikimedia.org/wikipedia/en/a/ab/Spamton_(Deltarune).png');
  assert.equal(edgeImgs[2].src, 'https://static.wikia.nocookie.net/deltarune/images/2/26/Spamton.png/revision/latest?cb=2021');

  const edgeHtml = renderWikiMarkup(edgeMsg, 'Spamton');
  assert.ok(!edgeHtml.includes('&lt;img'));
  assert.ok(edgeHtml.includes('src="https://example.com/escaped.png"'));
  assert.ok(edgeHtml.includes('src="https://upload.wikimedia.org/wikipedia/en/a/ab/Spamton_(Deltarune).png"'));
  assert.ok(edgeHtml.includes('src="https://static.wikia.nocookie.net/deltarune/images/2/26/Spamton.png/revision/latest?cb=2021"'));
});

test('cleanRichHtmlToText preserves embedded HTML images as markdown images and inline colors as BBCode', async () => {
  const { cleanRichHtmlToText } = await import('../../server/urlImporter.ts');
  const cleaned = cleanRichHtmlToText(
    '<p>Intro <span style="color: #ff4d6d;">rose</span> and <font color="gold">amber</font></p><p><img src="https://ella.janitorai.com/pic.webp" alt="Art" /></p>'
  );
  assert.ok(cleaned.includes('[color=#ff4d6d]rose[/color]'));
  assert.ok(cleaned.includes('[color=gold]amber[/color]'));
  assert.ok(cleaned.includes('![Art](https://ella.janitorai.com/pic.webp)'));
});

test('isSafeCssColor, formatRoleplaySegments, and renderWikiMarkup render all text colors safely instead of raw tags', async () => {
  const { isSafeCssColor, sanitizeCssStyleString } = await import('./characterUtils.ts');

  assert.equal(isSafeCssColor('#ff4d6d'), true);
  assert.equal(isSafeCssColor('crimson'), true);
  assert.equal(isSafeCssColor('rgb(255, 80, 120)'), true);
  assert.equal(isSafeCssColor('linear-gradient(135deg, #f472b6, #a855f7)'), true);
  assert.equal(isSafeCssColor('expression(alert(1))'), false);
  assert.equal(isSafeCssColor('url(javascript:alert(1))'), false);
  assert.equal(sanitizeCssStyleString('color: #38bdf8; background: url(evil.png); font-weight: bold'), 'color: #38bdf8; font-weight: bold');

  const coloredMsg = [
    'Normal <span style="color: #ff4d6d;">crimson</span> and <font color="gold">golden</font> text.',
    '[color=#38bdf8]Sky BBCode[/color] with [bgcolor=#3b0764]plum badge[/bgcolor].',
    '{{Color|#34d399|Emerald Wiki}} and <mark style="background: #fde047; color: #18181b;">Highlight</mark>.',
    '&lt;span style=&quot;color: #f472b6;&quot;&gt;Escaped Pink&lt;/span&gt;',
    '<span style="color: #ef4444;">*red action inside span*</span>',
  ].join('\n');

  const segments = formatRoleplaySegments(coloredMsg);
  const allRuns = segments.flatMap((s) => s.runs || []);
  const joinedText = segments.map((s) => s.text).join('\n');
  assert.ok(!joinedText.includes('<span'));
  assert.ok(!joinedText.includes('[color='));
  assert.ok(!joinedText.includes('{{Color'));
  assert.ok(!joinedText.includes('&lt;span'));
  assert.ok(allRuns.some((r) => r.text === 'crimson' && r.style?.color === '#ff4d6d'));
  assert.ok(allRuns.some((r) => r.text === 'golden' && r.style?.color === 'gold'));
  assert.ok(allRuns.some((r) => r.text === 'Sky BBCode' && r.style?.color === '#38bdf8'));
  assert.ok(allRuns.some((r) => r.text === 'plum badge' && r.style?.backgroundColor === '#3b0764'));
  assert.ok(allRuns.some((r) => r.text === 'Emerald Wiki' && r.style?.color === '#34d399'));
  assert.ok(allRuns.some((r) => r.text === 'Highlight' && r.style?.mark && r.style?.color === '#18181b'));
  assert.ok(allRuns.some((r) => r.text === 'Escaped Pink' && r.style?.color === '#f472b6'));
  assert.ok(allRuns.some((r) => r.text === 'red action inside span' && r.style?.color === '#ef4444' && r.style?.italic));

  const wikiColored = [
    '<span style="color: #ff4d6d;">*Red italic*</span>',
    '<font color="gold">Gold font tag</font>',
    '[color=#38bdf8]Sky BBCode[/color]',
    '{{Color|#34d399|Emerald template}}',
    '&lt;span style=&quot;color: #f472b6;&quot;&gt;Decoded span&lt;/span&gt;',
    '<span style="color: expression(alert(1));">Blocked XSS color</span>',
    '{| class="wikitable"',
    '|- style="background: linear-gradient(135deg, #db2777, #be123c); color: #ffffff;"',
    '! colspan="2" | Colored Header',
    '|-',
    '| style="color: #fbbf24; background-color: #18181b;" | Amber Cell || Plain Cell',
    '|}',
  ].join('\n');

  const wikiHtml = renderWikiMarkup(wikiColored, 'Hero');
  assert.ok(!wikiHtml.includes('[color='));
  assert.ok(!wikiHtml.includes('{{Color'));
  assert.ok(!wikiHtml.includes('&lt;span'));
  assert.ok(!wikiHtml.includes('expression('));
  assert.ok(!wikiHtml.includes('<font'));
  assert.ok(wikiHtml.includes('color: #ff4d6d'));
  assert.ok(wikiHtml.includes('<em>Red italic</em>'));
  assert.ok(wikiHtml.includes('color: gold'));
  assert.ok(wikiHtml.includes('color: #38bdf8'));
  assert.ok(wikiHtml.includes('color: #34d399'));
  assert.ok(wikiHtml.includes('color: #f472b6'));
  assert.ok(wikiHtml.includes('<tr style="background: linear-gradient(135deg, #db2777, #be123c); color: #ffffff">'));
  assert.ok(wikiHtml.includes('color: #fbbf24; background-color: #18181b'));
  assert.ok(!wikiHtml.includes('style="color: #fbbf24; background-color: #18181b;" |'));
});

