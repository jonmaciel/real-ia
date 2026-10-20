"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="section state-box" role="alert">
      <h1>Não foi possível carregar esta página.</h1>
      <p>Tente novamente em instantes.</p>
      <button className="button primary" onClick={reset}>
        Tentar novamente
      </button>
    </section>
  );
}
