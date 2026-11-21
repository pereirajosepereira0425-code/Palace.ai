import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MAKER_IMAGES,
  normalizeMakerImages,
  normalizeParagraphCounts,
  splitParagraphs,
  enforceParagraphCount,
  classifyResearchUrl,
  buildWikiAndWebSearchTargets,
  buildChatbotResearchNote,
  synthesizePalaceMakerDraft,
} from './aiMakerUtils.ts';

test('normalizeMakerImages supports up to 30 images with individual prompts and NSFW tags', () => {
  const input = Array.from({ length: 35 }, (_, i) => ({
    id: `slot_${i}`,
    name: `ref_${i + 1}.png`,
    dataUrl: `data:image/png;base64,AAA${i}`,
    prompt: `Outfit state ${i + 1}`,
    role: i === 2 ? 'avatar' : i === 5 ? 'background' : 'reference',
    nsfw: i % 2 === 1,
  }));

  const normalized = normalizeMakerImages(input);
  assert.equal(normalized.length, MAX_MAKER_IMAGES);
  assert.equal(normalized.length, 30);
  assert.equal(normalized[2].role, 'avatar');
  assert.equal(normalized[5].role, 'background');
  assert.equal(normalized[1].nsfw, true);
  assert.equal(normalized[29].prompt, 'Outfit state 30');
});

test('normalizeParagraphCounts clamps ranges and preserves defaults', () => {
  const counts = normalizeParagraphCounts({
    description: 6,
    personality: 0,
    scenario: 14,
    greeting: 4,
    alternateGreetingsCount: 3,
  });
  assert.equal(counts.description, 6);
  assert.equal(counts.personality, 1);
  assert.equal(counts.scenario, 10);
  assert.equal(counts.greeting, 4);
  assert.equal(counts.alternateGreetingsCount, 3);
});

test('enforceParagraphCount outputs exact paragraph counts when expanding or compacting', () => {
  const onePara =
    'Spamton lives in a dumpster behind Cyber City. He shouts about Kromer. He wears tinted pink and yellow glasses. Sometimes his static cuts out awkwardly.';
  const expandedTo3 = enforceParagraphCount(onePara, 3);
  assert.equal(splitParagraphs(expandedTo3).length, 3);

  const fourParas = 'Para one.\n\nPara two.\n\nPara three.\n\nPara four.';
  const compactedTo2 = enforceParagraphCount(fourParas, 2);
  assert.equal(splitParagraphs(compactedTo2).length, 2);
  assert.ok(compactedTo2.includes('Para four.'));
});

test('classifyResearchUrl and buildWikiAndWebSearchTargets route Deltarune wiki & competitor bots', () => {
  assert.equal(classifyResearchUrl('https://janitorai.com/characters/abc-123'), 'janitor');
  assert.equal(classifyResearchUrl('https://chub.ai/characters/creator/spamton'), 'chub');
  assert.equal(classifyResearchUrl('https://spicychat.ai/chatbot/xyz'), 'spicychat');
  assert.equal(classifyResearchUrl('https://deltarune.fandom.com/wiki/Spamton'), 'wiki');
  assert.equal(classifyResearchUrl('https://example.com/custom-bot'), 'web');

  const plan = buildWikiAndWebSearchTargets(
    'Deltarune wiki Spamton',
    ['https://deltarune.fandom.com/wiki/Spamton'],
    ['https://chub.ai/characters/user/spamton']
  );
  assert.ok(plan.wikiUrls.includes('https://deltarune.fandom.com/wiki/Spamton'));
  assert.ok(plan.chatbotUrls.includes('https://chub.ai/characters/user/spamton'));
  assert.ok(plan.mediaWikiApiSearches.some((s) => s.wikiBase.includes('deltarune.fandom.com')));
  assert.ok(plan.mediaWikiApiSearches.some((s) => s.wikiBase.includes('deltarune.wiki')));
});

test('buildChatbotResearchNote distills style patterns and hooks from scraped bots', () => {
  const note = buildChatbotResearchNote({
    source: 'janitor',
    url: 'https://janitorai.com/characters/spamton-test',
    name: 'Spamton G. Spamton',
    creatorName: 'DarknerMaker',
    rating: 'NSFW',
    greeting: '*Static sparks behind the shop counter.* "HEY [[Little Sponge]], care to make a deal?" *He leans across your space.*',
    personality: 'Erratic, desperate salesman masking loneliness behind infomercial bravado.',
    scenario: 'Back alley shop inside Cyber City.',
    tags: ['Deltarune', 'Cyber City'],
  });
  assert.equal(note.source, 'janitor');
  assert.ok(note.styleNotes.some((s) => s.includes('stage-direction')));
  assert.ok(note.personalityHooks.length > 0);
  assert.ok(note.tags.includes('Deltarune'));
});

