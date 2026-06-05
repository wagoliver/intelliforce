"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseVoiceOpts = { lang?: string; onFinal?: (text: string) => void };

/**
 * Voz via Web Speech API (100% client-side):
 *  - STT: webkitSpeechRecognition (push-to-talk, pt-BR)
 *  - TTS: speechSynthesis (fala a resposta)
 *
 * Limitações conhecidas: STT instável no iOS; TTS no iOS exige gesto do
 * usuário. `supported` reflete só o STT — sempre cai pra texto se ausente.
 */
export function useVoice({ lang = "pt-BR", onFinal }: UseVoiceOpts = {}) {
  const [supported, setSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<any>(null);
  const finalRef = useRef("");
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SR);
    setTtsSupported(typeof window.speechSynthesis !== "undefined");
  }, []);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    // Cancela qualquer TTS em curso pra não captar a própria voz.
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }

    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    finalRef.current = "";
    setInterim("");
    setError(null);

    rec.onresult = (e: any) => {
      let interimText = "";
      let finalText = finalRef.current;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      finalRef.current = finalText;
      setInterim(interimText);
    };
    rec.onerror = (e: any) => {
      const err = e?.error;
      if (err === "not-allowed" || err === "service-not-allowed") setError("permission");
      else if (err === "no-speech" || err === "aborted") setError(null);
      else setError(err || "speech-error");
    };
    rec.onend = () => {
      setListening(false);
      const text = finalRef.current.trim();
      setInterim("");
      if (text) onFinalRef.current?.(text);
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      /* já iniciado — ignora */
    }
  }, [lang]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        const voices = window.speechSynthesis.getVoices();
        const pt = voices.find((v) => v.lang?.toLowerCase().startsWith("pt"));
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
        recRef.current?.abort?.();
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return { supported, ttsSupported, listening, speaking, interim, error, start, stop, speak, cancelSpeak };
}
