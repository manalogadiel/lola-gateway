import { useCallback, useEffect, useRef, useState } from "react";

export function useCopyFeedback(durationMs = 1800) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const copy = useCallback(
    async (value: string) => {
      if (!value) {
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
          setCopied(false);
          timerRef.current = null;
        }, durationMs);
      } catch {
        // Clipboard API may be unavailable in restricted contexts.
      }
    },
    [durationMs]
  );

  return { copied, copy };
}
