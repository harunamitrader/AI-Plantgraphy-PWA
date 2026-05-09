import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    navigatorWithStandalone.standalone === true
  );
}

export function useInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode());
  const [isPrompting, setIsPrompting] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstallEvent(null);
      setIsInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    const mediaQuery = window.matchMedia?.("(display-mode: standalone)");
    const syncStandalone = () => {
      setIsInstalled(isStandaloneMode());
    };

    mediaQuery?.addEventListener?.("change", syncStandalone);
    syncStandalone();

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      mediaQuery?.removeEventListener?.("change", syncStandalone);
    };
  }, []);

  const canInstall = useMemo(() => !isInstalled && installEvent !== null, [installEvent, isInstalled]);

  async function promptInstall() {
    if (!installEvent) {
      return false;
    }

    setIsPrompting(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        setInstallEvent(null);
        setIsInstalled(true);
        return true;
      }
      return false;
    } finally {
      setIsPrompting(false);
    }
  }

  return {
    canInstall,
    isInstalled,
    isPrompting,
    promptInstall,
  };
}
