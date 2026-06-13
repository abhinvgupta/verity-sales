/**
 * Safely parses a JSON string, tolerating accidental markdown code fences
 * that an LLM may emit despite instructions. Returns null on failure.
 */
export function safeParseJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
