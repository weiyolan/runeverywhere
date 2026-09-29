/**
 * Web stand-in for @react-native-community/datetimepicker (no web support).
 * A native <input type="date|time"> opens the OS picker in iOS Safari and
 * Android Chrome. Same props/onChange shape as the subset our screens use.
 */
import { format } from 'date-fns';
import { useEffect, useRef } from 'react';

import { colors, fonts, radius } from '@/theme/theme';

interface Props {
  value: Date;
  mode: 'date' | 'time';
  minimumDate?: Date;
  maximumDate?: Date;
  onChange: (event: { type: 'set' | 'dismissed' }, date?: Date) => void;
}

export default function DateTimePicker({ value, mode, minimumDate, maximumDate, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const fmt = mode === 'date' ? 'yyyy-MM-dd' : 'HH:mm';

  useEffect(() => {
    input.current?.focus();
    try {
      input.current?.showPicker(); // desktop Chrome/Edge; mobile may refuse without a fresh tap
    } catch {
      // user taps the visible input instead
    }
  }, []);

  return (
    <input
      ref={input}
      type={mode}
      defaultValue={format(value, fmt)}
      min={mode === 'date' && minimumDate ? format(minimumDate, fmt) : undefined}
      max={mode === 'date' && maximumDate ? format(maximumDate, fmt) : undefined}
      onChange={(e) => {
        const v = e.currentTarget.value;
        if (!v) return;
        const next = new Date(value);
        if (mode === 'date') {
          const [y, m, d] = v.split('-').map(Number);
          next.setFullYear(y, m - 1, d);
        } else {
          const [h, min] = v.split(':').map(Number);
          next.setHours(h, min, 0, 0);
        }
        onChange({ type: 'set' }, next);
      }}
      onBlur={() => onChange({ type: 'dismissed' })}
      style={{
        fontFamily: fonts.body,
        fontSize: 16, // ≥16px stops iOS Safari zooming the page on focus
        padding: 12,
        borderRadius: radius.md,
        border: `1px solid ${colors.ink200}`,
        background: colors.paper,
        color: colors.ink900,
      }}
    />
  );
}
