import type { AppSettings, Observation } from "../../types/domain";
import { loadAnalysisImagesForObservation } from "../../storage/repositories/imagesRepository";
import {
  DEFAULT_OBSERVATION_PRIMARY_PROMPT,
  DEFAULT_OBSERVATION_RETRY_PROMPT,
  DEFAULT_OBSERVATION_SYSTEM_PROMPT,
} from "./promptDefaults";

export type ObservationAnalysisCandidate = {
  commonNameJa: string | null;
  scientificName: string | null;
  confidence: number;
  reason: string;
};

export type ObservationAnalysisResult = {
  commonNameJa: string | null;
  scientificName: string | null;
  confidence: number | null;
  candidates: ObservationAnalysisCandidate[];
  visibleFeatures: string[];
  uncertaintyNotes: string;
  basicProfileText: string;
  visualAppealText: string;
  careNotes: string;
  geminiModel: string;
  rawJson?: unknown | null;
  analysisTiming: {
    imageCount: number;
    model: string;
    totalSeconds: number;
  };
};

export class ObservationAnalysisDebugError extends Error {
  debugPayload: unknown;

  constructor(message: string, debugPayload: unknown) {
    super(message);
    this.name = "ObservationAnalysisDebugError";
    this.debugPayload = debugPayload;
  }
}

type GeminiApiPart = {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
};

type GeminiApiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
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

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toNumberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace("%", "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeConfidence(value: unknown) {
  const number = toNumberOrNull(value);
  if (number === null) {
    return null;
  }
  const normalized = number > 1 && number <= 100 ? number / 100 : number;
  return Math.min(1, Math.max(0, normalized));
}

function collectStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
  }
  const text = toStringOrNull(value);
  return text ? [text] : [];
}

function normalizeCandidate(candidate: unknown): ObservationAnalysisCandidate | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const item = candidate as Record<string, unknown>;
  const commonNameJa = toStringOrNull(
    item.commonNameJa ?? item.common_name_ja ?? item.common_name ?? item.plant_name ?? item.name,
  );
  const scientificName = toStringOrNull(item.scientificName ?? item.scientific_name);
  if (!commonNameJa && !scientificName) {
    return null;
  }

  return {
    commonNameJa,
    scientificName,
    confidence: normalizeConfidence(item.confidence) ?? 0.5,
    reason: toStringOrNull(item.reason) ?? "候補として返されました。",
  };
}

function normalizeResult(raw: unknown): ObservationAnalysisResult {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const identification =
    root.plant_identification && typeof root.plant_identification === "object"
      ? (root.plant_identification as Record<string, unknown>)
      : root.plantIdentification && typeof root.plantIdentification === "object"
        ? (root.plantIdentification as Record<string, unknown>)
        : root;
  const observationDetails =
    root.observation_details && typeof root.observation_details === "object"
      ? (root.observation_details as Record<string, unknown>)
      : root.observationDetails && typeof root.observationDetails === "object"
        ? (root.observationDetails as Record<string, unknown>)
        : null;
  const characteristics = Array.isArray(observationDetails?.characteristics)
    ? observationDetails.characteristics
    : observationDetails?.characteristics
      ? collectStrings(observationDetails.characteristics)
    : [];

  const candidates = [root.candidates, root.ai_candidates, identification.candidates]
    .flat()
    .map(normalizeCandidate)
    .filter(Boolean) as ObservationAnalysisCandidate[];

  const visibleFeatures = Array.isArray(root.visible_features)
    ? root.visible_features
    : Array.isArray(root.visibleFeatures)
      ? root.visibleFeatures
      : Array.isArray(identification.visible_features)
      ? identification.visible_features
      : Array.isArray(identification.visibleFeatures)
        ? identification.visibleFeatures
        : collectStrings(root.characteristics).length > 0
          ? collectStrings(root.characteristics)
          : characteristics;

  const confidence = normalizeConfidence(root.confidence ?? identification.confidence);
  const basicProfileText = toStringOrNull(root.basic_profile_text ?? root.basicProfileText) ?? "";
  const visualAppealText = toStringOrNull(root.visual_appeal_text ?? root.visualAppealText) ?? "";
  const careNotes = toStringOrNull(root.care_notes ?? root.careNotes) ?? "";
  const uncertaintyNotes = toStringOrNull(root.uncertainty_notes ?? root.uncertaintyNotes) ?? "";
  const commonNameJa = toStringOrNull(
    root.common_name_ja ??
      root.common_name ??
      root.commonNameJa ??
      root.plant_name ??
      identification.common_name_ja ??
      identification.common_name ??
      identification.commonNameJa ??
      identification.plant_name,
  );
  const scientificName = toStringOrNull(
    root.scientific_name ??
      root.scientificName ??
      identification.scientific_name ??
      identification.scientificName,
  );
  const geminiModel = toStringOrNull(root.gemini_model ?? root.geminiModel) ?? "";
  const model = geminiModel || "gemini";
  const analysisTiming = root.analysis_timing && typeof root.analysis_timing === "object"
    ? (root.analysis_timing as Record<string, unknown>)
    : root.analysisTiming && typeof root.analysisTiming === "object"
      ? (root.analysisTiming as Record<string, unknown>)
      : {};
  const imageCount = Number(analysisTiming.image_count ?? analysisTiming.imageCount ?? 0) || 0;
  const totalSeconds =
    Number(analysisTiming.total_seconds ?? analysisTiming.totalSeconds ?? 0) || 0;

  return {
    commonNameJa,
    scientificName,
    confidence,
    candidates:
      candidates.length > 0 || !commonNameJa
        ? candidates
        : [
            {
              commonNameJa,
              scientificName,
              confidence: confidence ?? 0.68,
              reason: "解析結果で植物名が返されました。",
            },
          ],
    visibleFeatures: visibleFeatures
      .map((item: unknown) => toStringOrNull(item))
      .filter((item: string | null): item is string => Boolean(item)),
    uncertaintyNotes,
    basicProfileText,
    visualAppealText,
    careNotes,
    geminiModel: model,
    analysisTiming: {
      imageCount,
      model,
      totalSeconds,
    },
  };
}

