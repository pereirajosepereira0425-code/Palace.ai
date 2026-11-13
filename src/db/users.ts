import { db } from './index.ts';
import { users, characters, personas } from './schema.ts';
import { eq, sql, and, ne } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, displayName?: string, avatarUrl?: string) {
  try {
    const defaultUsername = (displayName || email.split('@')[0])
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 24);

    const result = await db.insert(users)
      .values({
        uid,
        email,
        username: defaultUsername || `user_${uid.slice(0, 6)}`,
        displayName: displayName || email.split('@')[0],
        avatarUrl: avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
        bannerUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1600&q=80',
        bio: 'Roleplayer, bot architect, and worldbuilder on Palace.ai.',
        pronouns: 'They/Them',
        gender: 'Unknown',
        theme: 'purple',
        statusMessage: 'Crafting unforgettable stories & characters ✨',
        badges: JSON.stringify(['Chub Creator', 'Palace Explorer', 'Early Adopter']),
        socialLinks: JSON.stringify({
          discord: '',
          twitter: '',
          website: '',
        }),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(displayName ? { displayName } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database getOrCreateUser failed:', error);
    throw new Error('Database user sync failed', { cause: error });
  }
}

export async function getUserProfile(uid: string) {
  try {
    const res = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return res[0] || null;
  } catch (error) {
    console.error('Database getUserProfile failed:', error);
    throw new Error('Failed to fetch user profile', { cause: error });
  }
}

export async function isUsernameAvailable(username: string, excludeUid?: string): Promise<boolean> {
  try {
    const cleanHandle = username.toLowerCase().trim().replace(/^@/, '');
    if (!cleanHandle) return false;

    const condition = excludeUid
      ? and(sql`LOWER(${users.username}) = ${cleanHandle}`, ne(users.uid, excludeUid))
      : sql`LOWER(${users.username}) = ${cleanHandle}`;

    const existing = await db.select({ id: users.id }).from(users).where(condition).limit(1);
    return existing.length === 0;
  } catch (error) {
    console.error('isUsernameAvailable check failed:', error);
    return false;
  }
}

export async function getUserByUsername(username: string) {
  try {
    const cleanHandle = username.toLowerCase().trim().replace(/^@/, '');
    let res = await db.select().from(users).where(sql`LOWER(${users.username}) = ${cleanHandle}`).limit(1);

    // If biguswigus requested and not yet seeded, initialize the showcase profile
    if (!res[0] && cleanHandle === 'biguswigus') {
      const seeded = await db.insert(users).values({
        uid: 'seed-biguswigus-creator',
        email: 'biguswigus@chub.palace.ai',
        username: 'biguswigus',
        displayName: 'BigusWigus',
        avatarUrl: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=600&q=80',
        bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80',
        bio: '== Creator Lore & Wiki Profile ==\nWelcome to my Chub / Palace laboratory! I design multi-layered RPG roleplay scenarios, high-thinking cybernetic neural entities, and deep lorebook codices.\n\n{| class="wikitable"\n! Spec !! Engine !! Philosophy\n|-\n| Tavern V2 || Gemini 4 Argon || Deep Prose & Zero Slop\n|}\n\nFeel free to explore my bots, fork my personas, and leave a message on the guestbook!',
        pronouns: 'He/They',
        gender: 'Cybernetic Architect',
        theme: 'cyan',
        statusMessage: 'Building high-fidelity Tavern V2 cards for Palace.ai ⚡',
        badges: JSON.stringify(['Chub Pioneer', 'Grand Bot Architect', 'Wiki Scribe', 'Tavern V2 Master']),
        socialLinks: JSON.stringify({
          discord: 'bigus#1337',
          twitter: 'https://twitter.com/biguswigus',
          website: 'https://chub.ai/users/biguswigus',
        }),
        featuredQuote: 'The boundary between prompt and reality is merely an illusion waiting for the right token.',
      }).returning();
      res = seeded;
    }

    if (!res[0]) return null;

    const user = res[0];

    // Fetch user's created characters
    const createdBots = await db.select().from(characters).where(eq(characters.creatorId, user.uid));
    
    // Fetch user's personas
    const userPersonas = await db.select().from(personas).where(eq(personas.userId, user.uid));

    return {
      user,
      createdBots,
      userPersonas,
    };
  } catch (error) {
    console.error('Database getUserByUsername failed:', error);
    throw new Error('Failed to fetch user by username', { cause: error });
  }
}

export async function updateUserProfile(uid: string, profileData: {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  bio?: string;
  pronouns?: string;
  gender?: string;
  theme?: string;
  customCss?: string;
  statusMessage?: string;
  badges?: string[] | string;
  socialLinks?: Record<string, string> | string;
  pinnedCharacterUuid?: string;
  featuredQuote?: string;
}) {
  try {
    const payload: any = {};
    if (profileData.username !== undefined) {
      const cleanHandle = profileData.username.toLowerCase().trim().replace(/^@/, '');
      if (cleanHandle) {
        // Verify uniqueness
        const available = await isUsernameAvailable(cleanHandle, uid);
        if (!available) {
          throw new Error(`Username @${cleanHandle} is already taken by another user.`);
        }
        payload.username = cleanHandle;
      }
    }

    if (profileData.displayName !== undefined) payload.displayName = profileData.displayName;
    if (profileData.avatarUrl !== undefined) payload.avatarUrl = profileData.avatarUrl;
    if (profileData.bannerUrl !== undefined) payload.bannerUrl = profileData.bannerUrl;
    if (profileData.bio !== undefined) payload.bio = profileData.bio;
    if (profileData.pronouns !== undefined) payload.pronouns = profileData.pronouns;
    if (profileData.gender !== undefined) payload.gender = profileData.gender;
    if (profileData.theme !== undefined) payload.theme = profileData.theme;
    if (profileData.customCss !== undefined) payload.customCss = profileData.customCss;
    if (profileData.statusMessage !== undefined) payload.statusMessage = profileData.statusMessage;
    if (profileData.badges !== undefined) {
      payload.badges = typeof profileData.badges === 'string' ? profileData.badges : JSON.stringify(profileData.badges);
    }
    if (profileData.socialLinks !== undefined) {
      payload.socialLinks = typeof profileData.socialLinks === 'string' ? profileData.socialLinks : JSON.stringify(profileData.socialLinks);
    }
    if (profileData.pinnedCharacterUuid !== undefined) payload.pinnedCharacterUuid = profileData.pinnedCharacterUuid;
    if (profileData.featuredQuote !== undefined) payload.featuredQuote = profileData.featuredQuote;

    const res = await db.update(users)
      .set(payload)
      .where(eq(users.uid, uid))
      .returning();

    return res[0];
  } catch (error) {
    console.error('Database updateUserProfile failed:', error);
    throw error;
  }
}

export async function updateUserPersona(uid: string, personaName: string, personaBio: string) {
  try {
    const res = await db.update(users)
      .set({ personaName, personaBio })
      .where(eq(users.uid, uid))
      .returning();
    return res[0];
  } catch (error) {
    console.error('Database updateUserPersona failed:', error);
    throw new Error('Failed to update persona', { cause: error });
  }
}
