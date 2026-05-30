export const DEFAULT_OBSERVATION_SYSTEM_PROMPT =
  "出力はJSONのみ。不明はnullまたは[]。根拠のない断定はしない。confidenceは0〜1。";

export const DEFAULT_OBSERVATION_PRIMARY_PROMPT =
  '植物画像を見て、JSONのみ返してください。\n不明な値は null、配列は []、推測で埋めないでください。\nconfidence は 0〜1 の数値です。\n\n返却JSON:\n{"common_name":null,"scientific_name":null,"confidence":null,"candidates":[{"common_name":null,"scientific_name":null,"confidence":null,"reason":""}],"visible_features":[],"uncertainty_notes":""}\n\n制約:\n- candidates は 0〜3 件\n- visible_features は 0〜5 件\n- 説明文、Markdown、コードブロックは不要';

export const DEFAULT_OBSERVATION_RETRY_PROMPT =
  'JSONのみ返してください。\n{"common_name":null,"scientific_name":null,"confidence":null,"candidates":[],"visible_features":[],"uncertainty_notes":""}\n不明な値は null または [] にしてください。';

export const DEFAULT_PLANT_SYSTEM_PROMPT =
  "出力はJSONのみ。不明な学名はnull。推測で断定しない。";

export const DEFAULT_PLANT_PRIMARY_PROMPT =
  '植物図鑑の説明を作ります。JSONのみ返してください。\n不明な学名は null にしてください。推測で断定しないでください。\n\n返却JSON:\n{"common_name":null,"scientific_name":null,"basic_profile_text":"","visual_appeal_text":"","care_notes":"","uncertainty_notes":""}\n\n制約:\n- すべてトップレベル\n- basic_profile_text, visual_appeal_text, care_notes は各1〜2文の日本語\n- 箇条書き、Markdown、コードブロックは禁止\n- uncertainty_notes は不確実な点だけを書く。なければ ""';

export const DEFAULT_PLANT_RETRY_PROMPT =
  'JSONのみ返してください。\n{"common_name":null,"scientific_name":null,"basic_profile_text":"","visual_appeal_text":"","care_notes":"","uncertainty_notes":""}\n\nbasic_profile_text, visual_appeal_text, care_notes は空にしないでください。\n学名が不確かなら scientific_name は null にしてください。';
