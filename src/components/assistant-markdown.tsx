import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { citationUrl, type QuestionAnswer } from "@/lib/property-questions";

const plugins = [remarkGfm];
const components: Components = {
  a: ({ href, children }) => href
    ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    : <span>{children}</span>,
  // Answers cannot load tracking images or embed external content.
  img: ({ alt }) => <span>{alt || "Imagem omitida"}</span>,
  h1: ({ children }) => <h3>{children}</h3>,
  h2: ({ children }) => <h3>{children}</h3>,
  table: ({ children }) => <div className="markdown-table" role="region" aria-label="Tabela da resposta" tabIndex={0}><table>{children}</table></div>,
};

export function AssistantMarkdown({ text, citations = [] }: {
  text: string;
  citations?: Pick<QuestionAnswer["citations"][number], "id" | "url">[];
}) {
  // Resolve shortcut references only for safe sources actually supplied by the API.
  // Definitions precede the answer so its text cannot override these source URLs.
  const references = citations.flatMap(({ id, url }) => {
    const href = citationUrl(url);
    return href && /^[a-z0-9_-]{1,80}$/i.test(id)
      ? [`[${id}]: <${href.replaceAll("<", "%3C").replaceAll(">", "%3E")}>`]
      : [];
  });
  return <div className="assistant-markdown">
    <Markdown remarkPlugins={plugins} components={components} urlTransform={url => citationUrl(url) ?? ""}>
      {references.length ? `${references.join("\n")}\n\n${text}` : text}
    </Markdown>
  </div>;
}
