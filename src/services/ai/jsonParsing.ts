export type GeminiApiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export function extractJsonCandidate(text: string) {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    return trimmed;
  }
  return trimmed.slice(start, end + 1);
}

function parseJsonValue(text: string): unknown {
  const parsed = JSON.parse(text) as unknown;
  if (typeof parsed !== "string") {
    return parsed;
  }

  const nested = parsed.trim();
  if (
    (nested.startsWith("{") && nested.endsWith("}")) ||
    (nested.startsWith("[") && nested.endsWith("]"))
  ) {
    return JSON.parse(nested) as unknown;
  }

  return parsed;
}

export function parseStructuredJsonText(text: string) {
  const trimmed = text.trim();
  const extractedJson = extractJsonCandidate(trimmed);
  const attempts = extractedJson === trimmed ? [trimmed] : [trimmed, extractedJson];
  let lastError: unknown = new Error("Gemini のJSON解析に失敗しました。");

  for (const candidate of attempts) {
    try {
      return {
        parsed: parseJsonValue(candidate),
        extractedJson,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function readGeminiText(response: Response) {
  const payload = (await response.json()) as GeminiApiResponse;
  const text = payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim() ?? "";

  return { payload, text };
}
