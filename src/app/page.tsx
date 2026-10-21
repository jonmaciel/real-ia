import Link from "next/link";
import { DiscoveryAtlas } from "@/components/discovery-atlas";
import {
  ArrowRight,
  ArrowUpRight,
  Layers3,
  ScanLine,
  ShieldCheck,
  Compass,
} from "lucide-react";
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
      search(parseFilters({ per_page: "3" })),
      realEstateCategory(),
    ]);
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <>
      <section className="hero editorial-hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="tiny-line" /> DESCOBERTA IMOBILIÁRIA, COM PERSPECTIVA
          </span>
          <h1>
            Encontre um lugar
            <br />
            que combine <em>com você.</em>
          </h1>
          <p>
            Diferentes anúncios. Um ponto de partida.
            Explore imóveis, conheça os detalhes e vá direto às fontes.
          </p>
          <div className="hero-footnote">
            <Compass size={18} />
            <span>Menos caminhos dispersos. Mais espaço para decidir.</span>
          </div>
        </div>
        <DiscoveryAtlas />
      </section>
      <section className="search-section" aria-label="Busca de imóveis">
        <div className="search-intro"><span className="eyebrow">01 / O PONTO DE PARTIDA</span><h2>Onde começa seu próximo capítulo?</h2></div>
        <ConventionalSearchBar />
      </section>
      <div className="trust-strip">
        <span>
          <ScanLine size={19} /> Busca simples e objetiva
        </span>
        <span>
          <Layers3 size={19} /> Fontes em um só lugar
        </span>
        <span>
          <ShieldCheck size={19} /> Transparência para decidir
        </span>
      </div>
      <section className="section recent">
        <div className="section-heading">
          <div>
            <span className="eyebrow">02 / NO RADAR</span>
            <h2>Seu próximo lugar pode estar aqui.</h2>
            <p>Explore os imóveis publicados recentemente.</p>
          </div>
          <Link href="/buscar" className="text-link">
            Explorar imóveis <ArrowRight size={18} />
          </Link>
        </div>
        {error ? (
          <ErrorState message={error} href="/" />
        ) : result?.data.length ? (
          <PropertyGrid properties={result.data} category={category} />
        ) : (
          <p className="state-box">
            Ainda não há imóveis publicados nesta categoria.
          </p>
        )}
      </section>
      <section className="discovery-section">
        <div>
          <span className="eyebrow">03 / ESCOLHA SEU CAMINHO</span>
          <h2>Qual é o seu próximo passo?</h2>
          <p>
            Seja para criar raízes ou descobrir um novo bairro,
            <br />
            comece pelo que faz sentido para você.
          </p>
        </div>
        <Link className="path-card" href="/buscar?listing_type=sale">
          <span>01 / CRIAR RAÍZES</span>
          <h3>
            Um lugar para
            <br />
            chamar de seu.
          </h3>
          <div>
            Encontrar para comprar <ArrowUpRight size={22} />
          </div>
        </Link>
        <Link className="path-card rental" href="/buscar?listing_type=rental">
          <span>02 / NOVOS ARES</span>
          <h3>
            Liberdade para
            <br />
            um novo começo.
          </h3>
          <div>
            Encontrar para alugar <ArrowUpRight size={22} />
          </div>
        </Link>
      </section>
      <section className="section how-section" id="como-funciona">
        <div>
          <span className="eyebrow">04 / DA DESCOBERTA À DECISÃO</span>
          <h2>
            Uma boa escolha começa
            <br />
            com informação.
          </h2>
          <p>Explore as possibilidades e conheça a origem de cada anúncio.</p>
        </div>
        <div className="steps">
          <article>
            <span>01</span>
            <div>
              <h3>Encontre no seu ritmo</h3>
              <p>
                Escolha cidade, modalidade e faixa de preço. Sem mudar seus
                critérios.
              </p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <h3>Conheça cada detalhe</h3>
              <p>
                Veja os atributos informados e as mídias autorizadas, quando
                disponíveis.
              </p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <h3>Vá direto à fonte</h3>
              <p>
                Consulte os anúncios de origem e confirme preços e condições com
                o anunciante.
              </p>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
