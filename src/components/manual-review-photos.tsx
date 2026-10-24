"use client";
import { useState } from "react";
import { PhotoGallery } from "./photo-gallery";
import { allManualPhotos } from "@/lib/manual-client";
import type { AdminDetail } from "@/lib/admin-contracts";
export function ManualReviewPhotos({ listing }: { listing: AdminDetail }) {
  const [photos, setPhotos] = useState(listing.media ?? []);
  const [more, setMore] = useState(!!listing.media_has_more);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <><PhotoGallery photos={photos} title={listing.title} />{more && listing.manual_intake && <button className="button secondary" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { const all = await allManualPhotos(listing.manual_intake!.public_id); setPhotos(all.map(photo => ({ ...photo, processing_status: photo.hosted_url ? "completed" : "pending", attribution: "Foto enviada pelo anunciante" }))); setMore(false); } catch { setError("Não foi possível carregar as demais fotos. As fotos já carregadas foram preservadas."); } finally { setBusy(false); } }}>{busy ? "Carregando fotos…" : "Carregar todas as fotos"}</button>}{error && <p role="alert" className="form-error">{error}</p>}</>;
}
