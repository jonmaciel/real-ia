"use client";
import { useEffect, useRef, useState } from "react";

const BAR_COUNT = 20;

/** Local signal analysis only: never connects the microphone to speakers. */
export function AudioLevelMeter({ stream }: { stream: MediaStream }) {
  const bars = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let context: AudioContext | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    let analyser: AnalyserNode | undefined;
    let frame = 0;
    let disposed = false;
    function cleanup() {
      disposed = true; cancelAnimationFrame(frame);
      source?.disconnect(); analyser?.disconnect();
      if (context && context.state !== "closed") void context.close().catch(() => {});
    }
    async function start() {
      try {
        context = new AudioContext();
        source = context.createMediaStreamSource(stream);
        analyser = context.createAnalyser(); analyser.fftSize = 512;
        source.connect(analyser);
        if (context.state === "suspended") await context.resume();
        if (disposed) return;
        const samples = new Uint8Array(analyser.fftSize);
        const elements = Array.from(bars.current?.children ?? []) as HTMLElement[];
        let previous = 0;
        function draw(now: number) {
          if (disposed) return;
          // 12 samples/s, no React rerenders and no decorative/random animation.
          if (now - previous >= 80 && analyser) {
            previous = now; analyser.getByteTimeDomainData(samples);
            elements.forEach((bar, index) => {
              const from = Math.floor(index * samples.length / BAR_COUNT);
              const to = Math.floor((index + 1) * samples.length / BAR_COUNT);
              let sum = 0;
              for (let i = from; i < to; i++) sum += ((samples[i] - 128) / 128) ** 2;
              bar.style.transform = `scaleY(${Math.max(.12, Math.min(1, Math.sqrt(sum / (to - from)) * 4))})`;
            });
          }
          frame = requestAnimationFrame(draw);
        }
        frame = requestAnimationFrame(draw);
      } catch { if (!disposed) setUnavailable(true); cleanup(); }
    }
    void start();
    return cleanup;
  }, [stream]);
  return <div className="audio-level-meter">
    <div ref={bars} className="audio-level-bars" role="img" aria-label={unavailable ? "Visualização de volume indisponível" : "Nível de áudio do microfone"}>
      {Array.from({ length: BAR_COUNT }, (_, index) => <span key={index} />)}
    </div>
    <small>{unavailable ? "Gravação em andamento; visualização de volume indisponível." : "As barras acompanham o som do microfone."}</small>
  </div>;
}
