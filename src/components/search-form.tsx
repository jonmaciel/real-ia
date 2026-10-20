import { Search, MapPin, ArrowRight } from "lucide-react";
import type { Filters } from "@/lib/filters";
export function ConventionalSearchBar({
  filters,
  full = false,
}: {
  filters?: Partial<Filters>;
  full?: boolean;
}) {
  return (
    <form
      action="/buscar"
      className={`search-form ${full ? "full-search" : ""}`}
    >
      <fieldset className="transaction">
        <legend className="sr-only">Modalidade</legend>
        {full && (
          <label>
            <input
              type="radio"
              name="listing_type"
              value=""
              defaultChecked={!filters?.listing_type}
            />
            <span>Todos</span>
          </label>
        )}
        <label>
          <input
            type="radio"
            name="listing_type"
            value="sale"
            defaultChecked={
              full
                ? filters?.listing_type === "sale"
                : filters?.listing_type !== "rental"
            }
          />
          <span>Comprar</span>
        </label>
        <label>
          <input
            type="radio"
            name="listing_type"
            value="rental"
            defaultChecked={filters?.listing_type === "rental"}
          />
          <span>Alugar</span>
        </label>
      </fieldset>
      <div className="search-fields">
        <label className="city-field">
          <span>
            <MapPin size={15} /> Onde você quer morar?
          </span>
          <input
            name="city"
            placeholder="Digite a cidade"
            maxLength={120}
            defaultValue={filters?.city}
          />
        </label>
        <label>
          <span>
            Bairro <small>opcional</small>
          </span>
          <input
            name="neighborhood"
            placeholder="Qualquer bairro"
            maxLength={120}
            defaultValue={filters?.neighborhood}
          />
        </label>
        <label>
          <span>Preço mínimo</span>
          <input
            aria-label="Preço mínimo"
            name="min_price"
            type="number"
            min="0"
            step="0.01"
            placeholder={`${filters?.currency ?? "BRL"} sem mínimo`}
            defaultValue={filters?.min_price}
          />
        </label>
        <label>
          <span>Preço máximo</span>
          <input
            aria-label="Preço máximo"
            name="max_price"
            type="number"
            min="0"
            step="0.01"
            placeholder={`${filters?.currency ?? "BRL"} sem máximo`}
            defaultValue={filters?.max_price}
          />
        </label>
        <button className="button primary" type="submit">
          <Search size={19} /> Buscar imóveis
        </button>
      </div>
      {full && (
        <div className="advanced-fields">
          <label>
            <span>Palavra-chave no título</span>
            <input
              name="q"
              placeholder="Ex.: apartamento com varanda"
              maxLength={200}
              defaultValue={filters?.q}
            />
          </label>
          <label>
            <span>Ordenar por</span>
            <select name="sort" defaultValue={filters?.sort ?? "recent"}>
              <option value="recent">Mais recentes</option>
              <option value="price_asc">Menor preço</option>
              <option value="price_desc">Maior preço</option>
            </select>
          </label>
        </div>
      )}
      {full &&
        (["region", "country", "availability", "per_page"] as const).map((k) =>
          filters?.[k] !== undefined ? (
            <input key={k} type="hidden" name={k} value={String(filters[k])} />
          ) : null,
        )}
      <input type="hidden" name="currency" value={filters?.currency ?? "BRL"} />
      <p className="search-note">
        Cidade e bairro devem corresponder ao nome publicado. Valores em{" "}
        {filters?.currency ?? "BRL"}.
      </p>
    </form>
  );
}
export function SearchPrompt() {
  return (
    <a href="/buscar" className="text-link">
      Explore no seu tempo <ArrowRight size={17} />
    </a>
  );
}
