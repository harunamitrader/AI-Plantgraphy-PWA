import { useEffect, useMemo, useState } from "react";
import { useSettingsStore } from "../../features/settings/store/useSettingsStore";

export function useRuntimeStatus() {
  const apiKey = useSettingsStore((state) => state.apiKey);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return useMemo(() => {
    const hasApiKey = Boolean(apiKey.trim());
    const aiReady = isOnline && hasApiKey;
    const aiBlockedReason = !isOnline
      ? "オフライン中です。AI解析と図鑑生成はオンライン復帰後に実行できます。"
      : !hasApiKey
        ? "Gemini API キーが未設定です。設定画面で入力すると AI 機能を使えます。"
        : null;

    return {
      isOnline,
      hasApiKey,
      aiReady,
      aiBlockedReason,
    };
  }, [apiKey, isOnline]);
}
