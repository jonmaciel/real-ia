import Link from "next/link";
import type { MouseEvent } from "react";
import { PropertyCover } from "./property-cover";
import { ArrowRight, ArrowUpRight, House, MapPin, BedDouble, Columns3 } from "lucide-react";
import type { Category, Listing } from "@/lib/contracts";
import {
  availability,
  features,
  modality,
  money,
  period,
  propertyHref,
} from "@/lib/presentation";
export function PropertyPrice({ property }: { property: Omit<Listing, "category_id"> }) {
  return (
    <div className="property-price">
      {money(property.price, property.currency)}{" "}
      <small>{property.price != null ? period(property.price_type) : ""}</small>
    </div>
  );
}
export function PropertyFeatures({
  property,
  category,
}: {
  property: Omit<Listing, "category_id">;
  category?: Category;
}) {
  return (
    <div className="features">
      {features(property, category).map((f) => (
        <span key={f}>
          {f.includes("quarto") ? (
            <BedDouble size={17} />
          ) : (
            <Columns3 size={17} />
          )}{" "}
          {f}
        </span>
      ))}
    </div>
  );
}
export function PropertyCard({
  property,
  category,
  onSelect,
}: {
  property: Omit<Listing, "category_id">;
  category?: Category;
  onSelect?: (id: string) => void;
}) {
  function choose(event: MouseEvent<HTMLAnchorElement>) {
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) onSelect?.(String(property.id));
  }
  return (
    <article className="property-card">
      <Link
        href={propertyHref(property)} onClick={onSelect ? choose : undefined}
        className="card-media"
        aria-label={`Ver ${property.title}`}
      >
        <PropertyCover src={property.cover_url} alt={property.title} />
        <span className="listing-badge">{modality(property.listing_type)}</span>
        <span className="card-arrow">
          <ArrowUpRight size={20} />
        </span>
      </Link>
      <div className="card-body">
        <PropertyPrice property={property} />
        <p className="location">
          <MapPin size={14} />
          {[property.neighborhood, property.city].filter(Boolean).join(" · ") ||
            "Localização não informada"}
        </p>
        <h3>
          <Link href={propertyHref(property)} onClick={onSelect ? choose : undefined}>{property.title}</Link>
        </h3>
        <PropertyFeatures property={property} category={category} />
        <div className="card-footer">
          <p className="property-availability">{availability(property.availability)}</p>
          <Link className="card-detail-link" href={propertyHref(property)} onClick={onSelect ? choose : undefined}>Ver imóvel <ArrowRight size={16} /></Link>
        </div>
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
