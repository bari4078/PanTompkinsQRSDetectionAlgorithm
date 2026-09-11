import React, { useState } from 'react';
import {
  Copy,
  Check,
  Info,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';

/**
 * Custom High-Fidelity Markdown Renderer for the Pan-Tompkins Documentation.
 * Provides clean typography, code block copying, alert callouts, tables, and badge styling.
 */
export default function MarkdownContent({ markdownText, onNavigateChapter }) {
  if (!markdownText) return null;

  // Split into block tokens
  const blocks = parseMarkdownBlocks(markdownText);

  return (
    <div className="markdown-content" style={{ color: '#cbd5e1', lineHeight: 1.7, fontSize: '0.96rem' }}>
      {blocks.map((block, index) => (
        <React.Fragment key={index}>
          {renderBlock(block, onNavigateChapter)}
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Splits raw markdown into block-level elements.
 */
function parseMarkdownBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Fenced Code Block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push({
        type: 'code',
        lang: lang || 'text',
        content: codeLines.join('\n'),
      });
      continue;
    }

    // 2. Alert Callouts (> [!NOTE], > [!IMPORTANT], > [!WARNING], > [!TIP])
    if (line.trim().startsWith('> [!')) {
      const match = line.trim().match(/^>\s*\[!([A-Z]+)\]/);
      const alertType = match ? match[1].toUpperCase() : 'NOTE';
      const quoteLines = [];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'alert',
        alertType,
        content: quoteLines.join('\n'),
      });
      continue;
    }

    // 3. Regular Blockquote (> text)
    if (line.trim().startsWith('>')) {
      const quoteLines = [line.replace(/^>\s?/, '')];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'blockquote',
        content: quoteLines.join('\n'),
      });
      continue;
    }

    // 4. Markdown Table (| header | header |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'table',
        content: tableLines,
      });
      continue;
    }

    // 5. Horizontal Rule (---, ***)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 6. Headings (#, ##, ###, ####)
    if (line.startsWith('#')) {
      const level = line.match(/^#+/)[0].length;
      const textOnly = line.replace(/^#+\s+/, '').trim();
      blocks.push({
        type: 'heading',
        level,
        content: textOnly,
      });
      i++;
      continue;
    }

    // 7. Math Display Block ($$ ... $$)
    if (line.trim().startsWith('$$')) {
      const mathLines = [];
      if (line.trim().endsWith('$$') && line.trim().length > 4) {
        // Single line $$ math $$
        mathLines.push(line.trim().slice(2, -2).trim());
        i++;
      } else {
        i++;
        while (i < lines.length && !lines[i].trim().endsWith('$$')) {
          mathLines.push(lines[i]);
          i++;
        }
        i++; // Skip closing $$
      }
      blocks.push({
        type: 'math_block',
        content: mathLines.join('\n'),
      });
      continue;
    }

    // 8. Unordered / Ordered Lists
    if (/^\s*([*+-]|\d+\.)\s+/.test(line)) {
      const listItems = [];
      const isOrdered = /^\s*\d+\.\s+/.test(line);
      while (i < lines.length && /^\s*([*+-]|\d+\.)\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*([*+-]|\d+\.)\s+/, '');
        listItems.push(itemText);
        i++;
      }
      blocks.push({
        type: 'list',
        ordered: isOrdered,
        items: listItems,
      });
      continue;
    }

    // 9. Blank Lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // 10. Paragraph (accumulate until blank line or special token)
    const paraLines = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('|') &&
      !lines[i].trim().startsWith('$$') &&
      !/^\s*([*+-]|\d+\.)\s+/.test(lines[i]) &&
      !/^(\*{3,}|-{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({
      type: 'paragraph',
      content: paraLines.join(' '),
    });
  }

  return blocks;
}

/**
 * Render individual block types.
 */
function renderBlock(block, onNavigateChapter) {
  switch (block.type) {
    case 'heading': {
      const slug = block.content
        .toLowerCase()
        .replace(/\[.*?\]/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');

      if (block.level === 1) {
        return (
          <h1
            id={slug}
            style={{
              fontSize: '1.95rem',
              fontWeight: 800,
              color: '#f8fafc',
              marginTop: '1.25rem',
              marginBottom: '1rem',
              letterSpacing: '-0.025em',
              borderBottom: '1px solid #334155',
              paddingBottom: '0.6rem',
            }}
          >
            {renderInline(block.content, onNavigateChapter)}
          </h1>
        );
      }
      if (block.level === 2) {
        return (
          <h2
            id={slug}
            style={{
              fontSize: '1.4rem',
              fontWeight: 700,
              color: '#38bdf8',
              marginTop: '2.2rem',
              marginBottom: '0.75rem',
              letterSpacing: '-0.015em',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {renderInline(block.content, onNavigateChapter)}
          </h2>
        );
      }
      return (
        <h3
          id={slug}
          style={{
            fontSize: '1.12rem',
            fontWeight: 600,
            color: '#e2e8f0',
            marginTop: '1.5rem',
            marginBottom: '0.5rem',
          }}
        >
          {renderInline(block.content, onNavigateChapter)}
        </h3>
      );
    }

    case 'paragraph':
      return (
        <p style={{ margin: '0.85rem 0', color: '#cbd5e1', lineHeight: 1.75 }}>
          {renderInline(block.content, onNavigateChapter)}
        </p>
      );

    case 'hr':
      return (
        <hr
          style={{
            border: 'none',
            borderTop: '1px solid rgba(51, 65, 85, 0.7)',
            margin: '2rem 0',
          }}
        />
      );

    case 'code':
      return <CodeBlock lang={block.lang} code={block.content} />;

    case 'alert':
      return <AlertCallout alertType={block.alertType} content={block.content} onNavigate={onNavigateChapter} />;

    case 'blockquote':
      return (
        <blockquote
          style={{
            margin: '1.25rem 0',
            padding: '0.75rem 1.25rem',
            borderLeft: '4px solid #38bdf8',
            background: 'rgba(15, 23, 42, 0.65)',
            borderRadius: '0 8px 8px 0',
            color: '#94a3b8',
            fontStyle: 'italic',
          }}
        >
          {renderInline(block.content, onNavigateChapter)}
        </blockquote>
      );

    case 'table':
      return <MarkdownTable lines={block.content} onNavigate={onNavigateChapter} />;

    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag
          style={{
            margin: '0.85rem 0 1.1rem 1.5rem',
            paddingLeft: '0.5rem',
            color: '#cbd5e1',
            lineHeight: 1.75,
          }}
        >
          {block.items.map((item, idx) => (
            <li key={idx} style={{ marginBottom: '0.35rem' }}>
              {renderInline(item, onNavigateChapter)}
            </li>
          ))}
        </Tag>
      );
    }

    case 'math_block':
      return (
        <div
          style={{
            margin: '1.25rem 0',
            padding: '0.9rem 1.2rem',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid #334155',
            borderRadius: '8px',
            overflowX: 'auto',
            textAlign: 'center',
            color: '#f8fafc',
            fontFamily: 'KaTeX_Main, Times New Roman, serif',
            fontSize: '1.08rem',
            letterSpacing: '0.02em',
          }}
        >
          {block.content}
        </div>
      );

    default:
      return null;
  }
}

/**
 * Code Block with Copy Button and Syntax Header.
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
        margin: '1.25rem 0',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #334155',
        background: '#0a0f1d',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.45rem 0.9rem',
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid #1e293b',
          fontSize: '0.75rem',
          color: '#94a3b8',
          textTransform: 'uppercase',
          fontWeight: 600,
          letterSpacing: '0.05em',
        }}
      >
        <span>{lang}</span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: 'transparent',
            border: 'none',
            color: copied ? '#34d399' : '#94a3b8',
            cursor: 'pointer',
            fontSize: '0.75rem',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            transition: 'color 0.15s ease',
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '1rem',
          overflowX: 'auto',
          color: '#e2e8f0',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '0.85rem',
          lineHeight: 1.6,
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Alert Callouts (> [!NOTE], > [!IMPORTANT], > [!WARNING], > [!TIP]).
 */
function AlertCallout({ alertType, content, onNavigate }) {
  const configs = {
    NOTE: {
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.09)',
      border: '#0284c7',
      icon: Info,
      title: 'Note',
    },
    TIP: {
      color: '#34d399',
      bg: 'rgba(52, 211, 153, 0.09)',
      border: '#059669',
      icon: Lightbulb,
      title: 'Tip',
    },
    IMPORTANT: {
      color: '#fbbf24',
      bg: 'rgba(251, 191, 36, 0.09)',
      border: '#d97706',
      icon: AlertTriangle,
      title: 'Important',
    },
    WARNING: {
      color: '#f87171',
      bg: 'rgba(248, 113, 113, 0.09)',
      border: '#dc2626',
      icon: AlertTriangle,
      title: 'Warning',
    },
    CAUTION: {
      color: '#f43f5e',
      bg: 'rgba(244, 63, 94, 0.09)',
      border: '#e11d48',
      icon: ShieldAlert,
      title: 'Caution',
    },
  };

  const config = configs[alertType] || configs.NOTE;
  const IconComponent = config.icon;

  return (
    <div
      style={{
        margin: '1.4rem 0',
        padding: '1rem 1.25rem',
        borderRadius: '8px',
        background: config.bg,
        borderLeft: `4px solid ${config.border}`,
        borderTop: '1px solid rgba(51, 65, 85, 0.4)',
        borderRight: '1px solid rgba(51, 65, 85, 0.4)',
        borderBottom: '1px solid rgba(51, 65, 85, 0.4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 700,
          color: config.color,
          fontSize: '0.88rem',
          marginBottom: '0.45rem',
          letterSpacing: '0.02em',
        }}
      >
        <IconComponent size={17} />
        <span>{config.title}</span>
      </div>
      <div style={{ color: '#cbd5e1', fontSize: '0.92rem', lineHeight: 1.65 }}>
        {renderInline(content, onNavigate)}
      </div>
    </div>
  );
}

/**
 * Markdown Table Renderer.
 */
function MarkdownTable({ lines, onNavigate }) {
  if (lines.length < 2) return null;

  const headerLine = lines[0];
  const bodyLines = lines.slice(2); // Skip separator line |---|---|

  const parseCells = (line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());

  const headers = parseCells(headerLine);

  return (
    <div
      style={{
        margin: '1.4rem 0',
        overflowX: 'auto',
        borderRadius: '8px',
        border: '1px solid #334155',
        background: '#0d1527',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.86rem',
          textAlign: 'left',
        }}
      >
        <thead>
          <tr style={{ background: 'rgba(30, 41, 59, 0.85)', borderBottom: '2px solid #334155' }}>
            {headers.map((h, idx) => (
              <th
                key={idx}
                style={{
                  padding: '0.75rem 1rem',
                  color: '#f8fafc',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {renderInline(h, onNavigate)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyLines.map((rowLine, rIdx) => {
            const cells = parseCells(rowLine);
            return (
              <tr
                key={rIdx}
                style={{
                  borderBottom: '1px solid rgba(51, 65, 85, 0.45)',
                  background: rIdx % 2 === 0 ? 'transparent' : 'rgba(15, 23, 42, 0.4)',
                }}
              >
                {cells.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    style={{
                      padding: '0.65rem 1rem',
                      color: '#cbd5e1',
                      lineHeight: 1.55,
                    }}
                  >
                    {renderInline(cell, onNavigate)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Parses inline formatting: bold, italic, inline code, provenance badges, links, and math.
 */
function renderInline(text, onNavigateChapter) {
  if (!text) return null;

  // Tokenize string by links, badges, code, bold, italic
  const parts = [];
  let lastIndex = 0;

  // Regex combining inline tokens:
  // 1. Provenance Badges: [Badge Text]
  // 2. Inline Code: `code`
  // 3. Bold: **text**
  // 4. Links: [text](url)
  // 5. Italic: *text*
  // 6. Math: $math$
  const tokenRegex = /(\[(?:From Pan & Tompkins \(1985\)|Current Codebase Implementation|Application-Specific Heuristic|Cardiovascular Electrophysiology|Application-Specific Design Choice|Cardiological Standards & Codebase Implementation|From Pan & Tompkins \(1985\) & Current Codebase Implementation|From Pan & Tompkins \(1985\) & Application-Specific Heuristic|Cardiovascular Electrophysiology & Pan-Tompkins 1985|Cardiovascular Electrophysiology & Codebase Implementation|Current Codebase Implementation & Cardiological Standards|Current Codebase Implementation & Cardiovascular Electrophysiology)\]|`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\*[^*]+\*|\$[^$]+\$)/g;

  let match;
  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];

    // Provenance Badge
    if (token.startsWith('[') && token.endsWith(']') && token.includes('(') === false && !token.includes('](')) {
      parts.push(renderProvenanceBadge(token.slice(1, -1)));
    }
    // Inline Code
    else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          style={{
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid #334155',
            color: '#38bdf8',
            padding: '0.15rem 0.35rem',
            borderRadius: '4px',
            fontSize: '0.85em',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    // Bold
    else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} style={{ color: '#f8fafc', fontWeight: 600 }}>
          {token.slice(2, -2)}
        </strong>
      );
    }
    // Italic
    else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={match.index} style={{ color: '#94a3b8' }}>
          {token.slice(1, -1)}
        </em>
      );
    }
    // Links [text](url)
    else if (token.startsWith('[') && token.includes('](')) {
      const linkMatch = token.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        const label = linkMatch[1];
        const href = linkMatch[2];

        // Check if internal doc link (e.g. 02_ecg_fundamentals.md)
        const isDocLink = href.endsWith('.md');
        parts.push(
          <a
            key={match.index}
            href={href}
            onClick={(e) => {
              if (isDocLink && onNavigateChapter) {
                e.preventDefault();
                onNavigateChapter(href);
              }
            }}
            style={{
              color: '#38bdf8',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {label}
            {!isDocLink && (
              <ExternalLink size={12} style={{ display: 'inline', marginLeft: 3, verticalAlign: 'middle' }} />
            )}
          </a>
        );
      }
    }
    // Math $...$
    else if (token.startsWith('$') && token.endsWith('$')) {
      parts.push(
        <span
          key={match.index}
          style={{
            fontFamily: 'KaTeX_Math, Times New Roman, serif',
            fontStyle: 'italic',
            color: '#f8fafc',
            padding: '0 0.15rem',
          }}
        >
          {token.slice(1, -1)}
        </span>
      );
    } else {
      parts.push(token);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

/**
 * Renders Scientific Provenance Badges with appropriate color schemes.
 */
function renderProvenanceBadge(badgeText) {
  let bg = 'rgba(59, 130, 246, 0.14)';
  let border = '#3b82f6';
  let text = '#60a5fa';

  if (badgeText.includes('Pan & Tompkins')) {
    bg = 'rgba(59, 130, 246, 0.16)';
    border = '#2563eb';
    text = '#60a5fa';
  } else if (badgeText.includes('Current Codebase')) {
    bg = 'rgba(16, 185, 129, 0.14)';
    border = '#059669';
    text = '#34d399';
  } else if (badgeText.includes('Application-Specific')) {
    bg = 'rgba(245, 158, 11, 0.14)';
    border = '#d97706';
    text = '#fbbf24';
  } else if (badgeText.includes('Cardiovascular') || badgeText.includes('Electrophysiology')) {
    bg = 'rgba(236, 72, 153, 0.14)';
    border = '#db2777';
    text = '#f472b6';
  }

  return (
    <span
      key={badgeText}
      style={{
        display: 'inline-block',
        fontSize: '0.72rem',
        fontWeight: 600,
        padding: '0.2rem 0.55rem',
        borderRadius: '9999px',
        background: bg,
        border: `1px solid ${border}`,
        color: text,
        margin: '0.35rem 0',
        letterSpacing: '0.03em',
        verticalAlign: 'middle',
      }}
    >
      {badgeText}
    </span>
  );
}
