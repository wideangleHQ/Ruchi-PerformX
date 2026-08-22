'use client';

/**
 * Renders an assistant answer.
 *
 * The model is told to use prose for a single fact and a markdown table once
 * there are more than three rows, so those are the only two shapes handled
 * here: paragraphs, and pipe tables.
 *
 * ponytail: no markdown dependency for two constructs. If the model starts
 * reaching for lists, headings or links often enough to matter, that is the
 * moment to add react-markdown and delete this file, not before.
 */

interface Block {
  kind: 'text' | 'table';
  lines: string[];
}

const isTableRow = (line: string) => line.trim().startsWith('|');
const isDivider = (line: string) => /^\s*\|[\s:|-]+\|\s*$/.test(line);

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());

function blocksOf(answer: string): Block[] {
  const blocks: Block[] = [];
  for (const line of answer.split('\n')) {
    const kind: Block['kind'] = isTableRow(line) ? 'table' : 'text';
    const last = blocks[blocks.length - 1];
    if (last && last.kind === kind) last.lines.push(line);
    else blocks.push({ kind, lines: [line] });
  }
  return blocks;
}

export function AnswerText({ answer }: { answer: string }) {
  if (!answer) return null;

  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-800">
      {blocksOf(answer).map((block, i) => {
        if (block.kind === 'table') {
          const rows = block.lines.filter((l) => !isDivider(l)).map(cells);
          const [head, ...body] = rows;
          if (!head) return null;
          return (
            // Wide tables scroll inside the panel rather than widening it.
            <div key={i} className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-300 text-left">
                    {head.map((cell, c) => (
                      <th key={c} className="py-1 pr-3 font-medium text-slate-600">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, r) => (
                    <tr key={r} className="border-b border-slate-100">
                      {row.map((cell, c) => (
                        <td key={c} className="py-1 pr-3 tabular-nums">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        const text = block.lines.join('\n').trim();
        if (!text) return null;
        return (
          <p key={i} className="whitespace-pre-wrap">
            {text}
          </p>
        );
      })}
    </div>
  );
}
