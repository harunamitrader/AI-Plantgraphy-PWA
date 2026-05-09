import type { AppSettings, Observation } from "../../types/domain";
import { loadAnalysisImagesForObservation } from "../../storage/repositories/imagesRepository";

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
  analysisTiming: {
    imageCount: number;
    model: string;
    totalSeconds: number;
  };
};

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
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeCandidate(candidate: unknown): ObservationAnalysisCandidate | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const item = candidate as Record<string, unknown>;
  const confidence = toNumberOrNull(item.confidence);
  const reason = toStringOrNull(item.reason);
  if (confidence === null || reason === null) {
    return null;
  }

  const commonNameJa = toStringOrNull(item.commonNameJa ?? item.common_name ?? item.common_name_ja);
  const scientificName = toStringOrNull(item.scientificName ?? item.scientific_name ?? item.scientificNameJa);

  return {
    commonNameJa,
    scientificName,
    confidence,
    reason,
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
    : [];

  const candidates = [root.candidates, root.ai_candidates, identification.candidates]
    .flat()
    .map(normalizeCandidate)
    .filter(Boolean) as ObservationAnalysisCandidate[];

  const visibleFeatures = Array.isArray(root.visible_features)
    ? root.visible_features
    : Array.isArray(identification.visible_features)
      ? identification.visible_features
      : characteristics;

  const confidence = toNumberOrNull(root.confidence ?? identification.confidence);
  const basicProfileText = toStringOrNull(root.basic_profile_text ?? root.basicProfileText) ?? "";
  const visualAppealText = toStringOrNull(root.visual_appeal_text ?? root.visualAppealText) ?? "";
  const careNotes = toStringOrNull(root.care_notes ?? root.careNotes) ?? "";
  const uncertaintyNotes = toStringOrNull(root.uncertainty_notes ?? root.uncertaintyNotes) ?? "";
  const commonNameJa = toStringOrNull(
    root.common_name ?? root.commonNameJa ?? identification.common_name ?? identification.commonNameJa,
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
    candidates,
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

  return JSON.parse(extractJson(text));
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
  const parts: GeminiApiPart[] = [
    {
      text:
        "植物の観察画像を解析して、必ず JSON だけを返してください。トップレベルキーは common_name, scientific_name, confidence, candidates, visible_features, uncertainty_notes, basic_profile_text, visual_appeal_text, care_notes です。追加説明やコードブロックは不要です。",
    },
    {
      text: `観察メモ: ${observation.note || "なし"}\n場所: ${observation.locationLabel || "未設定"}\n撮影日: ${observation.capturedAt ?? "未設定"}`,
    },
  ];

  for (const image of imageRecords) {
    const buffer = await image.blob.arrayBuffer();
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: toBase64(buffer),
      },
    });
  }

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
                "あなたは植物観察の補助をするアシスタントです。出力は JSON のみ。曖昧なら null を使い、根拠のない断定は避けてください。",
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
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini API エラー: ${response.status}`);
  }

  const raw = await parseGeminiText(response);
  const normalized = normalizeResult(raw);
  normalized.analysisTiming.totalSeconds = Math.max(
    0,
    Math.round((performance.now() - startedAt) / 1000),
  );
  normalized.analysisTiming.imageCount = imageRecords.length;
  normalized.analysisTiming.model = settings.model;
  normalized.geminiModel = settings.model;
  return normalized;
}
