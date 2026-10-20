const labels: Record<string, string> = {
  reported_area_sqm: "Área informada (m²)",
  usable_area_sqm: "Área útil (m²)",
  built_area_sqm: "Área construída (m²)",
  land_area_sqm: "Área do terreno (m²)",
  total_area_sqm: "Área total (m²)",
  property_type: "Tipo de imóvel",
  bedrooms: "Quartos",
  bathrooms: "Banheiros",
  suites: "Suítes",
  parking_spaces: "Vagas",
  balcony: "Varanda",
  approved_by_id: "ID do administrador",
  approved_at: "Data de aprovação",
  source_listing_id: "ID do anúncio de origem",
  fingerprint: "Versão revisada (fingerprint)",
};
export function ReviewData({
  data,
}: {
  data: Record<string, unknown> | null | undefined;
}) {
  if (!data || !Object.keys(data).length) return <p>Não informado.</p>;
  return (
    <dl className="review-data">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <dt>{labels[key] ?? key.replaceAll("_", " ")}</dt>
          <dd>
            {value == null ? (
              "Não informado"
            ) : typeof value === "boolean" ? (
              value ? (
                "Sim"
              ) : (
                "Não"
              )
            ) : Array.isArray(value) ? (
              <pre>{JSON.stringify(value, null, 2)}</pre>
            ) : typeof value === "object" ? (
              <ReviewData data={value as Record<string, unknown>} />
            ) : (
              String(value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
