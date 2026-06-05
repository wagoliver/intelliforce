"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Voz no mobile = só TTS (falar a resposta). A ENTRADA é pelo microfone do
 * teclado (iOS não expõe Web Speech STT). `speak` deve ser disparado a partir
 * de um gesto do usuário (botão) pra funcionar no iOS.
 */
export function useVoice({ lang = "pt-BR" }: { lang?: string } = {}) {
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        const pt = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("pt"));
        if (pt) u.voice = pt;
        u.onstart = () => setSpeaking(true);
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(u);
      } catch {
        /* ignore */
      }
    },
    [lang],
  );

  const cancelSpeak = useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    setSpeaking(false);
  }, []);

  useEffect(
    () => () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return { speaking, speak, cancelSpeak };
}
