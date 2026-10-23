"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Minus } from "lucide-react";
import { useAssistant } from "./assistant-provider";
import { PropertyQuestions } from "./property-questions";

export function PropertyChatWidget() {
  const pathname = usePathname();
  const { state, inlineSearchOpen } = useAssistant();
  const eligible = !inlineSearchOpen && !/^\/(admin|auth|conta)(\/|$)/.test(pathname);
  const [open, setOpen] = useState(false);
  const interacted = useRef(false);
  const allowed = useRef(eligible);
  const launcher = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    allowed.current = eligible;
    if (inlineSearchOpen) interacted.current = true;
  }, [eligible, inlineSearchOpen]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function offer() {
      if (interacted.current) return;
      // Automatic opening never interrupts a gallery, another dialog or typing.
      const typing = document.activeElement?.matches("input, textarea, select, [contenteditable=true]");
      if (!allowed.current || document.hidden || typing || document.querySelector("dialog[open], [aria-modal=true]")) {
        timer = setTimeout(offer, 2000);
        return;
      }
      interacted.current = true;
      setOpen(true); // Deliberately preserve the user's current keyboard focus.
    }
    timer = setTimeout(offer, 20000);
    return () => clearTimeout(timer);
  }, []);
  function show() {
    interacted.current = true; setOpen(true);
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  }
  function minimize() {
    interacted.current = true; setOpen(false);
    launcher.current?.focus({ preventScroll: true });
  }
  if (!eligible) return null;
  return <div className="property-chat-widget">
    <section id="morada-chat-window" role="dialog" aria-modal="false" aria-labelledby="chat-window-title" className="chat-window" hidden={!open} onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); minimize(); } }}>
      <header className="chat-window-header">
        <span className="chat-avatar"><MessageCircle size={22} aria-hidden="true" /></span>
        <div><h2 id="chat-window-title" ref={heading} tabIndex={-1}>Converse com o Morada</h2><p>{state.selectedId ? "Sobre o imóvel selecionado na conversa" : "Busque seu próximo lugar"}</p></div>
        <button type="button" onClick={minimize} aria-label="Minimizar conversa"><Minus size={22} aria-hidden="true" /></button>
      </header>
      <div className="chat-window-content">
        <PropertyQuestions />
      </div>
    </section>
    <button ref={launcher} type="button" className="chat-launcher" onClick={open ? minimize : show} aria-expanded={open} aria-controls="morada-chat-window" aria-label={open ? "Minimizar conversa" : "Abrir conversa com o Morada"}><MessageCircle size={24} aria-hidden="true" /><span>Fale com o Morada</span></button>
  </div>;
}
