import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const styles = `
.formatted-text { overflow-wrap: anywhere; line-height: 1.75; }
.formatted-text > :first-child { margin-top: 0; }
.formatted-text > :last-child { margin-bottom: 0; }
.formatted-text h1, .formatted-text h2, .formatted-text h3, .formatted-text h4 { margin: 1.25em 0 .45em; line-height: 1.3; }
.formatted-text h1 { font-size: 1.3em; }
.formatted-text h2 { font-size: 1.18em; }
.formatted-text h3, .formatted-text h4 { font-size: 1.05em; }
.formatted-text p, .formatted-text ul, .formatted-text ol, .formatted-text blockquote, .formatted-text pre, .formatted-text table { margin: .65em 0; }
.formatted-text ul, .formatted-text ol { padding-left: 1.5em; }
.formatted-text li + li { margin-top: .25em; }
.formatted-text blockquote { padding-left: 1em; border-left: 3px solid var(--line); color: var(--muted); }
.formatted-text code { padding: .12em .35em; border-radius: 5px; background: rgba(19, 26, 46, .07); font-size: .9em; }
.formatted-text pre { overflow-x: auto; padding: 12px 14px; border-radius: 12px; background: rgba(19, 26, 46, .07); }
.formatted-text pre code { padding: 0; background: transparent; }
.formatted-text table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
.formatted-text th, .formatted-text td { padding: 7px 10px; border: 1px solid var(--line); text-align: left; }
.formatted-text th { background: rgba(19, 26, 46, .04); }
`;

export default function FormattedText({ children, className = "" }) {
  return (
    <>
      <style>{styles}</style>
      <div className={`formatted-text ${className}`.trim()}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || ""}</ReactMarkdown>
      </div>
    </>
  );
}
