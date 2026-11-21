import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContextualRoleplayReply,
  ensureNonEmptyRoleplayReply,
  generateRoleplayCouncilSlot,
  synthesizeCouncilReplies,
  trimAtWordBoundary,
} from './roleplayEngine';

test('trimAtWordBoundary avoids slicing words mid-token', () => {
  const out = trimAtWordBoundary('Crimson shadows gather beneath the marble colonnade tonight.', 28);
  assert.ok(out.length <= 28);
  assert.ok(!out.endsWith('bene'));
});

test('ensureNonEmptyRoleplayReply recovers blank or asterisk-only replies', () => {
  assert.ok(ensureNonEmptyRoleplayReply('', 'Vesper', 'Hello!').length > 20);
  assert.ok(ensureNonEmptyRoleplayReply('  *  *  ', 'Vesper', 'Tell me a secret').length > 20);
  assert.equal(
    ensureNonEmptyRoleplayReply('*Smiles warmly.* "Good evening."', 'Vesper'),
    '*Smiles warmly.* "Good evening."'
  );
});

test('buildContextualRoleplayReply adapts dynamically to character, user prompt, and flags without banned boilerplate', () => {
  const replyA = buildContextualRoleplayReply({
    character: {
      name: 'Peppa Pig',
      tagline: 'Cheerful pig who loves muddy puddles',
      personality: 'Cheerful, bubbly, playful',
      scenario: 'Outside after rainfall',
    },
    userMessage: 'Look at that giant puddle!',
    history: [],
    flags: { modelId: 'claude-opus-5-5', banEmojis: true },
  });

  const replyB = buildContextualRoleplayReply({
    character: {
      name: 'Nextor',
      tagline: 'Glitchy elevator entity',
      personality: 'Eerie, unpredictable',
    },
    userMessage: 'Which floor are we stopping at?',
    history: [{ sender: 'user', content: 'hi' }],
    flags: { modelId: 'gemini-3.8-flash' },
  });

  assert.notEqual(replyA, replyB);
  assert.ok(!replyA.includes('A gentle breeze passes through'));
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(replyA));
  assert.ok(replyA.toLowerCase().includes('peppa'));
});

test('Multi-Model Council generates distinct slot perspectives and synthesizes them cleanly', () => {
  const char = {
    name: 'Asha',
    tagline: 'Starbound tactician',
    personality: 'Observant, calm, sharp',
    scenario: 'Aboard the orbital spire',
  };
  const slot1 = generateRoleplayCouncilSlot({
    slotId: 'chub-mars',
    role: 'drafter',
    mode: 'council',
    character: char,
    userMessage: 'What is our next move?',
  });
  const slot2 = generateRoleplayCouncilSlot({
    slotId: 'chub-asha',
    role: 'lorekeeper',
    mode: 'council',
    character: char,
    userMessage: 'What is our next move?',
    flags: { relevantLore: ['[Lorebook]: Orbital Spire shields drop at midnight.'] },
  });
  const slot3 = generateRoleplayCouncilSlot({
    slotId: 'claude-opus-5-5',
    role: 'critic',
    mode: 'council',
    character: char,
    userMessage: 'What is our next move?',
  });

  assert.notEqual(slot1, slot2);
  assert.notEqual(slot2, slot3);

  const merged = synthesizeCouncilReplies({
    character: char,
    userMessage: 'What is our next move?',
    candidates: [
      { modelId: 'chub-mars', role: 'drafter', text: slot1 },
      { modelId: 'chub-asha', role: 'lorekeeper', text: slot2 },
      { modelId: 'claude-opus-5-5', role: 'critic', text: slot3 },
    ],
  });

  assert.ok(merged.length > 40);
  assert.ok(!merged.includes('* *'));
});

test('buildContextualRoleplayReply uses short names, inferred she/her pronouns, physical traits, and zero canned boilerplate', () => {
  const bugCard = {
    name: 'Soo-Zee, Democratic Bug',
    tagline: 'Cheerful insectoid engineer aboard a Stackship',
    description: 'She is an enthusiastic bug diver with bright head fins, wings beneath her back plates, and clawed fingers.',
    personality: 'Warm, bubbly, eager, endlessly curious',
    scenario: 'Inside the busy Stackship hangar bay',
  };

  const replyClarify = buildContextualRoleplayReply({
    character: bugCard,
    userMessage: 'I meant that is because I am cool',
    history: [
      { sender: 'user', content: '█████' },
      { sender: 'character', content: '*Soo-Zee blinks.* "I didn\'t catch that—maybe say it one more time?"' },
    ],
    flags: { modelId: 'asha' },
  });

  // Short call-sign name, no comma-title spam in actions
  assert.ok(replyClarify.includes('Soo-Zee'));
  assert.ok(!replyClarify.includes('Soo-Zee, Democratic Bug'));
  // Uses she/her pronouns from the card
  assert.ok(/\b(her|she)\b/i.test(replyClarify));
  // Zero robotic canned boilerplate
  assert.ok(!replyClarify.includes('unspoken subtext hanging'));
  assert.ok(!replyClarify.includes('Careful—flattery and swagger'));
  assert.ok(!replyClarify.includes('Calling yourself cool'));
  assert.ok(!replyClarify.includes("'I meant"));

  // Garbled input does not echo literal gibberish in single quotes
  const replyGarbled = buildContextualRoleplayReply({
    character: bugCard,
    userMessage: '████ ▓▓▓▓ ░░░░',
    history: [],
    flags: { modelId: 'claude-opus-5-5' },
  });
  assert.ok(!replyGarbled.includes('████'));
  assert.ok(/\b(wings|fins|claws|chitin|hangar)\b/i.test(replyGarbled));
});

