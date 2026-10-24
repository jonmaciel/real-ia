import type { Listing } from "@/lib/contracts";
import { money, period } from "@/lib/presentation";

type CostProperty = Pick<Listing, "price" | "price_type" | "currency" | "listing_type" | "pricing">;
const chargeLabels: Record<string, string> = {
  condominium: "Condomínio", property_tax: "IPTU", fire_insurance: "Seguro incêndio",
  cleaning: "Taxa de limpeza", other_recurring: "Outras cobranças recorrentes",
};
function costPeriod(value: string | null | undefined) {
  return !value || value === "unknown" ? " · periodicidade não informada" : period(value);
}

/** Reproduces source amounts; never sums fees, prorates periods or infers a total. */
export function PropertyCosts({ property }: { property: CostProperty }) {
  const pricing = property.pricing;
  const charges = pricing?.charges ?? [];
  const hasDiscount = pricing?.discount_amount != null;
  const hasGross = pricing?.gross_amount != null;
  const hasTotal = pricing?.total_amount != null;
  const base = pricing?.base_amount ?? property.price;
  const isRental = property.listing_type === "rental";
  function amount(value: string | null | undefined, frequency: string | null | undefined) {
    return value == null ? "Não informado" : <>{money(value, property.currency ?? null)}<small>{costPeriod(frequency)}</small></>;
  }
  return <section className="property-costs" aria-label="Composição do preço">
    {(hasGross || hasDiscount || charges.length > 0) && <>
      <h3>Preço e taxas</h3>
      <dl className="cost-breakdown">
        {hasGross && <div><dt>{isRental ? "Aluguel bruto" : "Preço bruto"}</dt><dd>{amount(pricing.gross_amount, property.price_type)}</dd></div>}
        {hasDiscount && <div className="cost-discount"><dt>Desconto condicionado</dt><dd>{amount(pricing.discount_amount, property.price_type)}</dd></div>}
        {(hasGross || hasDiscount) && <div><dt>{isRental ? hasDiscount ? "Aluguel com desconto" : "Aluguel anunciado" : "Preço anunciado"}</dt><dd>{amount(base, property.price_type)}</dd></div>}
        {charges.map((charge, index) => <div key={`${charge.code ?? "charge"}-${index}`}><dt>{charge.label?.trim() || chargeLabels[charge.code ?? ""] || "Taxa adicional"}</dt><dd>{amount(charge.amount, charge.period)}</dd></div>)}
      </dl>
    </>}
    {(hasDiscount || pricing?.discount_condition) && <p className="cost-condition">Condição do desconto: {pricing?.discount_condition?.trim() || "não informada; confirme com o anunciante"}.</p>}
    <div className="cost-total">
      <span>{hasTotal ? pricing.total_source === "reported" ? "Total informado pela origem" : "Total informado" : "Total não informado"}</span>
      {hasTotal && <strong>{amount(pricing.total_amount, pricing.total_period)}</strong>}
    </div>
    <p className="cost-note">{hasTotal
      ? "Total reproduzido da origem, sem somar as taxas novamente. Confirme as condições e quais despesas estão incluídas."
      : charges.length ? "O anunciante não informou um total. As cobranças mantêm suas periodicidades e não são somadas pelo Morada."
        : "Taxas adicionais e total não informados. O preço anunciado pode não incluir todas as despesas."}</p>
    {hasTotal && pricing.total_source !== "reported" && <p className="cost-note">A origem deste total não foi confirmada.</p>}
    {!isRental && charges.length > 0 && <p className="cost-note">Condomínio e tributos são despesas separadas do preço de compra.</p>}
    <p className="cost-note">Confirme preço e disponibilidade com o anunciante.</p>
  </section>;
}
