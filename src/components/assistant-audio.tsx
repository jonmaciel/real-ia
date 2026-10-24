"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Mic, Paperclip, Square, X } from "lucide-react";
import { AUDIO_ACCEPT, MAX_AUDIO_BYTES, MAX_RECORDING_MS, audioErrorMessage, audioFileError } from "@/lib/assistant-audio";
import { flags } from "@/lib/presentation";
type Stage = "idle" | "permission" | "recording" | "finishing" | "ready" | "sending";
type Props = { disabled: boolean; active?: boolean; onActiveChange: (active: boolean) => void; onSend: (audio: File) => Promise<boolean> };
export function AssistantAudio(props: Props) { return flags.voiceSearch && props.active !== false ? <AudioControls {...props} /> : null; }
function AudioControls({ disabled, onActiveChange, onSend }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const generation = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewRef = useRef("");
  const upload = useRef<HTMLInputElement>(null);
  const id = useId();
  const release = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (ticker.current) clearInterval(ticker.current);
    timer.current = null; ticker.current = null;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    recorder.current = null;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
  }, []);
  const discard = useCallback(() => {
    generation.current++; release();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = ""; setPreview(""); setFile(null); setStage("idle"); setError(""); setSeconds(0); onActiveChange(false);
  }, [release, onActiveChange]);
  useEffect(() => () => {
    generation.current++; release();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    onActiveChange(false);
  }, [release, onActiveChange]);
  function choose(file: File) {
    const invalid = audioFileError(file);
    if (invalid) { discard(); setError(audioErrorMessage(invalid.code)!); return; }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = URL.createObjectURL(file); setPreview(previewRef.current); setFile(file); setStage("ready"); setError(""); onActiveChange(true);
  }
  async function start() {
    if (disabled || stage !== "idle") return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
      setError("A gravação não está disponível neste navegador. Anexe um áudio ou digite sua mensagem."); return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) { setError("Não há formato de gravação compatível. Anexe um áudio ou digite sua mensagem."); return; }
    const version = ++generation.current;
    setStage("permission"); onActiveChange(true);
    try {
      const captured = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (version !== generation.current) { captured.getTracks().forEach(track => track.stop()); return; }
      stream.current = captured;
      const recording = new MediaRecorder(captured, { mimeType: mime, audioBitsPerSecond: 64000 });
      recorder.current = recording;
      const chunks: Blob[] = []; let size = 0;
      recording.ondataavailable = event => {
        if (version !== generation.current || !event.data.size) return;
        size += event.data.size;
        if (size > MAX_AUDIO_BYTES) { discard(); setError(audioErrorMessage("audio_too_large")!); return; }
        chunks.push(event.data);
      };
      recording.onerror = () => { if (version === generation.current) { discard(); setError("A gravação foi interrompida. Grave novamente, anexe um áudio ou digite sua mensagem."); } };
      recording.onstop = () => {
        if (version !== generation.current) return;
        release();
        const type = recording.mimeType || mime;
        choose(new File(chunks, type.includes("mp4") ? "mensagem.m4a" : "mensagem.webm", { type }));
      };
      recording.start(1000); setStage("recording"); setSeconds(0);
      ticker.current = setInterval(() => setSeconds(value => value + 1), 1000);
      timer.current = setTimeout(() => { if (version === generation.current) { setStage("finishing"); release(); } }, MAX_RECORDING_MS);
    } catch (cause) {
      if (version !== generation.current) return;
      discard();
      setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? "O acesso ao microfone não foi permitido. Você pode anexar um áudio ou digitar sua mensagem." : "Não foi possível acessar o microfone. Anexe um áudio ou digite sua mensagem.");
    }
  }
  async function send() {
    if (!file || disabled || stage !== "ready") return;
    const version = generation.current;
    setStage("sending");
    try {
      const sent = await onSend(file);
      if (version !== generation.current) return;
      if (sent) discard(); else setStage("ready");
    } catch { if (version === generation.current) { setStage("ready"); setError("Não foi possível enviar o áudio. Tente novamente ou digite sua mensagem."); } }
  }
  return <div className="assistant-audio">
    <input ref={upload} type="file" accept={AUDIO_ACCEPT} hidden disabled={disabled || stage !== "idle"} aria-label="Arquivo de áudio" onChange={event => {
      const selected = event.target.files?.[0]; event.target.value = ""; if (selected && !disabled && stage === "idle") choose(selected);
    }} />
    {stage === "idle" ? <div className="assistant-audio-actions">
      <button type="button" disabled={disabled} onClick={() => void start()}><Mic size={18} aria-hidden="true" />Gravar áudio</button>
      <button type="button" disabled={disabled} onClick={() => upload.current?.click()}><Paperclip size={18} aria-hidden="true" />Anexar áudio</button>
      <small>Até 4 MiB · gravação de até 60 s</small>
    </div> : <div className="assistant-audio-preview">
      {stage === "permission" ? <p role="status">Aguardando permissão para usar o microfone…</p>
        : stage === "recording" ? <p role="timer" aria-live="off">Gravando · {String(Math.min(seconds, 60)).padStart(2, "0")} s / 60 s</p>
        : stage === "finishing" ? <p role="status">Preparando áudio…</p>
        : <><p id={`${id}-file`}>{file?.name} · {Math.ceil((file?.size ?? 0) / 1024)} KiB</p><audio controls preload="metadata" src={preview} aria-label="Ouvir áudio antes de enviar" /></>}
      <div className="assistant-audio-actions">
        {stage === "recording" && <button type="button" onClick={() => { setStage("finishing"); release(); }}><Square size={16} aria-hidden="true" />Parar gravação</button>}
        {stage !== "sending" && <button type="button" onClick={discard}><X size={16} aria-hidden="true" />{stage === "ready" ? "Descartar áudio" : "Cancelar gravação"}</button>}
        {(stage === "ready" || stage === "sending") && <button type="button" className="button primary" disabled={disabled || stage === "sending"} onClick={() => void send()}>{stage === "sending" ? "Enviando áudio…" : "Enviar áudio"}</button>}
      </div>
    </div>}
    {error && <p className="assistant-audio-error" role="alert">{error}</p>}
  </div>;
}
