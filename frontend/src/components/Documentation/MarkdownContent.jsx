import React, { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  Copy,
  Check,
  Info,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";

/**
 * Provenance Badge Regex for Scientific Attribution Headers
 */
const BADGE_REGEX = /^\[(From Pan & Tompkins.*?|Current Codebase.*?|Application-Specific.*?|Cardiovascular.*?|Cardiological.*?)\]$/;

/**
 * High-Fidelity Markdown & Mathematical Notation Renderer for Pan-Tompkins Documentation.
 * Uses ReactMarkdown + remarkGfm + remarkMath + rehypeKatex with dark theme styling.
 */
export default function MarkdownContent({ markdownText, onNavigateChapter }) {
  if (!markdownText) return null;

  // Preprocess LaTeX delimiters and single-line $$ equations before AST parsing
  const processedText = useMemo(() => preprocessMarkdown(markdownText), [markdownText]);

  // Memoize custom markdown component overrides
  const components = useMemo(
    () => ({
      h1: Heading1,
      h2: Heading2,
      h3: Heading3,
      h4: Heading4,
      p: Paragraph,
      pre: PreBlock,
      code: CodeElement,
      blockquote: BlockquoteElement,
      table: TableElement,
      thead: TheadElement,
      th: ThElement,
      td: TdElement,
      a: (props) => <LinkElement {...props} onNavigateChapter={onNavigateChapter} />,
      hr: HrElement,
      ul: UlElement,
      ol: OlElement,
      li: LiElement,
      strong: StrongElement,
      em: EmElement,
      img: ImgElement,
    }),
    [onNavigateChapter]
  );

  return (
    <div
      className="markdown-content"
      style={{
        color: "#cbd5e1",
        lineHeight: 1.7,
        fontSize: "0.96rem",
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkCallout]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: "#f87171", strict: false }]]}
        components={components}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Preprocesses markdown source to normalize math delimiters:
 * - Converts \(...\) to $...$
 * - Converts \[...\] to $$...$$
 * - Formats single-line $$ ... $$ and indented list $$ ... $$ into multiline display math blocks
 * - Protects code blocks and inline backtick code from accidental delimiter substitution
 */
function preprocessMarkdown(text) {
  if (!text) return "";
  const lines = text.split("\n");
  let inCodeBlock = false;
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track fenced code blocks (```)
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }
    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    // Split line by inline code backticks to protect inline code spans
    const parts = line.split(/(`[^`]+`)/);
    const processedLine = parts
      .map((part) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return part;
        }
        // Replace \(...\) with $...$
        let s = part.replace(/\\\((.*?)\\\)/g, "$$$1$$");
        // Replace \[...\] with $$...$$
        s = s.replace(/\\\[(.*?)\\\]/g, "$$$$$$1$$$$$$");
        return s;
      })
      .join("");

    // Check if the entire line is a display equation: e.g. `$$ ... $$` or `  $$ ... $$`
    const displayMatch = processedLine.match(/^(\s*)\$\$(.+?)\$\$\s*$/);
    if (displayMatch) {
      const indent = displayMatch[1];
      const math = displayMatch[2].trim();
      result.push("");
      result.push(`${indent}$$`);
      result.push(`${indent}${math}`);
      result.push(`${indent}$$`);
      result.push("");
      continue;
    }

    result.push(processedLine);
  }

  return result.join("\n");
}

/**
 * Custom Remark plugin to detect GitHub-style Alert callouts:
 * > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]
 */
function remarkCallout() {
  return (tree) => {
    for (const node of tree.children) {
      if (node.type === "blockquote") {
        const firstP = node.children.find((c) => c.type === "paragraph");
        if (
          firstP &&
          firstP.children &&
          firstP.children[0] &&
          firstP.children[0].type === "text"
        ) {
          const match = firstP.children[0].value.match(
            /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(\n|$)/i
          );
          if (match) {
            node.data = node.data || {};
            node.data.hProperties = node.data.hProperties || {};
            node.data.hProperties.dataAlertType = match[1].toUpperCase();
            firstP.children[0].value = firstP.children[0].value.slice(match[0].length);
          }
        }
      }
    }
  };
}

