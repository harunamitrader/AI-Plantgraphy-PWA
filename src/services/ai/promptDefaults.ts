export const DEFAULT_OBSERVATION_SYSTEM_PROMPT =
  "JSON objectのみ返す。不明はnullまたは[]。推測で断定しない。";

export const DEFAULT_OBSERVATION_PRIMARY_PROMPT =
  '植物画像を見て、次のJSON objectを返してください。\ncommon_name は和名、scientific_name は学名、confidence は 0〜1 です。\n{"common_name":null,"scientific_name":null,"confidence":null,"candidates":[{"common_name":null,"scientific_name":null,"confidence":null,"reason":""}],"visible_features":[],"uncertainty_notes":""}';

export const DEFAULT_OBSERVATION_RETRY_PROMPT =
  '同じ項目のJSON objectのみ返してください。\n{"common_name":null,"scientific_name":null,"confidence":null,"candidates":[],"visible_features":[],"uncertainty_notes":""}';

export const DEFAULT_PLANT_SYSTEM_PROMPT =
  "JSON objectのみ返す。不明な学名はnull。推測で断定しない。";

export const DEFAULT_PLANT_PRIMARY_PROMPT =
  '植物図鑑用に次のJSON objectを返してください。\nbasic_profile_text, visual_appeal_text, care_notes は各1〜2文の日本語です。\n{"common_name":null,"scientific_name":null,"basic_profile_text":"","visual_appeal_text":"","care_notes":"","uncertainty_notes":""}';

export const DEFAULT_PLANT_RETRY_PROMPT =
  '同じ項目のJSON objectのみ返してください。\n{"common_name":null,"scientific_name":null,"basic_profile_text":"","visual_appeal_text":"","care_notes":"","uncertainty_notes":""}';
