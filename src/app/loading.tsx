export default function Loading() {
  return (
    <div className="section" role="status" aria-label="Carregando">
      <div className="skeleton skeleton-heading" />
      <div className="property-grid">
        {[1, 2, 3].map((i) => (
          <div className="skeleton skeleton-card" key={i} />
        ))}
      </div>
      <span className="sr-only">Carregando imóveis…</span>
    </div>
  );
}
