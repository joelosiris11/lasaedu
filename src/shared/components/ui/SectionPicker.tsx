import { useState, useMemo } from 'react';
import {
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
} from '@headlessui/react';
import { ChevronDown, Check, Search } from 'lucide-react';
import type { DBSection } from '@shared/services/dataService';

interface SectionPickerProps {
  sections: DBSection[];
  value: string;
  onChange: (sectionId: string) => void;
  placeholder?: string;
  includeAllOption?: boolean;
  allOptionLabel?: string;
  disabled?: boolean;
  className?: string;
}

interface SectionOption {
  id: string;
  label: string;
  sub: string;
  courseTitle: string;
  isAll?: boolean;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es-DO', {
    month: 'short',
    year: 'numeric',
  });
}

export function SectionPicker({
  sections,
  value,
  onChange,
  placeholder = 'Seleccionar seccion...',
  includeAllOption = false,
  allOptionLabel = 'Todas las secciones',
  disabled = false,
  className = '',
}: SectionPickerProps) {
  const [query, setQuery] = useState('');

  const options = useMemo((): SectionOption[] => {
    const items: SectionOption[] = sections.map(s => ({
      id: s.id,
      label: `${s.courseTitle} — ${s.title}`,
      sub: `${s.instructorName} · ${formatDate(s.startDate)}`,
      courseTitle: s.courseTitle,
    }));

    // Sort by courseTitle, then by title
    items.sort((a, b) => a.label.localeCompare(b.label, 'es'));

    if (includeAllOption) {
      items.unshift({
        id: 'all',
        label: allOptionLabel,
        sub: '',
        courseTitle: '',
        isAll: true,
      });
    }

    return items;
  }, [sections, includeAllOption, allOptionLabel]);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(
      o =>
        o.isAll ||
        o.label.toLowerCase().includes(q) ||
        o.sub.toLowerCase().includes(q)
    );
  }, [options, query]);

  // Group by courseTitle for display
  const grouped = useMemo(() => {
    const groups: { course: string; items: SectionOption[] }[] = [];
    let currentCourse = '';

    for (const item of filtered) {
      if (item.isAll) {
        groups.push({ course: '', items: [item] });
        continue;
      }
      if (item.courseTitle !== currentCourse) {
        currentCourse = item.courseTitle;
        groups.push({ course: currentCourse, items: [] });
      }
      groups[groups.length - 1].items.push(item);
    }

    return groups;
  }, [filtered]);

  const selected = options.find(o => o.id === value);

  return (
    <Combobox
      value={value}
      onChange={(val) => {
        if (val !== null) onChange(val);
      }}
      disabled={disabled}
    >
      <div className={`relative ${className}`}>
        <div className="relative">
          <ComboboxInput
            className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            displayValue={() => selected?.label ?? ''}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2.5">
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </ComboboxButton>
        </div>

        <ComboboxOptions className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg bg-white border border-gray-200 shadow-lg focus:outline-none">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              No se encontraron secciones.
            </div>
          ) : (
            grouped.map((group, gi) => (
              <div key={gi}>
                {group.course && (
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 sticky top-0">
                    {group.course}
                  </div>
                )}
                {group.items.map(option => (
                  <ComboboxOption
                    key={option.id}
                    value={option.id}
                    className="group flex items-center gap-2 px-3 py-2 text-sm cursor-pointer data-[focus]:bg-red-50 data-[selected]:bg-red-50"
                  >
                    <Check className="h-3.5 w-3.5 text-red-600 opacity-0 group-data-[selected]:opacity-100 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-900 truncate text-sm font-medium group-data-[focus]:text-red-700">
                        {option.isAll ? option.label : option.label.split(' — ')[1] || option.label}
                      </p>
                      {option.sub && (
                        <p className="text-xs text-gray-400 truncate">{option.sub}</p>
                      )}
                    </div>
                  </ComboboxOption>
                ))}
              </div>
            ))
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
