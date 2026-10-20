import Link from "next/link";
import { ArrowUpRight, House, MapPin, BedDouble, Columns3 } from "lucide-react";
import type { Category, Listing } from "@/lib/contracts";
import {
  features,
  modality,
  money,
  period,
  propertyHref,
} from "@/lib/presentation";
export function PropertyPrice({ property }: { property: Listing }) {
  return (
    <div className="property-price">
      {money(property.price, property.currency)}{" "}
      <small>{period(property.price_type)}</small>
    </div>
  );
}
export function PropertyFeatures({
  property,
  category,
}: {
  property: Listing;
  category?: Category;
}) {
  return (
    <div className="features">
      {features(property, category).map((f, i) => (
        <span key={f}>
          {i === 0 ? <BedDouble size={17} /> : <Columns3 size={17} />} {f}
        </span>
      ))}
    </div>
  );
}
export function PropertyCard({
  property,
  category,
}: {
  property: Listing;
  category?: Category;
}) {
  return (
    <article className="property-card">
      <Link
        href={propertyHref(property)}
        className="card-media"
        aria-label={`Ver ${property.title}`}
      >
        <div className="architecture-lines" aria-hidden="true">
          <House strokeWidth={0.65} size={82} />
        </div>
        <span className="listing-badge">{modality(property.listing_type)}</span>
        <span className="no-photo">Fotografia não disponível</span>
        <span className="card-arrow">
          <ArrowUpRight size={20} />
        </span>
      </Link>
      <div className="card-body">
        <p className="location">
          <MapPin size={14} />
          {[property.neighborhood, property.city].filter(Boolean).join(" · ") ||
            "Localização não informada"}
        </p>
        <h3>
          <Link href={propertyHref(property)}>{property.title}</Link>
        </h3>
        <PropertyFeatures property={property} category={category} />
        <PropertyPrice property={property} />
      </div>
    </article>
  );
}
export function PropertyGrid({
  properties,
  category,
}: {
  properties: Listing[];
  category?: Category;
}) {
  return (
    <div className="property-grid">
      {properties.map((p) => (
        <PropertyCard key={p.id} property={p} category={category} />
      ))}
    </div>
  );
}
export function ErrorState({
  message,
  href = "/buscar",
}: {
  message: string;
  href?: string;
}) {
  return (
    <div className="state-box" role="status">
      <House size={30} />
      <h3>Vamos tentar de novo?</h3>
      <p>{message}</p>
      <Link className="button secondary" href={href}>
        Tentar novamente <ArrowUpRight size={16} />
      </Link>
    </div>
  );
}
export function EmptyState() {
  return (
    <div className="state-box" role="status">
      <SearchIcon />
      <h3>Ainda não encontramos seu lugar.</h3>
      <p>
        Experimente alterar a cidade, o bairro ou a faixa de preço. Seus
        critérios não foram alterados.
      </p>
      <Link href="/buscar" className="button secondary">
        Limpar filtros
      </Link>
    </div>
  );
}
function SearchIcon() {
  return <MapPin size={30} />;
}
