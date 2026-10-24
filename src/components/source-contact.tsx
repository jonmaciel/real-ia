import type { z } from "zod";
import type { sourceSchema } from "@/lib/contracts";
import { safeUrl } from "@/lib/presentation";
export function SourceContact({ source }: { source: z.infer<typeof sourceSchema> }) {
  const contact = source.contact;
  const address = source.address;
  const phones = [...new Set([contact?.phone, contact?.mobile].filter((value): value is string => !!value && /^\+[1-9]\d{7,14}$/.test(value)))];
  const location = [address?.street, address?.number, address?.complement, address?.neighborhood, address?.city, address?.region, address?.postal_code].filter(Boolean).join(", ");
  const email = contact?.email && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contact.email) ? contact.email : null;
  const site = safeUrl(contact?.website);
  const whatsapp = safeUrl(contact?.whatsapp_url);
  const safeWhatsApp = whatsapp && ["wa.me", "api.whatsapp.com"].includes(new URL(whatsapp).hostname) ? whatsapp : null;
  if (!location && !phones.length && !email && !site && !safeWhatsApp && !contact?.agency_name) return null;
  return <div className="source-contact"><h4>Contato informado pelo anunciante</h4>{contact?.agency_name && <p>{contact.agency_name}{contact.creci ? ` · CRECI ${contact.creci}` : ""}</p>}{phones.map(phone => <p key={phone}><a className="text-link" href={`tel:${phone}`}>{phone}</a></p>)}{email && <p><a className="text-link" href={`mailto:${encodeURIComponent(email)}`}>{email}</a></p>}{safeWhatsApp && <p><a className="text-link" href={safeWhatsApp} target="_blank" rel="noopener noreferrer">Conversar pelo WhatsApp</a></p>}{site && <p><a className="text-link" href={site} target="_blank" rel="noopener noreferrer">Site do anunciante</a></p>}{location && <p>Endereço informado: {location}</p>}</div>;
}