/**
 * Extracts plain text from nested React children/elements.
 */
function getNodeText(node) {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (node.props && node.props.children) return getNodeText(node.props.children);
  return "";
}

/**
 * Generates an anchor slug compatible with extractSections in docsRegistry.js.
 */
function getHeadingSlug(children) {
  const text = getNodeText(children);
  return text
    .toLowerCase()
    .replace(/\[.*?\]/g, "") // remove badges like [From Pan & Tompkins]
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/* ───────────────────────── Block Components ───────────────────────── */

function Heading1({ children }) {
  const slug = getHeadingSlug(children);
  return (
    <h1
      id={slug}
      style={{
        fontSize: "1.95rem",
        fontWeight: 800,
        color: "#f8fafc",
        marginTop: "1.25rem",
        marginBottom: "1rem",
        letterSpacing: "-0.025em",
        borderBottom: "1px solid #334155",
        paddingBottom: "0.6rem",
      }}
    >
      {children}
    </h1>
  );
}

function Heading2({ children }) {
  const slug = getHeadingSlug(children);
  return (
    <h2
      id={slug}
      style={{
        fontSize: "1.4rem",
        fontWeight: 700,
        color: "#38bdf8",
        marginTop: "2.2rem",
        marginBottom: "0.75rem",
        letterSpacing: "-0.015em",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      {children}
    </h2>
  );
}

function Heading3({ children }) {
  const slug = getHeadingSlug(children);
  return (
    <h3
      id={slug}
      style={{
        fontSize: "1.12rem",
        fontWeight: 600,
        color: "#e2e8f0",
        marginTop: "1.5rem",
        marginBottom: "0.5rem",
      }}
    >
      {children}
    </h3>
  );
}

function Heading4({ children }) {
  const slug = getHeadingSlug(children);
  return (
    <h4
      id={slug}
      style={{
        fontSize: "1.02rem",
        fontWeight: 600,
        color: "#cbd5e1",
        marginTop: "1.2rem",
        marginBottom: "0.4rem",
      }}
    >
      {children}
    </h4>
  );
}

function Paragraph({ children }) {
  const text = getNodeText(children).trim();
  const badgeMatch = text.match(BADGE_REGEX);
  if (badgeMatch) {
    return (
      <div style={{ margin: "0.35rem 0 0.85rem 0" }}>
        {renderProvenanceBadge(badgeMatch[1])}
      </div>
    );
  }
  return (
    <p style={{ margin: "0.85rem 0", color: "#cbd5e1", lineHeight: 1.75 }}>
      {children}
    </p>
  );
}

function PreBlock({ children }) {
  let codeElement = null;
  if (React.isValidElement(children)) {
    codeElement = children;
  } else if (Array.isArray(children)) {
    codeElement = children.find((c) => React.isValidElement(c));
  }

  if (!codeElement) {
    return <pre>{children}</pre>;
  }

  const className = codeElement.props?.className || "";
  const langMatch = className.match(/language-(\w+)/);
  const lang = langMatch ? langMatch[1] : "text";
  const codeText = getNodeText(codeElement.props?.children).replace(/\n$/, "");

  return <CodeBlock lang={lang} code={codeText} />;
}

function CodeElement({ node: _node, children, ...props }) {
  return (
    <code
      style={{
        background: "rgba(30, 41, 59, 0.8)",
        border: "1px solid #334155",
        color: "#38bdf8",
        padding: "0.15rem 0.35rem",
        borderRadius: "4px",
        fontSize: "0.85em",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      }}
      {...props}
    >
      {children}
    </code>
  );
}

function BlockquoteElement({ children, ...props }) {
  const alertType = props["data-alert-type"];
  if (alertType) {
    return <AlertCallout alertType={alertType}>{children}</AlertCallout>;
  }
  return (
    <blockquote
      style={{
        margin: "1.25rem 0",
        padding: "0.75rem 1.25rem",
        borderLeft: "4px solid #38bdf8",
        background: "rgba(15, 23, 42, 0.65)",
        borderRadius: "0 8px 8px 0",
        color: "#94a3b8",
        fontStyle: "italic",
      }}
    >
      {children}
    </blockquote>
  );
}

function TableElement({ children }) {
  return (
    <div
      style={{
        margin: "1.4rem 0",
        overflowX: "auto",
        borderRadius: "8px",
        border: "1px solid #334155",
        background: "#0d1527",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.86rem",
          textAlign: "left",
        }}
      >
        {children}
      </table>
    </div>
  );
}

function TheadElement({ children }) {
  return (
    <thead
      style={{
        background: "rgba(30, 41, 59, 0.85)",
        borderBottom: "2px solid #334155",
      }}
    >
      {children}
    </thead>
  );
}

function ThElement({ children }) {
  return (
    <th
      style={{
        padding: "0.75rem 1rem",
        color: "#f8fafc",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function TdElement({ children }) {
  return (
    <td
      style={{
        padding: "0.65rem 1rem",
        color: "#cbd5e1",
        lineHeight: 1.55,
        borderBottom: "1px solid rgba(51, 65, 85, 0.45)",
      }}
    >
      {children}
    </td>
  );
}

function LinkElement({ href, children, onNavigateChapter }) {
  const isDocLink = href && href.endsWith(".md");
  const isHashLink = href && href.startsWith("#");

  const handleClick = (e) => {
    if (isDocLink && onNavigateChapter) {
      e.preventDefault();
      onNavigateChapter(href);
    } else if (isHashLink) {
      e.preventDefault();
      const el = document.getElementById(href.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      target={isDocLink || isHashLink ? undefined : "_blank"}
      rel={isDocLink || isHashLink ? undefined : "noopener noreferrer"}
      style={{
        color: "#38bdf8",
        textDecoration: "underline",
        textUnderlineOffset: "3px",
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {children}
      {!isDocLink && !isHashLink && (
        <ExternalLink size={12} style={{ display: "inline", marginLeft: 3, verticalAlign: "middle" }} />
      )}
    </a>
  );
}

function HrElement() {
  return (
    <hr
      style={{
        border: "none",
        borderTop: "1px solid rgba(51, 65, 85, 0.7)",
        margin: "2rem 0",
      }}
    />
  );
}

function UlElement({ children }) {
  return (
    <ul
      style={{
        margin: "0.85rem 0 1.1rem 1.5rem",
        paddingLeft: "0.5rem",
        color: "#cbd5e1",
        lineHeight: 1.75,
      }}
    >
      {children}
    </ul>
  );
}

function OlElement({ children }) {
  return (
    <ol
      style={{
        margin: "0.85rem 0 1.1rem 1.5rem",
        paddingLeft: "0.5rem",
        color: "#cbd5e1",
        lineHeight: 1.75,
      }}
    >
      {children}
    </ol>
  );
}

function LiElement({ children }) {
  return (
    <li style={{ marginBottom: "0.35rem" }}>
      {children}
    </li>
  );
}

function StrongElement({ children }) {
  return <strong style={{ color: "#f8fafc", fontWeight: 600 }}>{children}</strong>;
}

function EmElement({ children }) {
  return <em style={{ color: "#94a3b8" }}>{children}</em>;
}

function ImgElement({ src, alt }) {
  return (
    <img
      src={src}
      alt={alt}
      style={{
        maxWidth: "100%",
        borderRadius: "8px",
        margin: "1rem 0",
        border: "1px solid #334155",
      }}
    />
  );
}

/* ───────────────────────── Helper Components ───────────────────────── */

/**
 * Fenced Code Block with copy feedback and language banner.
 */
function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        margin: "1.25rem 0",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid #334155",
        background: "#0a0f1d",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.45rem 0.9rem",
          background: "rgba(15, 23, 42, 0.95)",
          borderBottom: "1px solid #1e293b",
          fontSize: "0.75rem",
          color: "#94a3b8",
          textTransform: "uppercase",
          fontWeight: 600,
          letterSpacing: "0.05em",
        }}
      >
        <span>{lang}</span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            background: "transparent",
            border: "none",
            color: copied ? "#34d399" : "#94a3b8",
            cursor: "pointer",
            fontSize: "0.75rem",
            padding: "0.15rem 0.4rem",
            borderRadius: "4px",
            transition: "color 0.15s ease",
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: "1rem",
          overflowX: "auto",
          color: "#e2e8f0",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: "0.85rem",
          lineHeight: 1.6,
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * GitHub-style Alert Callouts.
 */
function AlertCallout({ alertType, children }) {
  const configs = {
    NOTE: {
      color: "#38bdf8",
      bg: "rgba(56, 189, 248, 0.09)",
      border: "#0284c7",
      icon: Info,
      title: "Note",
    },
    TIP: {
      color: "#34d399",
      bg: "rgba(52, 211, 153, 0.09)",
      border: "#059669",
      icon: Lightbulb,
      title: "Tip",
    },
    IMPORTANT: {
      color: "#fbbf24",
      bg: "rgba(251, 191, 36, 0.09)",
      border: "#d97706",
      icon: AlertTriangle,
      title: "Important",
    },
    WARNING: {
      color: "#f87171",
      bg: "rgba(248, 113, 113, 0.09)",
      border: "#dc2626",
      icon: AlertTriangle,
      title: "Warning",
    },
    CAUTION: {
      color: "#f43f5e",
      bg: "rgba(244, 63, 94, 0.09)",
      border: "#e11d48",
      icon: ShieldAlert,
      title: "Caution",
    },
  };

  const config = configs[alertType] || configs.NOTE;
  const IconComponent = config.icon;

  return (
    <div
      style={{
        margin: "1.4rem 0",
        padding: "1rem 1.25rem",
        borderRadius: "8px",
        background: config.bg,
        borderLeft: `4px solid ${config.border}`,
        borderTop: "1px solid rgba(51, 65, 85, 0.4)",
        borderRight: "1px solid rgba(51, 65, 85, 0.4)",
        borderBottom: "1px solid rgba(51, 65, 85, 0.4)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontWeight: 700,
          color: config.color,
          fontSize: "0.88rem",
          marginBottom: "0.45rem",
          letterSpacing: "0.02em",
        }}
      >
        <IconComponent size={17} />
        <span>{config.title}</span>
      </div>
      <div style={{ color: "#cbd5e1", fontSize: "0.92rem", lineHeight: 1.65 }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Provenance Pill Badges for scientific attribution.
 */
function renderProvenanceBadge(badgeText) {
  let bg = "rgba(59, 130, 246, 0.14)";
  let border = "#3b82f6";
  let text = "#60a5fa";

  if (badgeText.includes("Pan & Tompkins")) {
    bg = "rgba(59, 130, 246, 0.16)";
    border = "#2563eb";
    text = "#60a5fa";
  } else if (badgeText.includes("Current Codebase")) {
    bg = "rgba(16, 185, 129, 0.14)";
    border = "#059669";
    text = "#34d399";
  } else if (badgeText.includes("Application-Specific")) {
    bg = "rgba(245, 158, 11, 0.14)";
    border = "#d97706";
    text = "#fbbf24";
  } else if (badgeText.includes("Cardiovascular") || badgeText.includes("Electrophysiology")) {
    bg = "rgba(236, 72, 153, 0.14)";
    border = "#db2777";
    text = "#f472b6";
  }

  return (
    <span
      key={badgeText}
      style={{
        display: "inline-block",
        fontSize: "0.72rem",
        fontWeight: 600,
        padding: "0.2rem 0.55rem",
        borderRadius: "9999px",
        background: bg,
        border: `1px solid ${border}`,
        color: text,
        letterSpacing: "0.03em",
        verticalAlign: "middle",
      }}
    >
      {badgeText}
    </span>
  );
}
