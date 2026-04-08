/** Rough token estimate for budgeting (avoids extra tokenizer deps). ~4 chars/token for English. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

const DEFAULT_MAX_MESSAGES = 10;
const DEFAULT_MAX_HISTORY_TOKENS = 6000;

/**
 * Client sends full history; we keep the tail and drop oldest turns until under a token budget.
 * Applies to prior turns only (current question is appended separately).
 */
export function trimConversationHistory(
  history: Array<{ isUser: boolean; content: string }>,
  options?: { maxMessages?: number; maxHistoryTokens?: number }
): Array<{ isUser: boolean; content: string }> {
  const maxMessages = options?.maxMessages ?? DEFAULT_MAX_MESSAGES;
  const maxHistoryTokens = options?.maxHistoryTokens ?? DEFAULT_MAX_HISTORY_TOKENS;

  let turns = history
    .filter((t) => t.content.trim().length > 0)
    .slice(-maxMessages);

  while (turns.length > 0) {
    const total = turns.reduce((sum, t) => sum + estimateTokens(t.content), 0);
    if (total <= maxHistoryTokens) break;
    turns = turns.slice(1);
  }

  return turns;
}
