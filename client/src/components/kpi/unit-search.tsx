'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { KpiUnit } from '@/api/kpi';
import { useKpiUnits } from '@/hooks/useKpi';

type Props = {
  /** The label already chosen, shown when the box is not being searched. */
  value: string;
  onSelect: (unit: { label: string; symbol: string }) => void;
};

/**
 * Type the number, then search for what it means.
 *
 * A dropdown of every unit in the company would be long enough that nobody
 * reads it, so this searches instead. Searching one currency returns the rest
 * of them, which is how somebody looking for a dirham finds it without knowing
 * the word.
 *
 * A department that needs a unit the library does not have types it and presses
 * enter. The typed label is stored on the KPI the same way a library one is, so
 * nothing downstream treats it differently.
 */
export function UnitSearch({ value, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { data: units = [] } = useKpiUnits(query);

  const choose = (unit: KpiUnit) => {
    onSelect({ label: unit.label, symbol: unit.symbol });
    setQuery('');
    setOpen(false);
  };

  const chooseTyped = () => {
    const typed = query.trim();
    if (!typed) return;
    onSelect({ label: typed, symbol: typed.slice(0, 12) });
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <Search size={16} className="absolute left-3 text-slate-400" />
        <Input
          className="pl-9"
          value={open ? query : value}
          placeholder="Search unit..."
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            // Enter inside a form would submit the KPI half filled in.
            event.preventDefault();
            const first = units[0];
            if (first) choose(first);
            else chooseTyped();
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
      </div>

      {open ? (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {units.map((unit) => (
            <button
              key={unit.code}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(unit)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="text-slate-800">{unit.label}</span>
              <span className="text-xs text-slate-400">
                {unit.symbol} · {unit.group}
              </span>
            </button>
          ))}
          {query.trim() && units.length === 0 ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={chooseTyped}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              Use &ldquo;{query.trim()}&rdquo; as a custom unit
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
