export interface CascadeDeletableMessage {
  id: number;
  sender: string;
}

export interface CascadeDeleteComputation<T extends CascadeDeletableMessage> {
  found: boolean;
  targetIndex: number;
  remainingMessages: T[];
  deletedMessages: T[];
  deletedIds: number[];
  deletedCount: number;
  removedSystemCount: number;
  summary: string;
  unsavedCount: number;
}

/**
 * Removes the target message and ALL messages after it (including user, character,
 * and system messages), and updates long-term AI memory summary / unsaved count so
 * deleted turns are completely wiped from future AI prompts.
 */
export function computeCascadeMessageDeletion<T extends CascadeDeletableMessage>(params: {
  messages: T[];
  targetMessageId: number;
  summary?: string | null;
  unsavedCount?: number | null;
}): CascadeDeleteComputation<T> {
  const { messages, targetMessageId, summary = '', unsavedCount = 0 } = params;
  const targetIndex = messages.findIndex((m) => m.id === targetMessageId);

  if (targetIndex === -1) {
    return {
      found: false,
      targetIndex: -1,
      remainingMessages: [...messages],
      deletedMessages: [],
      deletedIds: [],
      deletedCount: 0,
      removedSystemCount: 0,
      summary: summary || '',
      unsavedCount: Math.max(0, Number(unsavedCount || 0)),
    };
  }

  const remainingMessages = messages.slice(0, targetIndex);
  const deletedMessages = messages.slice(targetIndex);
  const deletedIds = deletedMessages.map((m) => m.id);
  const deletedCount = deletedMessages.length;
  const removedSystemCount = deletedMessages.filter((m) => m.sender === 'system').length;

  const prevUnsaved = Math.max(0, Number(unsavedCount || 0));
  const cleanPrevSummary = (summary || '').trim();

  // If we deleted back past the point where the summary was captured (deletedCount > prevUnsaved)
  // or wiped back to only the opening greeting / empty chat, clear the summary completely so
  // deleted events cannot leak back into future AI context.
  const wipesSummarizedMemory =
    remainingMessages.length <= 1 || (Boolean(cleanPrevSummary) && deletedCount > prevUnsaved);

  const nextSummary = wipesSummarizedMemory ? '' : cleanPrevSummary;
  const nextUnsavedCount = wipesSummarizedMemory
    ? Math.max(0, remainingMessages.length - 1)
    : Math.max(0, prevUnsaved - deletedCount);

  return {
    found: true,
    targetIndex,
    remainingMessages,
    deletedMessages,
    deletedIds,
    deletedCount,
    removedSystemCount,
    summary: nextSummary,
    unsavedCount: nextUnsavedCount,
  };
}

const BUILT_IN_FALLBACK_ERROR_CODES = new Set([
  'RATE_LIMITED',
  'PAYMENT_REQUIRED',
  'CLOUDFLARE_BLOCK',
  'TIMEOUT',
  'GATEWAY_TIMEOUT',
  'NETWORK_ERROR',
  'CORS_OR_NETWORK_BLOCK',
  'UPSTREAM_SERVER_ERROR',
  'HTML_INSTEAD_OF_JSON',
  'NOT_FOUND',
  'FORBIDDEN',
  'CONNECTION_RESET',
  'DNS_NOT_FOUND',
]);

/**
 * Returns true when an external provider error (such as Chub.ai 429 "You are out of credits",
 * 402 payment required, Cloudflare blocks, or transient upstream failures) should seamlessly
 * fall back to Palace's Unlimited Built-In Free Engine instead of blocking the chat.
 */
export function shouldFallbackToBuiltInFreeOnExternalError(
  code?: string | null,
  status?: number | null
): boolean {
  const normalizedCode = (code || '').trim().toUpperCase();
  if (BUILT_IN_FALLBACK_ERROR_CODES.has(normalizedCode)) {
    return true;
  }
  if (typeof status === 'number' && (status === 429 || status === 402 || status >= 500)) {
    return true;
  }
  return false;
}
