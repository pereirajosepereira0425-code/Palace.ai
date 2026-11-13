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

