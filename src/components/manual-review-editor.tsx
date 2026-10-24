"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { candidateSchema, chargePeriods, countKeys, amountKeys, featureKeys, fieldLabels, optionLabels, propertyTypes, manualError, type Candidate } from "@/lib/manual-contracts";
import type { AdminDetail } from "@/lib/admin-contracts";
import { ManualMissing } from "./manual-result";

const numeric = new Set<string>([...countKeys, ...amountKeys, "price", "latitude", "longitude", "base_amount", "gross_amount", "discount_amount", "total_amount", "amount"]);
const choices: Record<string, readonly string[]> = { listing_type: ["sale", "rental"], property_type: propertyTypes, price_type: ["fixed", "monthly", "yearly", "on_request"], total_period: chargePeriods, period: chargePeriods };
export function ManualReviewEditor({ listing, disabled, onDirty, onSaved, onSaving }: { listing: AdminDetail; disabled: boolean; onDirty: (value: boolean) => void; onSaved: (message: string) => Promise<unknown>; onSaving: (value: boolean) => void }) {
  const router = useRouter();
  const parsed = candidateSchema.safeParse(listing.manual_intake?.extraction);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [charges, setCharges] = useState(() => parsed.success ? parsed.data.pricing.charges.map((charge, i) => ({ ...charge, localId: `original-${i}` })) : []);
  if (!parsed.success) return <p role="alert">A extração não está disponível para edição. Atualize o detalhe após concluir a análise.</p>;
  const original = parsed.data;
  const editable = listing.status === "draft" && listing.manual_intake?.status === "ready";
  const blocked = disabled || saving || !editable;
  function readCharges(form: HTMLFormElement) {
    const values = new FormData(form);
    return charges.map((charge, i) => ({ localId: charge.localId, code: String(values.get(`charge.${i}.code`) ?? ""), label: String(values.get(`charge.${i}.label`) ?? ""), amount: values.get(`charge.${i}.amount`) === "" ? null : Number(values.get(`charge.${i}.amount`)), period: String(values.get(`charge.${i}.period`) ?? "unknown") as typeof chargePeriods[number] }));
  }
  function control(key: string, value: unknown, prefix = "") {
    const name = prefix ? `${prefix}.${key}` : key;
    const invalid = listing.missing_fields?.includes(key) || (prefix === "contact" && listing.missing_fields?.includes("contact")) || (prefix === "address" && listing.missing_fields?.includes("location"));
    const input = { name, disabled: blocked, "aria-invalid": invalid || undefined };
    return <label key={name}><span>{fieldLabels[key] ?? key}</span>{featureKeys.includes(key as typeof featureKeys[number]) ? <select {...input} defaultValue={value === null ? "" : String(value)}><option value="">Não informado</option><option value="true">Sim</option><option value="false">Não</option></select> : choices[key] ? <select {...input} defaultValue={String(value ?? "")}><option value="">Não informado</option>{choices[key].map(option => <option key={option} value={option}>{optionLabels[option] ?? option}</option>)}</select> : key === "description" ? <textarea {...input} defaultValue={String(value ?? "")} maxLength={5000} rows={5} /> : <input {...input} defaultValue={String(value ?? "")} type={numeric.has(key) ? "number" : "text"} step={countKeys.includes(key as typeof countKeys[number]) ? "1" : "any"} maxLength={key === "title" ? 300 : key.includes("url") || key === "website" ? 2000 : key === "currency" ? 3 : 254} placeholder="Não informado" />}</label>;
  }
  async function save(form: HTMLFormElement) {
    if (blocked || !listing.sources[0]?.fingerprint) return;
    setSaving(true); onSaving(true); setError("");
    try {
      // Start with the entire extraction. Nested fields replace the complete object upstream.
      const next = structuredClone(original);
      const values = new FormData(form);
      for (const [name, raw] of values) {
        const parts = name.split("."); if (parts.length > 2) continue;
        const key = parts.at(-1)!; const value = String(raw);
        const converted = value === "" ? null : numeric.has(key) ? Number(value) : featureKeys.includes(key as typeof featureKeys[number]) ? value === "true" : value;
        if (parts.length === 1) (next as Record<string, unknown>)[key] = converted;
        else (next[parts[0] as keyof Candidate] as Record<string, unknown>)[key] = converted;
      }
      next.pricing.charges = readCharges(form).map(({ code, label, amount, period }) => ({ code, label, amount, period }));
      const validated = candidateSchema.safeParse(next);
      if (!validated.success) { setError("Confira os limites dos campos. Valores desconhecidos devem ficar em branco; contagens devem ser inteiras."); return; }
      const response = await fetch(`/api/admin/anuncios/${listing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fingerprint: listing.sources[0].fingerprint, fields: validated.data }), signal: AbortSignal.timeout(25000) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) await onSaved(manualError(response.status, result.code));
        else if (response.status === 401) router.push("/api/session-expired");
        else setError(manualError(response.status, result.code));
        return;
      }
      await onSaved("Correções salvas. Confira a nova versão e confirme a revisão antes de publicar.");
    } catch { await onSaved("Não foi possível confirmar o salvamento. Confira a versão atual antes de tentar novamente."); }
    finally { setSaving(false); onSaving(false); }
  }
  return <section className="panel manual-editor"><h2>Revisar cadastro manual</h2><ManualMissing fields={listing.missing_fields ?? []} />
    {!editable && <p>{listing.status === "rejected" ? "Reabra o anúncio para corrigir os dados." : "Edição disponível apenas para rascunhos com análise concluída. Anúncios publicados são somente leitura."}</p>}
    <form onChange={() => onDirty(true)} onSubmit={event => { event.preventDefault(); void save(event.currentTarget); }}>
      <fieldset disabled={blocked}><legend>Imóvel e preço</legend><div className="manual-field-grid">{["title", "description", "listing_type", "property_type", "price", "currency", "price_type"].map(key => control(key, original[key as keyof Candidate]))}</div></fieldset>
      <fieldset disabled={blocked}><legend>Localização publicada</legend><p>Informe apenas endereço e coordenadas autorizados para publicação.</p><div className="manual-field-grid">{["city", "neighborhood", "region", "country", "latitude", "longitude"].map(key => control(key, original[key as keyof Candidate]))}{Object.entries(original.address).map(([key, value]) => control(key, value, "address"))}</div></fieldset>
      <fieldset disabled={blocked}><legend>Contato público do anunciante</legend><div className="manual-field-grid">{Object.entries(original.contact).map(([key, value]) => control(key, value, "contact"))}</div></fieldset>
      <fieldset disabled={blocked}><legend>Valores e cobranças</legend><p>Não reconstrua totais. Preserve a periodicidade de cada taxa e as condições de desconto.</p><div className="manual-field-grid">{Object.entries(original.pricing).filter(([key]) => key !== "charges").map(([key, value]) => control(key, value, "pricing"))}</div>
        {charges.map((charge, i) => <div className="manual-charge" key={charge.localId}><div className="manual-field-grid">{["code", "label", "amount", "period"].map(key => control(key, charge[key as keyof typeof charge], `charge.${i}`))}</div><button type="button" className="text-link" disabled={blocked} onClick={event => { setCharges(readCharges(event.currentTarget.form!).filter(item => item.localId !== charge.localId)); onDirty(true); }}>Remover taxa</button></div>)}
        <button type="button" className="button secondary" disabled={blocked || charges.length >= 30} onClick={event => { setCharges([...readCharges(event.currentTarget.form!), { localId: crypto.randomUUID(), code: "", label: "", amount: null, period: "unknown" }]); onDirty(true); }}>Adicionar taxa</button>
      </fieldset>
      <details><summary>Características do imóvel</summary><div className="manual-field-grid">{Object.entries(original.attributes).map(([key, value]) => control(key, value, "attributes"))}</div></details>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button primary" type="submit" disabled={blocked}>{saving ? "Salvando…" : "Salvar correções"}</button>
    </form>
  </section>;
}
