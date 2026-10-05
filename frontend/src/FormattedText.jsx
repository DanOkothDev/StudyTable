import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function FormattedText({ children, className = "" }) {
  return (
    <div className={`formatted-text ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || ""}</ReactMarkdown>
    </div>
  );
}
