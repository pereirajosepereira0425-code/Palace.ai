export interface RequesterIdentity {
  userUid?: string | null;
  guestId?: string | null;
}

/**
 * Determines whether a created resource (character, persona, etc.) belongs to the
 * current user or guest session. Pre-seeded 'system' items remain read-only.
 */
export function isOwnedByRequester(
  ownerId: string | null | undefined,
  requester: RequesterIdentity
): boolean {
  if (!ownerId || ownerId === 'system') return false;
  if (requester.userUid && ownerId === requester.userUid) return true;
  if (requester.guestId && ownerId === requester.guestId) return true;
  if (ownerId === 'guest') return true;
  return false;
}
