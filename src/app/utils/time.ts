export function formatElapsedSeconds(
  startedAt: string | number | null,
  now = Date.now(),
  endedAt: string | number | null = null,
) {
  if (startedAt === null) {
    return null;
  }

  const startMs = typeof startedAt === "number" ? startedAt : new Date(startedAt).getTime();
  if (!Number.isFinite(startMs)) {
    return null;
  }

  const endMs = endedAt === null ? now : typeof endedAt === "number" ? endedAt : new Date(endedAt).getTime();
  if (!Number.isFinite(endMs)) {
    return null;
  }

  const elapsed = Math.max(0, Math.floor((endMs - startMs) / 1000));
  return `経過 ${elapsed}秒`;
}

export function currentDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
