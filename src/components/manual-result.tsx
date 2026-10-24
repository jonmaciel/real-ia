import { candidateSchema, fieldLabels, missingLabels, optionLabels, type ManualSubmission } from "@/lib/manual-contracts";
import { money } from "@/lib/presentation";

export function ManualResult({ submission }: { submission: ManualSubmission }) {
  const parsed = candidateSchema.safeParse(submission.extraction);
  if (!parsed.success) return null;
  const data = parsed.data;
  return <section className="panel manual-result" aria-label="Resumo extraído">
    <span className="eyebrow">CONFIRA O QUE FOI INFORMADO</span>
    <h2>{data.title || "Imóvel sem título informado"}</h2>
    <p>{[data.neighborhood, data.city, data.region].filter(Boolean).join(" · ") || "Localização não informada"}</p>
    <p>{optionLabels[data.listing_type ?? ""] ?? "Finalidade não informada"} · {optionLabels[data.property_type ?? ""] ?? "Tipo não informado"}</p>
    <p className="property-price">{money(data.price === null ? null : String(data.price), data.currency)} {data.price !== null && data.price_type ? optionLabels[data.price_type] : ""}</p>
    <p className="description">{data.description || "Descrição não informada."}</p>
    <dl className="manual-summary">{Object.entries(data.attributes).filter(([, value]) => value !== null).map(([key, value]) => <div key={key}><dt>{fieldLabels[key] ?? key}</dt><dd>{typeof value === "boolean" ? value ? "Sim" : "Não" : typeof value === "number" ? value.toLocaleString("pt-BR") : String(value)}</dd></div>)}</dl>
    <dl className="manual-summary">
      {(["base_amount", "gross_amount", "discount_amount", "total_amount"] as const).filter(key => key === "base_amount" || key === "total_amount" || data.pricing[key] !== null).map(key => <div key={key}><dt>{fieldLabels[key]}</dt><dd>{data.pricing[key] === null ? "Não informado" : money(String(data.pricing[key]), data.currency)}{key === "total_amount" && data.pricing.total_amount !== null ? ` · ${optionLabels[data.pricing.total_period ?? "unknown"]}` : ""}</dd></div>)}
      {data.pricing.discount_condition && <div><dt>Condição do desconto</dt><dd>{data.pricing.discount_condition}</dd></div>}
      {data.pricing.charges.map((charge, index) => <div key={index}><dt>{charge.label}</dt><dd>{money(charge.amount === null ? null : String(charge.amount), data.currency)} · {optionLabels[charge.period]}</dd></div>)}
    </dl>
    <p className="fineprint">Valores e períodos informados, sem somar cobranças de períodos diferentes. Disponibilidade não confirmada. A análise não publica o anúncio.</p>
    {data.warnings.length > 0 && <><h3>Pontos para conferir</h3><ul>{data.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></>}
    <ManualMissing fields={submission.missing_fields} />
  </section>;
}
export function ManualMissing({ fields }: { fields: string[] }) {
  return fields.length ? <div className="manual-missing" role="status"><h3>Falta completar para publicar</h3><ul>{fields.map(field => <li key={field}>{missingLabels[field] ?? field}</li>)}</ul><p>Um administrador precisa conferir e completar os dados na revisão.</p></div> : null;
}
