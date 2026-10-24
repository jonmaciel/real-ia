"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Star, X } from "lucide-react";
import { AssistantAudio } from "./assistant-audio";
import { PhotoGallery } from "./photo-gallery";
import { ManualResult } from "./manual-result";
import { MAX_IMAGE_BYTES, manualResponse, photoBatches, type ManualPhoto, type ManualSubmission } from "@/lib/manual-contracts";
import { allManualPhotos, manualFetch, ManualClientError } from "@/lib/manual-client";

type LocalPhoto = { key: string; file: File; url: string; uploaded?: boolean };
export function ManualIntake({ initial, bodyLimit, admin }: { initial: ManualSubmission | null; bodyLimit: number; admin: boolean }) {
  const [submission, setSubmission] = useState(initial);
  const [prompt, setPrompt] = useState("");
  const [audio, setAudio] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const audioActive = useCallback((active: boolean) => setRecording(active), []);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [persisted, setPersisted] = useState<ManualPhoto[]>([]);
  const [cover, setCover] = useState("");
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const requestKey = useRef<string | null>(null);
  const locked = useRef(false);
  const previews = useRef(new Set<string>());
  const inFlightBatch = useRef<{ keys: string[]; before: Set<string> } | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const editable = !submission?.listing || submission.listing.status === "draft";
  const collecting = submission?.status !== "processing" && editable;
  const pending = photos.filter(photo => !photo.uploaded);
  useEffect(() => () => { for (const url of previews.current) URL.revokeObjectURL(url); }, []);
  useEffect(() => { if (!initial) return; let active = true; allManualPhotos(initial.id).then(rows => { if (active) setPersisted(rows); }).catch(() => { if (active) setError("Não foi possível carregar todas as fotos. Consulte o progresso para tentar novamente."); }); return () => { active = false; }; }, [initial]);
  useEffect(() => { if (!cooldown) return; const timer = setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000); return () => clearInterval(timer); }, [cooldown]);
  useEffect(() => { if (!pending.length && !audio && !prompt) return; const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [pending.length, audio, prompt]);
  function changed() { requestKey.current = null; }
  async function choose(files: File[]) {
    if (busy || choosing || !collecting) return;
    setChoosing(true);
    const added: LocalPhoto[] = []; const issues: string[] = [];
    for (const file of files) {
      if (!file.size || file.size > MAX_IMAGE_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { issues.push(`${file.name}: use JPEG, PNG ou WebP de até 5 MiB.`); continue; }
      let hash: string;
      try { hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())), n => n.toString(16).padStart(2, "0")).join(""); }
      catch { issues.push(`${file.name}: não foi possível ler o arquivo. Selecione-o novamente.`); continue; }
      if (photos.some(photo => photo.key === hash) || added.some(photo => photo.key === hash)) { issues.push(`${file.name}: esta mesma foto já foi selecionada.`); continue; }
      const url = URL.createObjectURL(file); previews.current.add(url); added.push({ key: hash, file, url });
    }
    setPhotos(previous => [...previous, ...added]);
    if (!cover && !persisted.length && added.length) setCover(added[0].key);
    setError(issues.join(" ")); changed(); setChoosing(false);
  }
  async function readProgress(id: string) {
    const latest = (await manualFetch(`/${id}`, manualResponse, { signal: AbortSignal.timeout(20000) })).data;
    setSubmission(latest); setPersisted(await allManualPhotos(id)); return latest;
  }
  async function run(task: () => Promise<void>) {
    if (locked.current || cooldown) return;
    locked.current = true; setBusy(true); setError("");
    try { await task(); }
    catch (failure) {
      setProgress(currentId.current ? "Processo pausado. Consulte o progresso para retomar." : "Envio não confirmado. Sua entrada foi preservada para tentar novamente.");
      if (failure instanceof ManualClientError) { setCooldown(Math.ceil(failure.wait)); setError(failure.message); }
      else setError(failure instanceof Error && failure.message === "request_too_large" ? "Um arquivo excede o limite de upload desta hospedagem. Ele continua selecionado. Escolha uma versão menor; nenhuma foto foi descartada." : "Não foi possível concluir. Seus anexos foram preservados. Consulte o progresso antes de retomar.");
      const id = currentId.current;
      if (id) await readProgress(id).catch(() => { /* Keep the last confirmed state and the original attachments. */ });
    } finally { setBusy(false); locked.current = false; }
  }
  const currentId = useRef(initial?.id);
  async function uploadAndAnalyze() {
    let row = submission;
    if (!row) {
      if (!prompt.trim() && !audio && !pending.length) { setError("Conte sobre o imóvel, anexe um áudio ou selecione fotos."); return; }
      requestKey.current ??= crypto.randomUUID();
      setProgress(audio ? "Transcrevendo seu áudio…" : "Criando cadastro privado…");
      let body: BodyInit; const headers: Record<string, string> = {};
      if (audio) { const form = new FormData(); form.append("request_key", requestKey.current); form.append("prompt", prompt); form.append("audio", audio); body = form; }
      else { body = JSON.stringify({ request_key: requestKey.current, prompt }); headers["Content-Type"] = "application/json"; }
      row = (await manualFetch("", manualResponse, { method: "POST", headers, body, signal: AbortSignal.timeout(55000) })).data;
      currentId.current = row.id; setSubmission(row); setPrompt(""); setAudio(null);
      window.history.replaceState(null, "", `/anunciar?cadastro=${row.id}`);
    } else row = await readProgress(row.id);
    const batches = row.status === "processing" ? [] : photoBatches(pending.map(photo => ({ ...photo, size: photo.file.size })), bodyLimit, row.limits.images_per_upload);
    for (let index = 0; index < batches.length; index++) {
      const batch = batches[index];
      if (!inFlightBatch.current || inFlightBatch.current.keys.join() !== batch.map(photo => photo.key).join()) inFlightBatch.current = { keys: batch.map(photo => photo.key), before: new Set((await allManualPhotos(row.id)).map(photo => String(photo.id))) };
      setProgress(`Enviando lote ${index + 1} de ${batches.length} · ${batch.length} foto${batch.length > 1 ? "s" : ""}…`);
      const form = new FormData(); batch.forEach(photo => form.append("images[]", photo.file));
      row = (await manualFetch(`/${row.id}/photos`, manualResponse, { method: "POST", body: form })).data; setSubmission(row);
      const uploaded = await allManualPhotos(row.id); setPersisted(uploaded);
      const newRows = uploaded.filter(photo => !inFlightBatch.current!.before.has(String(photo.id))).sort((a, b) => a.position - b.position);
      const coverIndex = batch.findIndex(photo => photo.key === cover);
      if (coverIndex >= 0 && newRows.length === batch.length && newRows[coverIndex]?.hosted_url && String(row.cover_photo_id) !== String(newRows[coverIndex].id)) row = (await manualFetch(`/${row.id}/cover`, manualResponse, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photo_id: String(newRows[coverIndex].id) }) })).data;
      else if (coverIndex >= 0 && newRows.length !== batch.length) setProgress("Fotos salvas. Confira a capa nas fotos enviadas.");
      setPhotos(previous => previous.map(photo => batch.some(item => item.key === photo.key) ? { ...photo, uploaded: true } : photo));
      inFlightBatch.current = null; setSubmission(row);
    }
    // Each successful processing response authorizes only the next unfinished batch.
    // No retries for failed AI calls; quotas/busy/timeouts return control to the user.
    const maxCalls = Math.max(1, Math.ceil((row.uploaded_images_count - row.analyzed_images_count) / row.limits.images_per_analysis) + 1);
    for (let call = 0; row.status !== "ready" && call < maxCalls; call++) {
      setProgress(`Analisando o imóvel… ${row.analyzed_images_count} de ${row.images_count} fotos analisadas.`);
      row = (await manualFetch(`/${row.id}/process`, manualResponse, { method: "POST", signal: AbortSignal.timeout(65000) })).data;
      setSubmission(row);
      if (row.status === "ready") break;
    }
    setPersisted(await allManualPhotos(row.id));
    setProgress(row.status === "ready" ? "Rascunho criado. Aguardando revisão." : "Há mais fotos para analisar. Retome quando quiser.");
  }
  async function photoAction(photo: ManualPhoto, remove = false) {
    if (!submission) return;
    const result = await manualFetch(`/${submission.id}/${remove ? `photos/${photo.id}` : "cover"}`, manualResponse, { method: remove ? "DELETE" : "PATCH", ...(remove ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photo_id: String(photo.id) }) }) });
    setSubmission(result.data); setPersisted(await allManualPhotos(submission.id)); setProgress(remove ? "Foto removida deste cadastro. A retenção do arquivo segue a política do armazenamento." : "Capa atualizada.");
  }
  return <div className="manual-intake">
    <div className="section-heading"><div><span className="eyebrow">UM NOVO ENDEREÇO COMEÇA AQUI</span><h1>Anunciar imóvel</h1><p>Conte do seu jeito. Organizamos os dados para uma revisão humana antes da publicação.</p></div>{submission && <Link href="/anunciar" prefetch={false} className="button secondary" onClick={event => { if (busy || pending.length) { event.preventDefault(); setError("Conclua o envio ou remova os anexos locais antes de iniciar outro cadastro."); } else { setSubmission(null); setPersisted([]); setPhotos([]); setCover(""); setProgress(""); setError(""); requestKey.current = null; currentId.current = undefined; } }}>Novo cadastro</Link>}</div>
    {!submission && <section className="panel manual-composer">
      <label><span>Conte sobre o imóvel</span><textarea rows={5} maxLength={8000} value={prompt} disabled={busy} onChange={event => { setPrompt(event.target.value); changed(); }} placeholder="Ex.: Casa para alugar em Araucária, 3 quartos, R$ 2.000 por mês. Conte também sobre o endereço, taxas e contato." /></label>
      <small>Você pode usar texto, áudio, fotos ou combinar os três. Não precisa preencher tudo agora.</small>
      <p className="fineprint">Enviamos os dados e as fotos à IA para organizar o rascunho. Use apenas fotos, contato e endereço autorizados para publicação. <Link href="/privacidade">Como tratamos seus dados</Link>.</p>
      {!audio ? <AssistantAudio disabled={busy} onActiveChange={audioActive} sendLabel="Usar este áudio" onSend={async file => { setAudio(file); changed(); return true; }} /> : <div className="manual-audio-attached"><p>Áudio anexado: {audio.name} · {Math.ceil(audio.size / 1024)} KiB</p><button type="button" className="text-link" disabled={busy} onClick={() => { setAudio(null); changed(); }}>Remover áudio</button></div>}
    </section>}
    {submission?.transcription && <section className="panel"><h2>Transcrição do áudio</h2><p className="description">{submission.transcription}</p></section>}
    <section className="panel">
      <div className="section-heading"><div><h2>Fotos do imóvel</h2><p>JPEG, PNG ou WebP · até 5 MiB por foto · sem limite de seleção.</p></div><button type="button" className="button secondary" disabled={busy || choosing || !collecting || recording} onClick={() => uploadInput.current?.click()}><ImagePlus size={18} />Adicionar fotos</button></div>
      <input ref={uploadInput} type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Fotos do imóvel" hidden disabled={busy || choosing || !collecting || recording} onChange={event => { void choose(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      {bodyLimit < 5 * 1024 * 1024 && <p className="fineprint">Nesta hospedagem, cada requisição comporta cerca de 4 MiB. Os lotes são menores quando necessário. Fotos maiores permanecem selecionadas, mas precisam de uma versão menor para envio.</p>}
      {choosing && <p role="status">Preparando prévias das fotos…</p>}
      {pending.length > 0 && <><p>{pending.length} foto(s) selecionada(s) para enviar ou confirmar · a capa pode ser escolhida abaixo.</p><div className="manual-photo-grid">{pending.map((photo, index) => <div key={photo.key} className="manual-local-photo">
        {/* Local object URLs only; not sent to an image proxy. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={photo.url} alt={`Prévia ${index + 1}: ${photo.file.name}`} />
        <span>{photo.file.name}</span><div><button type="button" aria-pressed={cover === photo.key} disabled={busy} onClick={() => setCover(photo.key)}><Star size={15} />{cover === photo.key ? "Capa" : "Usar como capa"}</button><button type="button" disabled={busy} aria-label={`Remover da seleção local: ${photo.file.name}`} onClick={() => { setPhotos(previous => previous.filter(item => item.key !== photo.key)); URL.revokeObjectURL(photo.url); previews.current.delete(photo.url); if (cover === photo.key) setCover(""); inFlightBatch.current = null; }}><X size={16} /></button></div>
      </div>)}</div></>}
      {persisted.length > 0 && <><PhotoGallery photos={persisted.map(photo => ({ ...photo, processing_status: photo.hosted_url ? "completed" : "pending" }))} title="Fotos enviadas" /><details><summary>Organizar fotos enviadas ({persisted.length})</summary><ul className="manual-photo-actions">{persisted.map((photo, index) => <li key={photo.id}><span>Foto {index + 1}{photo.is_cover ? " · Capa" : ""}{!photo.hosted_url ? " · Envio pendente" : ""}</span><button className="button secondary" disabled={busy || !collecting || !photo.hosted_url || photo.is_cover} onClick={() => void run(() => photoAction(photo))}>Usar como capa</button><button className="text-link" disabled={busy || submission?.status !== "collecting" || !editable} onClick={() => void run(() => photoAction(photo, true))}>Remover do cadastro</button></li>)}</ul></details></>}
      {!persisted.length && !pending.length && <p>As fotos são opcionais para iniciar. Ao menos uma será necessária para publicar.</p>}
    </section>
    {submission && <section className="manual-progress panel"><h2>Seu cadastro está salvo</h2><p>Guarde o link desta página para retomar com a mesma conta.</p><p>{submission.images_count} fotos cadastradas · {submission.uploaded_images_count} enviadas · {submission.analyzed_images_count} analisadas</p><small>Identificador: {submission.id}</small><button className="text-link" disabled={busy || cooldown > 0} onClick={() => void run(async () => { const latest = await readProgress(submission.id); setProgress(latest.status === "ready" ? "Rascunho criado. Aguardando revisão." : "Progresso consultado. Você pode retomar o cadastro."); })}>Consultar progresso</button></section>}
    <div className="manual-submit">{!(submission?.status === "ready" && !pending.length) && <button className="button primary" disabled={busy || choosing || recording || cooldown > 0 || !editable || (submission?.status === "ready" && !pending.length)} onClick={() => void run(uploadAndAnalyze)}>{busy ? <><LoaderCircle className="spin" size={18} />{progress || "Aguarde…"}</> : cooldown ? `Aguarde ${cooldown} s` : submission ? submission.status === "processing" ? "Retomar análise" : pending.length ? "Enviar fotos e analisar" : "Retomar análise" : "Organizar meu anúncio"}</button>}<small>O anúncio passa por revisão antes de aparecer na busca.</small></div>
    <p aria-live="polite" role="status">{progress}</p>
    {error && <p className="form-error" role="alert">{error}{error.includes("sessão") && <> <Link href="/auth/login">Entrar novamente</Link></>}</p>}
    {submission && <><ManualResult submission={submission} />{submission.status === "ready" && <section className="panel"><h2>{submission.listing?.status === "published" ? "Anúncio publicado após revisão" : submission.listing?.status === "rejected" ? "Anúncio rejeitado na revisão" : "Rascunho criado. Aguardando revisão."}</h2><p>Somente um administrador pode corrigir, aprovar e publicar este anúncio.</p>{admin && submission.listing && <Link className="button secondary" href={`/admin/anuncios/${encodeURIComponent(String(submission.listing.id))}`}>Ir para revisão</Link>}</section>}</>}
  </div>;
}
