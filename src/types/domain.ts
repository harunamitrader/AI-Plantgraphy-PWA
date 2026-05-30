export type ApiProvider = "gemini";

export type ObservationStatus =
  | "queued"
  | "analyzing"
  | "analyzed"
  | "needs_review"
  | "analysis_failed";

export type AppSettings = {
  apiProvider: ApiProvider;
  apiKey: string;
  model: string;
  locationLabels: string[];
  observationSystemPrompt: string;
  observationPrimaryPrompt: string;
  observationRetryPrompt: string;
  plantSystemPrompt: string;
  plantPrimaryPrompt: string;
  plantRetryPrompt: string;
};

export type JobKind = "observation-analysis" | "plant-generation";

export type JobPhase =
  | "queued"
  | "analyzing"
  | "saving"
  | "writing_profile"
  | "finished"
  | "failed"
  | "stopping";

export type JobProgress = {
  phase: JobPhase;
  label: string;
  percent: number;
  startedAt: number;
  updatedAt: number;
  cancelRequested: boolean;
  errorMessage: string | null;
};

export type AnalysisJob = {
  id: string;
  kind: JobKind;
  observationId: string | null;
  plantId: string | null;
  phase: JobPhase;
  label: string;
  percent: number;
  startedAt: number;
  updatedAt: number;
  cancelRequested: boolean;
  errorMessage: string | null;
};

export type AppLogSeverity = "info" | "warning" | "error";

export type AppLogSource =
  | "observation-analysis"
  | "plant-generation"
  | "backup"
  | "settings"
  | "system";

export type AppLog = {
  id: string;
  severity: AppLogSeverity;
  source: AppLogSource;
  message: string;
  observationId: string | null;
  plantId: string | null;
  jobId: string | null;
  details: unknown | null;
  createdAt: string;
};

export type Observation = {
  id: string;
  plantId: string | null;
  status: ObservationStatus;
  capturedAt: string | null;
  receivedAt: string;
  note: string;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  imageIds: string[];
  confidence: number | null;
  rawResult: unknown | null;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type PlantGenerationStatus = "queued" | "analyzing" | "analysis_failed" | null;

export type Plant = {
  id: string;
  displayName: string;
  commonNameJa: string | null;
  scientificName: string | null;
  basicProfileText: string;
  visualAppealText: string;
  careNotes: string;
  profileGeneratedJson: unknown | null;
  profileGenerationSeconds: number | null;
  profileGenerationStatus: PlantGenerationStatus;
  profileGenerationStartedAt: string | null;
  profileGenerationUpdatedAt: string | null;
  profileGenerationErrorMessage: string | null;
  observationCount: number;
  createdFrom: "observation" | "manual";
  representativeImageId: string | null;
  updatedAt: string;
};
