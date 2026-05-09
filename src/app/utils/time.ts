export function formatElapsedSeconds(startedAt: string | number | null, now = Date.now()) {
  if (startedAt === null) {
    return null;
  }

  const startMs = typeof startedAt === "number" ? startedAt : new Date(startedAt).getTime();
  if (!Number.isFinite(startMs)) {
    return null;
  }

  const elapsed = Math.max(0, Math.floor((now - startMs) / 1000));
  return `経過 ${elapsed}秒`;
}
