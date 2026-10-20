import Link from "next/link";
export default function NotFound() {
  return (
    <section className="section state-box">
      <h1>Este lugar ainda não está por aqui.</h1>
      <p>O imóvel ou a página não está disponível publicamente.</p>
      <Link className="button primary" href="/buscar">
        Explorar imóveis
      </Link>
    </section>
  );
}
