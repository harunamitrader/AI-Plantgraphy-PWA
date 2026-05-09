import type { AppSettings } from "../../types/domain";

export type PlantProfileResult = {
  commonNameJa: string;
  scientificName: string | null;
  basicProfileText: string;
  visualAppealText: string;
  careNotes: string;
  uncertaintyNotes: string;
  geminiModel: string;
  generationSeconds: number;
};

type PlantProfileInput = {
  commonNameJa: string;
  scientificName?: string | null;
  visibleFeatures?: string[];
  observationNote?: string;
};

type GeminiApiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Gemini の応答から JSON を抽出できませんでした。");
  }
  return trimmed.slice(start, end + 1);
}

async function parseGeminiText(response: Response) {
  const payload = (await response.json()) as GeminiApiResponse;
  const text = payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini から空の応答が返りました。");
  }

  return JSON.parse(extractJson(text)) as Record<string, unknown>;
}

function normalizePlantProfile(raw: Record<string, unknown>, model: string, generationSeconds: number) {
  const commonNameJa =
    toStringOrNull(raw.common_name_ja) ??
    toStringOrNull(raw.common_name) ??
    toStringOrNull(raw.commonNameJa) ??
    "";
  const scientificName =
    toStringOrNull(raw.scientific_name) ??
    toStringOrNull(raw.scientificName) ??
    null;

  return {
    commonNameJa,
    scientificName,
    basicProfileText:
      toStringOrNull(raw.basic_profile_text) ?? toStringOrNull(raw.basicProfileText) ?? "",
    visualAppealText:
      toStringOrNull(raw.visual_appeal_text) ?? toStringOrNull(raw.visualAppealText) ?? "",
    careNotes: toStringOrNull(raw.care_notes) ?? toStringOrNull(raw.careNotes) ?? "",
    uncertaintyNotes:
      toStringOrNull(raw.uncertainty_notes) ?? toStringOrNull(raw.uncertaintyNotes) ?? "",
    geminiModel: model,
    generationSeconds,
  } satisfies PlantProfileResult;
}

export async function generatePlantProfileWithGemini(
  input: PlantProfileInput,
  settings: AppSettings,
): Promise<PlantProfileResult> {
  if (!settings.apiKey) {
    throw new Error("Gemini API キーが設定されていません。");
  }

  const startedAt = performance.now();
  const visibleFeaturesText =
    input.visibleFeatures && input.visibleFeatures.length > 0
      ? input.visibleFeatures.join(", ")
      : "不明";
  const observationNote = input.observationNote?.trim() || "なし";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "あなたは植物図鑑の補助をするアシスタントです。返答は JSON のみ。曖昧なら scientific_name は null にしてください。",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "植物名から図鑑本文を作成してください。トップレベルキーは common_name_ja, scientific_name, basic_profile_text, visual_appeal_text, care_notes, uncertainty_notes です。追加説明は禁止です。",
              },
              {
                text: `和名: ${input.commonNameJa}\n学名: ${input.scientificName ?? "未指定"}\n見えている特徴: ${visibleFeaturesText}\n観察メモ: ${observationNote}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1536,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini API エラー: ${response.status}`);
  }

  const raw = await parseGeminiText(response);
  const result = normalizePlantProfile(
    raw,
    settings.model,
    Math.max(0, Math.round((performance.now() - startedAt) / 1000)),
  );

  if (!result.commonNameJa) {
    throw new Error("図鑑生成結果に植物名が含まれていません。");
  }

  return result;
}
