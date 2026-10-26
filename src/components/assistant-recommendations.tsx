"use client";
import type { Recommendation } from "@/lib/assistant-contracts";
import { citationUrl } from "@/lib/property-questions";
import { preferenceLabel } from "@/lib/assistant-presentation";
import { isZeroAmount, money, period } from "@/lib/presentation";
import { PropertyCard } from "./properties";
export function AssistantRecommendations({ cards, onSelect }: { cards: Recommendation[]; onSelect: (id: string) => void }) {
  return <div className="assistant-recommendations">{cards.map(card => {
    const url = card.original_url ? citationUrl(card.original_url) : null;
    const pricing = card.pricing;
    return <div className="assistant-recommendation" key={card.id}>
      <PropertyCard property={card} onSelect={onSelect} />
      <div className="recommendation-evidence">
        {pricing && <details><summary>Preço e taxas informados</summary>
          {pricing.gross_amount != null && <p>Preço bruto: {money(pricing.gross_amount, card.currency)}{period(card.price_type)}</p>}
          {pricing.discount_amount != null && <p>Desconto informado: {money(pricing.discount_amount, card.currency)}. Condição: {pricing.discount_condition ?? "não informada"}.</p>}
          {pricing.charges?.filter(charge => !isZeroAmount(charge.amount)).map((charge, i) => <p key={i}>{charge.label ?? "Taxa"}: {money(charge.amount, card.currency)}{charge.amount != null ? period(charge.period) : ""}</p>)}
          {pricing.total_amount != null && <p>Total informado pela origem: {money(pricing.total_amount, card.currency)}{period(pricing.total_period)}{pricing.total_source !== "reported" ? " · origem do total não confirmada" : ""}</p>}
          <small>Não somamos taxas de periodicidades diferentes nem o preço bruto ao líquido.</small>
        </details>}
        {card.match_reasons.length > 0 && <details><summary>Por que corresponde à busca</summary><ul>{card.match_reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul></details>}
        {card.matched_preferences.length > 0 && <p>Preferências com evidência no cadastro: {card.matched_preferences.map(preferenceLabel).join(", ")}.</p>}
        {card.warnings.length > 0 && <div className="recommendation-warnings"><strong>Ressalvas do anúncio</strong><ul>{card.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></div>}
        {url && <a href={url} target="_blank" rel="noopener noreferrer">Consultar anúncio original ↗</a>}
      </div>
    </div>;
  })}</div>;
}
