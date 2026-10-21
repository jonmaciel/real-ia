import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Layers3, MapPin, ShieldCheck, House, KeyRound } from "lucide-react";
import { ConventionalSearchBar } from "@/components/search-form";
import { PropertyGrid, ErrorState } from "@/components/properties";
import { errorMessage, search, realEstateCategory } from "@/lib/api";
import { parseFilters } from "@/lib/filters";
export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };
export default async function Home() {
  let result;
  let category;
  let error;
  try {
    [result, category] = await Promise.all([
      search(parseFilters({ per_page: "3" })), realEstateCategory(),
    ]);
  } catch (e) { error = errorMessage(e); }
  const cities = [...new Set(result?.data.flatMap((p) => p.city ? [p.city] : []) ?? [])];
  return (
    <>
      <section className="portal-hero" aria-labelledby="home-title">
        <Image className="portal-hero-image" src="/images/morada-home.webp" fill sizes="100vw" priority alt="" />
        <div className="portal-hero-content">
          <span className="hero-kicker">SEU NOVO ENDEREÇO COMEÇA AQUI</span>
          <h1 id="home-title">Encontre um lugar<br />para chamar de seu.</h1>
          <p>Comprar ou alugar. Explore as possibilidades e encontre sua próxima morada.</p>
          <section className="hero-search" aria-label="Busca de imóveis">
            <ConventionalSearchBar />
          </section>
        </div>
        <small className="hero-image-credit">Ambientação ilustrativa gerada por IA · não é um anúncio</small>
      </section>
      <div className="trust-strip">
        <span><Layers3 size={20} /> Anúncios e fontes em um só lugar</span>
        <span><ShieldCheck size={20} /> Informações claras para decidir</span>
        <span><MapPin size={20} /> Conheça o imóvel e a região</span>
      </div>
      <section className="section recent">
        <div className="section-heading">
          <div><span className="eyebrow">ACABARAM DE CHEGAR</span><h2>Novos lugares, novas possibilidades</h2><p>Conheça os imóveis publicados recentemente.</p></div>
          <Link href="/buscar" className="text-link">Ver todos os imóveis <ArrowRight size={18} /></Link>
        </div>
        {error ? <ErrorState message={error} href="/" /> : result?.data.length ? <PropertyGrid properties={result.data} category={category} /> : <p className="state-box">Ainda não há imóveis publicados nesta categoria.</p>}
      </section>
      <section className="section home-paths" aria-labelledby="paths-title">
        <div className="section-heading"><div><h2 id="paths-title">O próximo passo é seu</h2><p>Comece pelo que faz sentido para o seu momento.</p></div></div>
        <div className="home-path-grid">
          <Link className="home-path" href="/buscar?listing_type=sale"><span className="path-icon"><House size={28} /></span><div><h3>Encontre seu imóvel para comprar</h3><p>Um novo endereço para seus planos.</p><span className="path-action">Explorar imóveis à venda <ArrowRight size={18} /></span></div></Link>
          <Link className="home-path" href="/buscar?listing_type=rental"><span className="path-icon"><KeyRound size={28} /></span><div><h3>Descubra seu próximo aluguel</h3><p>Mais liberdade para o seu novo começo.</p><span className="path-action">Explorar imóveis para alugar <ArrowRight size={18} /></span></div></Link>
        </div>
      </section>
      {cities.length > 0 && <section className="section city-section"><div className="section-heading"><div><h2>Onde você quer morar?</h2><p>Explore as cidades presentes na seleção mais recente.</p></div></div><div className="city-links">{cities.map((city) => <Link key={city} href={`/buscar?city=${encodeURIComponent(city)}`}><MapPin size={22} /><span>Imóveis em <strong>{city}</strong></span><ArrowUpRight size={20} /></Link>)}</div></section>}
      <section className="home-explainer" id="como-funciona">
        <div className="section"><div className="section-heading"><div><span className="eyebrow">ESSE É O JEITO MORADA</span><h2>Mais contexto. Uma escolha melhor.</h2><p>Da primeira busca ao anúncio original, você mantém o controle.</p></div></div>
          <div className="benefit-grid">
            <article><span className="benefit-icon"><House size={26} /></span><h3>Busque do seu jeito</h3><p>Escolha a cidade, a modalidade e o preço. Seus critérios guiam a busca.</p></article>
            <article><span className="benefit-icon"><MapPin size={26} /></span><h3>Enxergue além das fotos</h3><p>Veja os detalhes e, quando a localização estiver publicada, explore o entorno.</p></article>
            <article><span className="benefit-icon"><Layers3 size={26} /></span><h3>Vá direto à fonte</h3><p>Consulte as origens do anúncio e confirme preços e condições com o anunciante.</p></article>
          </div>
        </div>
      </section>
    </>
  );
}
