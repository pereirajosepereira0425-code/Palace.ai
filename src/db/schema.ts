import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table linked to Firebase Auth UID with full Chub.ai profile customization
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  username: text('username'), // @handle (unique across users, enforced via route check)
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  bannerUrl: text('banner_url'), // Chub header banner
  bio: text('bio'), // Rich about me with wiki/markdown support
  pronouns: text('pronouns').default('They/Them'),
  gender: text('gender').default('Unknown'),
  theme: text('theme').default('purple'), // 'purple' | 'neon_cyberpunk' | 'dark_obsidian' | 'royal_gold' | 'rose_blossom'
  customCss: text('custom_css'),
  statusMessage: text('status_message'), // Custom status/mood
  badges: text('badges').default('["Chub Creator", "Palace Explorer"]'), // JSON array
  socialLinks: text('social_links').default('{}'), // JSON object: { discord, twitter, github, website, patreon }
  pinnedCharacterUuid: text('pinned_character_uuid'),
  featuredQuote: text('featured_quote'),
  personaName: text('persona_name'),
  personaBio: text('persona_bio'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Characters table (Chub.ai / Janitor.ai / SpicyChat format with full fields)
export const characters = pgTable('characters', {
  id: serial('id').primaryKey(),
  uuid: text('uuid').notNull().unique(),
  name: text('name').notNull(),
  tagline: text('tagline').notNull(),
  avatar: text('avatar').notNull(),
  backgroundImage: text('background_image'), // Chub.ai banner/background
  description: text('description').notNull(),
  personality: text('personality'), // Chub.ai personality definition
  greeting: text('greeting').notNull(), // first_mes
  alternateGreetings: text('alternate_greetings').default('[]'), // Chub.ai JSON array of alternate greetings
  systemPrompt: text('system_prompt').notNull(),
  postHistoryInstructions: text('post_history_instructions'), // Chub.ai depth prompt / jailbreak
  creatorNotes: text('creator_notes'), // Chub.ai creator notes
  characterVersion: text('character_version').default('1.0'),
  scenario: text('scenario'),
  exampleDialogues: text('example_dialogues'),
  tags: text('tags').notNull().default('[]'), // JSON array of tags
  rating: text('rating').notNull().default('SFW'), // 'SFW' | 'NSFW' | 'NSFL' | 'NSFW + NSFL'
  creatorId: text('creator_id').notNull().default('system'),
  creatorName: text('creator_name').notNull().default('Community'),
  chatCount: integer('chat_count').notNull().default(0),
  likeCount: integer('like_count').notNull().default(0),
  voiceName: text('voice_name').notNull().default('Puck'), // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
  voiceStyle: text('voice_style').default('Expressive, natural character dialogue'),
  thinkingDefault: boolean('thinking_default').notNull().default(false),
  searchDefault: boolean('search_default').notNull().default(false),
  lorebook: text('lorebook').default('[]'), // JSON array of lorebook entries: { key: string, content: string }[]
  gender: text('gender').default('Unknown'),
  pronouns: text('pronouns').default('They/Them'),
  model3dUrl: text('model_3d_url'),
  model3dPose: text('model_3d_pose').default('neutral'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Community & User Personas (with every fill-in space from the bots)
export const personas = pgTable('personas', {
  id: serial('id').primaryKey(),
  uuid: text('uuid').notNull().unique(),
  userId: text('user_id').notNull(), // Creator Firebase UID or guestId
  creatorName: text('creator_name').notNull().default('Anonymous'),
  name: text('name').notNull(),
  displayName: text('display_name'),
  avatar: text('avatar').default('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'),
  backgroundImage: text('background_image'),
  bio: text('bio').notNull(),
  gender: text('gender').default('Non-Binary'),
  pronouns: text('pronouns').default('They/Them'),
  description: text('description'),
  personality: text('personality'),
  greeting: text('greeting'),
  alternateGreetings: text('alternate_greetings').default('[]'),
  systemPrompt: text('system_prompt'),
  postHistoryInstructions: text('post_history_instructions'),
  scenario: text('scenario'),
  exampleDialogues: text('example_dialogues'),
  creatorNotes: text('creator_notes'),
  lorebook: text('lorebook').default('[]'),
  model3dUrl: text('model_3d_url'),
  model3dPose: text('model_3d_pose').default('neutral'),
  isPublic: boolean('is_public').notNull().default(false),
  likeCount: integer('like_count').notNull().default(0),
  useCount: integer('use_count').notNull().default(0),
  tags: text('tags').default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Chat sessions (per character, per user)
export const chatSessions = pgTable('chat_sessions', {
  id: serial('id').primaryKey(),
  uuid: text('uuid').notNull().unique(),
  userId: text('user_id').notNull(), // Firebase UID or 'guest'
  characterId: integer('character_id')
    .references(() => characters.id)
    .notNull(),
  title: text('title').notNull(),
  userPersona: text('user_persona'),
  modelPreference: text('model_preference').notNull().default('gemini-3.8-flash'),
  thinkingLevel: text('thinking_level').notNull().default('OFF'), // 'HIGH' | 'OFF'
  searchGrounding: boolean('search_grounding').notNull().default(false),
  summary: text('summary').default(''),
  unsavedMessageCount: integer('unsaved_message_count').notNull().default(0),
  chatSettings: text('chat_settings').default('{}'),
  showAiImages: boolean('show_ai_images').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Chat messages
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull(), // references chatSessions.uuid
  parentId: integer('parent_id'),
  sender: text('sender').notNull(), // 'user' | 'character' | 'system'
  content: text('content').notNull(),
  thinkingProcess: text('thinking_process'),
  groundingSources: text('grounding_sources'), // JSON string of sources
  swipes: text('swipes').default('[]'), // JSON array of alternate responses
  activeSwipeIndex: integer('active_swipe_index').default(0),
  imageUrl: text('image_url'),
  poseName: text('pose_name'),
  createdAt: timestamp('created_at').defaultNow(),
});

// User favorite characters
export const userFavorites = pgTable('user_favorites', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  characterId: integer('character_id')
    .references(() => characters.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Dynamic Chub.ai Tag Database (all preset & user-created custom tags)
export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  usageCount: integer('usage_count').notNull().default(0),
  createdBy: text('created_by').notNull().default('system'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  favorites: many(userFavorites),
}));

export const charactersRelations = relations(characters, ({ many }) => ({
  sessions: many(chatSessions),
  favoritedBy: many(userFavorites),
}));

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  character: one(characters, {
    fields: [chatSessions.characterId],
    references: [characters.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.uuid],
  }),
}));
