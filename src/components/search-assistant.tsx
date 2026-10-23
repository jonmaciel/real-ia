"use client";
import { useEffect, useId } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { useAssistant } from "./assistant-provider";
import { PropertyQuestions } from "./property-questions";

export function SearchAssistant() {
  const chat = useAssistant();
  const { inlineSearchOpen: open, setInlineSearchOpen } = chat;
  const panelId = useId();
  const titleId = useId();
  useEffect(() => () => setInlineSearchOpen(false), [setInlineSearchOpen]);
  function toggle() {
    if (!open && chat.state.selectedId) chat.continueSearch();
    setInlineSearchOpen(!open);
  }
  return <section className="search-assistant" aria-labelledby={titleId}>
    <h2>
      <button type="button" id={titleId} className="search-assistant-toggle" aria-expanded={open} aria-controls={panelId} onClick={toggle}>
        <span className="search-assistant-icon"><Sparkles size={20} aria-hidden="true" /></span>
        <span><strong>Prefere descrever? Busque com IA</strong><small>Converse com o Morada e veja os critérios da sua busca.</small></span>
        <ChevronDown size={20} className="search-assistant-chevron" aria-hidden="true" />
      </button>
    </h2>
    <div id={panelId} hidden={!open}>
      {open && <>
        <p className="search-assistant-note">A cada resposta, a IA preenche os campos básicos acima, mesmo se ainda precisar perguntar algo. Revise e clique em “Buscar imóveis” para atualizar a lista. Características avançadas valem somente para as sugestões da conversa.</p>
        <PropertyQuestions inline />
      </>}
    </div>
  </section>;
}