function hasUsableObservationResult(result: ObservationAnalysisResult) {
  return Boolean(
    result.commonNameJa ||
      result.scientificName ||
      result.candidates.length > 0 ||
      result.visibleFeatures.length > 0,
  );
}

async function parseGeminiText(response: Response) {
  const payload = (await response.json()) as GeminiApiResponse;
  const text = payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new ObservationAnalysisDebugError("Gemini から空の応答が返りました。", {
      responseEnvelope: payload,
      responseText: "",
    });
  }

  const extractedJson = extractJson(text);
  try {
    return JSON.parse(extractedJson);
  } catch (error) {
    throw new ObservationAnalysisDebugError(
      error instanceof Error ? error.message : "Gemini のJSON解析に失敗しました。",
      {
        responseEnvelope: payload,
        responseText: text,
        extractedJson,
      },
    );
  }
}

export async function analyzeObservationWithGemini(
  observation: Observation,
  settings: AppSettings,
): Promise<ObservationAnalysisResult> {
  const imageRecords = await loadAnalysisImagesForObservation(observation.id);
  if (imageRecords.length === 0) {
    throw new Error("解析対象の画像がありません。");
  }

  if (!settings.apiKey) {
    throw new Error("Gemini API キーが設定されていません。");
  }

  const startedAt = performance.now();
  const imageParts: GeminiApiPart[] = [];
  for (const image of imageRecords) {
    const buffer = await image.blob.arrayBuffer();
    imageParts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: toBase64(buffer),
      },
    });
  }

  const contextText = `観察メモ: ${observation.note || "なし"}\n場所: ${observation.locationLabel || "未設定"}\n撮影日: ${observation.capturedAt ?? "未設定"}`;
  const systemPrompt = settings.observationSystemPrompt.trim() || DEFAULT_OBSERVATION_SYSTEM_PROMPT;
  const primaryPrompt = settings.observationPrimaryPrompt.trim() || DEFAULT_OBSERVATION_PRIMARY_PROMPT;
  const retryPrompt = settings.observationRetryPrompt.trim() || DEFAULT_OBSERVATION_RETRY_PROMPT;
  const primaryParts: GeminiApiPart[] = [
    {
      text: primaryPrompt,
    },
    {
      text: contextText,
    },
    ...imageParts,
  ];
  const retryParts: GeminiApiPart[] = [
    {
      text: retryPrompt,
    },
    { text: contextText },
    ...imageParts,
  ];

  async function requestJson(parts: GeminiApiPart[]) {
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
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      }),
    },
  );

    if (!response.ok) {
      throw new Error(`Gemini API エラー: ${response.status}`);
    }

    return parseGeminiText(response);
  }

  let raw: unknown;
  let normalized: ObservationAnalysisResult;
  try {
    raw = await requestJson(primaryParts);
    normalized = normalizeResult(raw);
    if (!hasUsableObservationResult(normalized)) {
      throw new Error("解析結果に植物名・候補・特徴が含まれていません。");
    }
  } catch (error) {
    raw = await requestJson(retryParts);
    normalized = normalizeResult(raw);
    if (!hasUsableObservationResult(normalized)) {
      throw error instanceof Error ? error : new Error("観察解析結果の正規化に失敗しました。");
    }
  }
  normalized.analysisTiming.totalSeconds = Math.max(
    0,
    Math.round((performance.now() - startedAt) / 1000),
  );
  normalized.analysisTiming.imageCount = imageRecords.length;
  normalized.analysisTiming.model = settings.model;
  normalized.geminiModel = settings.model;
  normalized.rawJson = raw;
  return normalized;
}
