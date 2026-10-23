"use client";
import { useState } from "react";
import { Search, MapPin, ArrowRight } from "lucide-react";
import type { Filters } from "@/lib/filters";
import { assistantFormValues, searchFormValues, type SearchFormValues } from "@/lib/assistant-form-filters";
import { useAssistant } from "./assistant-provider";
import { assistantSearchParams, type AssistantSearch } from "@/lib/assistant-search";
export function ConventionalSearchBar({
  filters,
  full = false,
  assistantQuery,
}: {
  filters?: Partial<Filters>;
  full?: boolean;
  assistantQuery?: AssistantSearch;
}) {
  const { state } = useAssistant();
  const response = state.turns.at(-1)?.response;
  const initial = searchFormValues(filters, full);
  if (assistantQuery?.filters.sort) initial.sort = assistantQuery.filters.sort;
  const source = JSON.stringify(initial) + (assistantQuery ? assistantSearchParams(assistantQuery).toString() : "");
  const [draft, setDraft] = useState(() => ({ source, response, values: initial, fromAssistant: false, conversationOnly: [] as string[] }));
  // Adjust only when a new server response arrives, not on typing or rerenders.
  // A new URL restores its own filters without replaying an older conversation.
  if (source !== draft.source) {
    setDraft({ source, response, values: initial, fromAssistant: false, conversationOnly: [] });
  } else if (response !== draft.response) {
    setDraft(full && response?.mode === "search"
      ? { ...draft, response, ...assistantFormValues(draft.values, response.applied_filters), fromAssistant: true }
      : { ...draft, response });
  }
  const values = draft.values;
  function update(key: keyof SearchFormValues, value: string) {
    setDraft(previous => ({ ...previous, values: { ...previous.values, [key]: value } }));
  }
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
              checked={!values.listing_type}
              onChange={() => update("listing_type", "")}
            />
            <span>Todos</span>
          </label>
        )}
        <label>
          <input
            type="radio"
            name="listing_type"
            value="sale"
            checked={values.listing_type === "sale"}
            onChange={() => update("listing_type", "sale")}
          />
          <span>Comprar</span>
        </label>
        <label>
          <input
            type="radio"
            name="listing_type"
            value="rental"
            checked={values.listing_type === "rental"}
            onChange={() => update("listing_type", "rental")}
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
            value={values.city}
            onChange={e => update("city", e.target.value)}
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
            value={values.neighborhood}
            onChange={e => update("neighborhood", e.target.value)}
          />
        </label>
        <label>
          <span>Preço mínimo</span>
          <input
            aria-label="Preço mínimo"
            name="min_price"
            type="number"
            min="0"
            step={assistantQuery ? "any" : "0.01"}
            placeholder={`${values.currency} sem mínimo`}
            value={values.min_price}
            onChange={e => update("min_price", e.target.value)}
          />
        </label>
        <label>
          <span>Preço máximo</span>
          <input
            aria-label="Preço máximo"
            name="max_price"
            type="number"
            min="0"
            step={assistantQuery ? "any" : "0.01"}
            placeholder={`${values.currency} sem máximo`}
            value={values.max_price}
            onChange={e => update("max_price", e.target.value)}
          />
        </label>
        <button className="button primary" type="submit">
          <Search size={19} /> Buscar imóveis
        </button>
      </div>
      {full && (
        <div className="advanced-fields">
          {!assistantQuery && <label>
            <span>Palavra-chave no título</span>
            <input
              name="q"
              placeholder="Ex.: apartamento com varanda"
              maxLength={200}
              value={values.q}
              onChange={e => update("q", e.target.value)}
            />
          </label>}
          <label>
            <span>Ordenar por</span>
            <select name="sort" value={values.sort} onChange={e => update("sort", e.target.value)}>
              {assistantQuery && <option value="recommended">Correspondência no catálogo</option>}
              <option value="recent">Mais recentes</option>
              <option value="price_asc">Menor preço</option>
              <option value="price_desc">Maior preço</option>
            </select>
          </label>
        </div>
      )}
      {full &&
        (["region", "country", "availability", "per_page"] as const).map((k) =>
          values[k] !== "" ? (
            <input key={k} type="hidden" name={k} value={values[k]} />
          ) : null,
        )}
      <input type="hidden" name="currency" value={values.currency} />
      {assistantQuery && Array.from(assistantSearchParams(assistantQuery)).filter(([key]) => !["city", "neighborhood", "region", "country", "listing_type", "currency", "min_price", "max_price", "sort", "page", "per_page"].includes(key)).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      {assistantQuery && <p className="search-note">Base do orçamento: {assistantQuery.filters.price_basis === "total_monthly" ? "total mensal informado pela origem" : "preço anunciado"}. Os demais critérios da conversa são preservados.</p>}
      {draft.fromAssistant && !assistantQuery && <div className="search-sync-note" role="status" aria-live="polite">
        <p>Campos básicos preenchidos pela conversa. Revise e clique em “Buscar imóveis” para atualizar a lista. Você pode editar os campos; a próxima resposta da IA poderá atualizá-los.</p>
        {draft.conversationOnly.length > 0 && <p>Somente nas sugestões da conversa: {draft.conversationOnly.join("; ")}. A busca convencional não aplica esses critérios.</p>}
      </div>}
      <p className="search-note">
        Cidade e bairro devem corresponder ao nome publicado. Valores em{" "}
        {values.currency}.
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
