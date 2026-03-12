"use client";

import { useEffect, useState } from "react";

export function FlashMessage({
  message,
  tone
}: {
  message?: string;
  tone: "success" | "error";
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);

    if (!message) {
      return;
    }

    void fetch("/api/flash/clear", {
      method: "POST"
    }).catch(() => undefined);

    const timeoutId = window.setTimeout(() => {
      setDismissed(true);
    }, 10_000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message]);

  if (!message || dismissed) {
    return null;
  }

  return (
    <div className={`flash flash-${tone}`} role="status" aria-live="polite">
      <p>{message}</p>
      <button
        type="button"
        className="flash__close"
        aria-label="Dismiss message"
        onClick={() => {
          setDismissed(true);
          void fetch("/api/flash/clear", {
            method: "POST"
          }).catch(() => undefined);
        }}
      >
        ×
      </button>
    </div>
  );
}
