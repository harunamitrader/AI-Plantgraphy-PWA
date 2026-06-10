import type { AppSettings } from "../../types/domain";
import {
  DEFAULT_PLANT_PRIMARY_PROMPT,
  DEFAULT_PLANT_RETRY_PROMPT,
  DEFAULT_PLANT_SYSTEM_PROMPT,
} from "./promptDefaults";
import { parseStructuredJsonText, readGeminiError, readGeminiText } from "./jsonParsing";

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

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function textFromUnknown(value: unknown): string | null {
  if (Array.isArray(value)) {
    const text = value.map(textFromUnknown).filter(Boolean).join(" ");
    return text.trim() ? text.trim() : null;
  }
  if (value && typeof value === "object") {
    const text = Object.values(value as Record<string, unknown>).map(textFromUnknown).filter(Boolean).join(" ");
    return text.trim() ? text.trim() : null;
  }
  return toStringOrNull(value);
}

async function parseGeminiText(response: Response) {
  const { text } = await readGeminiText(response);

  if (!text) {
    throw new Error("Gemini から空の応答が返りました。");
  }

  const { parsed } = parseStructuredJsonText(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Gemini のJSONが object ではありません。");
  }
  return parsed as Record<string, unknown>;
}

const PLANT_PROFILE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    common_name: { type: ["string", "null"] },
    scientific_name: { type: ["string", "null"] },
    basic_profile_text: { type: "string" },
    visual_appeal_text: { type: "string" },
    care_notes: { type: "string" },
    uncertainty_notes: { type: "string" },
  },
} as const;

function normalizePlantProfile(
  raw: Record<string, unknown>,
  model: string,
  generationSeconds: number,
  fallbackName: string,
) {
  const profile =
    raw.profile && typeof raw.profile === "object"
      ? (raw.profile as Record<string, unknown>)
      : raw.plant_profile && typeof raw.plant_profile === "object"
        ? (raw.plant_profile as Record<string, unknown>)
        : raw;
  const commonNameJa =
    toStringOrNull(profile.common_name) ??
    toStringOrNull(profile.common_name_ja) ??
    toStringOrNull(profile.commonNameJa) ??
    toStringOrNull(profile.plant_name) ??
    fallbackName;
  const scientificName =
    toStringOrNull(profile.scientific_name) ??
    toStringOrNull(profile.scientificName) ??
    null;

  return {
    commonNameJa,
    scientificName,
    basicProfileText:
      textFromUnknown(profile.basic_profile_text ?? profile.basicProfileText ?? profile.characteristics) ?? "",
    visualAppealText:
      textFromUnknown(profile.visual_appeal_text ?? profile.visualAppealText ?? profile.appearance) ?? "",
    careNotes: textFromUnknown(profile.care_notes ?? profile.careNotes ?? profile.care_advice) ?? "",
    uncertaintyNotes:
      textFromUnknown(profile.uncertainty_notes ?? profile.uncertaintyNotes) ?? "",
    geminiModel: model,
    generationSeconds,
  } satisfies PlantProfileResult;
}

function isUsablePlantProfile(result: PlantProfileResult) {
  return Boolean(
    result.commonNameJa.trim() &&
      result.basicProfileText.trim() &&
      result.visualAppealText.trim() &&
      result.careNotes.trim(),
  );
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
  const systemPrompt = settings.plantSystemPrompt.trim() || DEFAULT_PLANT_SYSTEM_PROMPT;
  const primaryPrompt = settings.plantPrimaryPrompt.trim() || DEFAULT_PLANT_PRIMARY_PROMPT;
  const retryPrompt = settings.plantRetryPrompt.trim() || DEFAULT_PLANT_RETRY_PROMPT;

  async function requestJson(prompt: string) {
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
                text: systemPrompt,
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt,
                },
                {
                  text: `和名: ${input.commonNameJa}\n学名: ${input.scientificName ?? "未指定"}\n見えている特徴: ${visibleFeaturesText}\n観察メモ: ${observationNote}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1200,
            responseMimeType: "application/json",
            responseSchema: PLANT_PROFILE_RESPONSE_SCHEMA,
          },
        }),
      },
    );

    if (!response.ok) {
      const { message } = await readGeminiError(response);
      throw new Error(message);
    }

    return parseGeminiText(response);
  }

  const generationSeconds = () => Math.max(0, Math.round((performance.now() - startedAt) / 1000));
  let raw: Record<string, unknown>;
  let result: PlantProfileResult;

  try {
    raw = await requestJson(primaryPrompt);
    result = normalizePlantProfile(raw, settings.model, generationSeconds(), input.commonNameJa);
    if (!isUsablePlantProfile(result)) {
      throw new Error("図鑑生成結果に空の項目があります。");
    }
  } catch (error) {
    raw = await requestJson(retryPrompt);
    result = normalizePlantProfile(raw, settings.model, generationSeconds(), input.commonNameJa);
    if (!isUsablePlantProfile(result)) {
      throw error instanceof Error ? error : new Error("図鑑生成結果の正規化に失敗しました。");
    }
  }

  if (!result.commonNameJa) {
    throw new Error("図鑑生成結果に植物名が含まれていません。");
  }

  return result;
}
