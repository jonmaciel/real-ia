"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { adminPreviewsSchema, type AdminPreview } from "@/lib/admin-previews";
import { adminError } from "@/lib/admin-contracts";
import { PropertyCover } from "./property-cover";
type Load = (id: string, signal: AbortSignal) => Promise<AdminPreview[]>;
class PreviewError extends Error {}
const PreviewContext = createContext<Load | null>(null);
export function AdminPreviewProvider({ children }: { children: ReactNode }) {
  const jobs = useRef<(() => Promise<void>)[]>([]);
  const active = useRef(0);
  const controllers = useRef(new Set<AbortController>());
  const pump = useCallback(function drain() {
    while (active.current < 2 && jobs.current.length) {
      const job = jobs.current.shift()!; active.current++;
      void job().finally(() => { active.current--; drain(); });
    }
  }, []);
  const load = useCallback<Load>((id, signal) => new Promise((resolve, reject) => {
    const controller = new AbortController(); controllers.current.add(controller);
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) controller.abort();
    jobs.current.push(async () => {
      try {
        controller.signal.throwIfAborted();
        const response = await fetch(`/api/admin/anuncios/${encodeURIComponent(id)}/previews`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
        if (!response.ok) throw new PreviewError(adminError(response.status));
        resolve(adminPreviewsSchema.parse(await response.json()).data);
      } catch (error) { reject(error); }
      finally { signal.removeEventListener("abort", abort); controllers.current.delete(controller); }
    });
    pump();
  }), [pump]);
  useEffect(() => {
    const pending = controllers.current;
    return () => { for (const controller of pending) controller.abort(); };
  }, []);
  return <PreviewContext.Provider value={load}>{children}</PreviewContext.Provider>;
}
export function AdminListingPreviews({ id, title }: { id: string; title: string }) {
  const load = useContext(PreviewContext);
  const element = useRef<HTMLDivElement>(null);
  const [photos, setPhotos] = useState<AdminPreview[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!load || !element.current) return;
    const controller = new AbortController();
    let started = false;
    const start = () => {
      if (controller.signal.aborted || started) return;
      started = true;
      void load(id, controller.signal).then(data => { if (!controller.signal.aborted) setPhotos(data); })
        .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof PreviewError ? cause.message : "Prévia indisponível. Abra a revisão para consultar as fotos."); });
    };
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver === "undefined") queueMicrotask(start);
    else { observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer!.disconnect(); start(); } }); observer.observe(element.current); }
    return () => { observer?.disconnect(); controller.abort(); };
  }, [id, load, attempt]);
  const href = `/admin/anuncios/${encodeURIComponent(id)}`;
  return <div ref={element} className="admin-listing-previews" aria-label={`Prévia de fotos — ${title}`}>
    {error ? <div className="admin-preview-empty"><p>{error}</p><button className="text-link" type="button" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Tentar carregar fotos</button></div>
      : photos === null ? <div className="admin-preview-grid" aria-label="Carregando prévias">{[0, 1, 2].map(key => <div className="skeleton admin-preview-photo" key={key} />)}</div>
      : !photos.length ? <div className="admin-preview-empty"><PropertyCover alt={title} /><span>Nenhuma foto processada disponível</span></div>
      : <div className="admin-preview-grid" style={{ gridTemplateColumns: `repeat(${photos.length}, minmax(0, 1fr))` }}>{photos.map((photo, index) => <figure key={photo.id}>
        <Link className="admin-preview-photo" href={href} prefetch={false} aria-label={`Revisar ${title} — foto ${index + 1}`}><PropertyCover src={photo.url} alt={`Prévia ${index + 1} — ${title}`} /></Link>
        {photo.attribution && <figcaption>{photo.attribution}</figcaption>}
      </figure>)}</div>}
  </div>;
}
