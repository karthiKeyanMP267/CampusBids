import React from 'react';

/**
 * Lightweight, zero-dependency Markdown renderer designed specifically
 * for AI chat responses and rich assistant commentary.
 * Handles headings, bold/italics/strikethrough, bullet lists, numbered lists, checklists,
 * tables, blockquotes, code blocks, inline code, and links.
 */
export default function MarkdownRenderer({ content, className = '' }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let currentList = null; // { type: 'ul' | 'ol' | 'checklist', items: [] }
  let inCodeBlock = false;
  let codeBlockContent = [];
  let codeBlockLang = '';

  function flushList() {
    if (!currentList) return;
    if (currentList.type === 'ul') {
      elements.push(
        <ul key={`ul-${elements.length}`} className="my-2 space-y-1 pl-4 list-disc marker:text-purple-500">
          {currentList.items.map((item, idx) => (
            <li key={idx} className="text-xs leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
    } else if (currentList.type === 'checklist') {
      elements.push(
        <div key={`check-${elements.length}`} className="my-2 space-y-1.5 pl-1">
          {currentList.items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
              <input
                type="checkbox"
                readOnly
                checked={item.checked}
                className="mt-0.5 h-3.5 w-3.5 rounded border-surface-300 text-purple-600 focus:ring-purple-400"
              />
              <span className={item.checked ? 'line-through text-surface-400' : 'text-surface-800'}>
                {renderInline(item.text)}
              </span>
            </div>
          ))}
        </div>
      );
    } else {
      elements.push(
        <ol key={`ol-${elements.length}`} className="my-2 space-y-1 pl-4 list-decimal marker:text-purple-600 font-medium">
          {currentList.items.map((item, idx) => (
            <li key={idx} className="text-xs font-normal leading-relaxed text-surface-800">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
    }
    currentList = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks ```
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${elements.length}`}
            className="my-2 overflow-x-auto rounded-xl bg-surface-900 p-3 text-[11px] font-mono text-purple-200 border border-surface-800"
          >
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        );
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockLang = '';
      } else {
        flushList();
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Empty line -> flush list and insert vertical space
    if (!trimmed) {
      flushList();
      continue;
    }

    // Check if current line starts a Markdown Table
    if (trimmed.includes('|')) {
      const nextLine = (lines[i + 1] || '').trim();
      // Delimiter row matches patterns like |---|---| or |:---|:---:|---:| or ---|---
      const isTableSeparator =
        nextLine.includes('|') &&
        nextLine.split('|').filter((s) => s.trim().length > 0).every((s) => /^:?-+:?$/.test(s.trim()));

      if (isTableSeparator) {
        flushList();
        const rawHeaders = splitTableRow(trimmed);
        const sepCols = splitTableRow(nextLine);
        const alignments = sepCols.map((col) => {
          const c = col.trim();
          if (c.startsWith(':') && c.endsWith(':')) return 'text-center';
          if (c.endsWith(':')) return 'text-right';
          return 'text-left';
        });

        // Collect table rows
        const tableRows = [];
        i += 2; // skip header and delimiter lines
        while (i < lines.length) {
          const rowLine = lines[i].trim();
          if (!rowLine || !rowLine.includes('|')) {
            i--; // step back to allow outer loop to handle non-table line
            break;
          }
          tableRows.push(splitTableRow(rowLine));
          i++;
        }

        elements.push(
          <div
            key={`table-${elements.length}`}
            className="my-2.5 overflow-x-auto rounded-xl border border-surface-200 bg-white shadow-2xs"
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  {rawHeaders.map((header, hIdx) => (
                    <th
                      key={hIdx}
                      className={`py-2 px-3 font-semibold text-surface-900 ${alignments[hIdx] || 'text-left'}`}
                    >
                      {renderInline(header)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-150">
                {tableRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-purple-50/20 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`py-2 px-3 text-surface-700 ${alignments[cIdx] || 'text-left'}`}
                      >
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Checklists: - [ ] or - [x]
    const checklistMatch = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (checklistMatch) {
      if (!currentList || currentList.type !== 'checklist') {
        flushList();
        currentList = { type: 'checklist', items: [] };
      }
      currentList.items.push({
        checked: checklistMatch[1].toLowerCase() === 'x',
        text: checklistMatch[2],
      });
      continue;
    }

    // Bullet list: - or * or •
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(bulletMatch[1]);
      continue;
    }

    // Numbered list: 1. or 2)
    const numberedMatch = trimmed.match(/^(\d+)[\.\)]\s+(.*)$/);
    if (numberedMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(numberedMatch[2]);
      continue;
    }

    // Flush any ongoing list before non-list elements
    flushList();

    // Headings
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={`h4-${elements.length}`} className="mt-3 mb-1 text-xs font-bold text-surface-900 tracking-wide uppercase">
          {renderInline(trimmed.slice(4))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={`h3-${elements.length}`} className="mt-3.5 mb-1.5 text-sm font-bold text-surface-900">
          {renderInline(trimmed.slice(3))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={`h2-${elements.length}`} className="mt-4 mb-2 text-base font-bold text-surface-950">
          {renderInline(trimmed.slice(2))}
        </h2>
      );
      continue;
    }

    // Blockquote: >
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`quote-${elements.length}`}
          className="my-2 border-l-2 border-purple-500 bg-purple-50/50 py-1.5 px-3 rounded-r-lg text-xs italic text-surface-700"
        >
          {renderInline(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Horizontal Rule: --- or ***
    if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={`hr-${elements.length}`} className="my-2.5 border-surface-200" />);
      continue;
    }

    // Standard paragraph
    elements.push(
      <p key={`p-${elements.length}`} className="my-1 text-xs leading-relaxed text-surface-800">
        {renderInline(line)}
      </p>
    );
  }

  flushList();

  return <div className={`markdown-content space-y-0.5 ${className}`}>{elements}</div>;
}

/**
 * Splits a markdown table row by '|', stripping leading and trailing outer pipes
 */
function splitTableRow(line) {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|')) text = text.slice(0, -1);
  return text.split('|').map((col) => col.trim());
}

/**
 * Parses inline markdown: ***bold italic***, **bold**, *italic*, ~~strikethrough~~, `code`, [link](url)
 */
function renderInline(text) {
  if (typeof text !== 'string') return text;

  // Regex tokens: code, bold+italic, bold, italic, strikethrough, link
  const tokenRegex = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Inline code `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={index}
          className="rounded bg-surface-100 px-1.5 py-0.5 text-[11px] font-mono text-purple-700 border border-surface-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold + Italic ***text***
    if (part.startsWith('***') && part.endsWith('***') && part.length > 6) {
      return (
        <strong key={index} className="font-semibold text-surface-900 italic">
          {part.slice(3, -3)}
        </strong>
      );
    }

    // Bold **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={index} className="font-semibold text-surface-900">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic *text*
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={index} className="italic text-surface-700">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Strikethrough ~~text~~
    if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) {
      return (
        <del key={index} className="line-through text-surface-400">
          {part.slice(2, -2)}
        </del>
      );
    }

    // Link [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const url = linkMatch[2];
      const isAuction = url.startsWith('/auction/') || url.includes('/auction/');
      const isInternal = url.startsWith('/') || url.startsWith('#');
      return (
        <a
          key={index}
          href={url}
          target={isInternal ? undefined : '_blank'}
          rel={isInternal ? undefined : 'noopener noreferrer'}
          className={
            isAuction
              ? 'inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 px-2 py-0.5 rounded-lg transition-colors no-underline text-xs my-0.5 border border-purple-200'
              : 'text-purple-600 hover:text-purple-700 underline underline-offset-2 font-medium'
          }
        >
          {isAuction && <span aria-hidden="true">🏷️</span>}
          {linkMatch[1]}
        </a>
      );
    }

    return part;
  });
}