test('synthesizePalaceMakerDraft honors exact paragraph counts, 30 image prompts, wiki lore, bot notes, and NSFW mode', () => {
  const draft = synthesizePalaceMakerDraft({
    prompt: 'Spamton G. Spamton from Deltarune in an explicit NSFW cyberpunk back-alley deal scenario.',
    nsfwAllowed: true,
    paragraphCounts: {
      description: 4,
      personality: 3,
      scenario: 2,
      greeting: 3,
      systemPrompt: 2,
      postHistoryInstructions: 1,
      exampleDialogues: 3,
      alternateGreetingsCount: 2,
      alternateGreetingParagraphs: 2,
      creatorNotes: 2,
    },
    images: [
      {
        id: '1',
        name: 'main.png',
        dataUrl: 'data:image/png;base64,AAA',
        prompt: 'Dealmaker pink-and-yellow glasses glowing in neon alleyway rain.',
        role: 'avatar',
        nsfw: false,
      },
      {
        id: '2',
        name: 'alt_nsfw.png',
        dataUrl: 'data:image/png;base64,BBB',
        prompt: 'Unbuttoned black suit coat inside dimly lit server room.',
        role: 'background',
        nsfw: true,
      },
    ],
    dossier: {
      excerpts: [
        {
          title: 'Spamton G. Spamton',
          url: 'https://deltarune.fandom.com/wiki/Spamton',
          sourceType: 'wiki',
          summary: 'Spamton is a corrupt Addison salesman inhabiting Trash Zone in Cyber World.',
          facts: ['Speaks in bracketed [[BIG SHOT]] phrases and seeks [[Hyperlink Blocked]].'],
        },
      ],
      chatbotNotes: [
        buildChatbotResearchNote({
          source: 'chub',
          url: 'https://chub.ai/characters/x/spamton',
          name: 'Spamton EX',
          creatorName: 'KromerKing',
          rating: 'NSFW',
          greeting: '*Neon buzzes.* "LOOKING FOR A [[Deal]]?"',
          personality: 'Obsessive yet strangely tender when trusted.',
          tags: ['Deltarune', 'NSFW'],
        }),
      ],
    },
  });

  assert.equal(draft.name, 'Spamton G. Spamton');
  assert.equal(draft.rating, 'NSFW');
  assert.equal(draft.avatar, 'data:image/png;base64,AAA');
  assert.equal(draft.backgroundImage, 'data:image/png;base64,BBB');
  assert.equal(splitParagraphs(draft.description).length, 4);
  assert.equal(splitParagraphs(draft.personality).length, 3);
  assert.equal(splitParagraphs(draft.scenario).length, 2);
  assert.equal(splitParagraphs(draft.greeting).length, 3);
  assert.equal(splitParagraphs(draft.systemPrompt).length, 2);
  assert.equal(splitParagraphs(draft.postHistoryInstructions).length, 1);
  assert.equal(splitParagraphs(draft.exampleDialogues).length, 3);
  assert.equal(draft.alternateGreetings.length, 2);
  assert.equal(splitParagraphs(draft.alternateGreetings[0]).length, 2);
  assert.equal(splitParagraphs(draft.creatorNotes).length, 2);
  assert.ok(draft.description.includes('Dealmaker pink-and-yellow glasses'));
  assert.ok(draft.description.includes('Trash Zone') || draft.loreEntries.some((l) => l.content.includes('Trash Zone')));
  assert.equal(draft.tags.includes('Deltarune'), true);

  const seriesWikiDraft = synthesizePalaceMakerDraft({
    prompt: 'Spamton G. Spamton from Deltarune — chaotic glitching alley salesman speaking in static.',
    dossier: {
      excerpts: [
        {
          title: 'Deltarune',
          url: 'https://en.wikipedia.org/wiki/Deltarune',
          sourceType: 'wiki',
          summary: 'Deltarune follows Kris, Susie (who swings her axe), and Ralsei.',
          facts: ['Noelle Holiday helps her classmates across Cyber City.'],
        },
      ],
    },
  });
  assert.equal(seriesWikiDraft.name, 'Spamton G. Spamton');
  assert.equal(seriesWikiDraft.gender, 'Male');
  assert.equal(seriesWikiDraft.pronouns, 'He/Him');
});
