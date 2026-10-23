import type { Listing } from "@/lib/contracts";
import { propertyFacts } from "@/lib/presentation";
export function PropertyFacts({ property }: { property: Listing }) {
  const facts = propertyFacts(property);
  if (!facts.length) return <p>As características deste imóvel ainda não foram informadas.</p>;
  return (
    <dl className="property-facts" aria-label="Características informadas">
      {facts.map(({ label, value }) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}
