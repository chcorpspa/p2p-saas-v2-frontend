'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

// ─── Context ──────────────────────────────────────────────────────────────────

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue>({
  value: '',
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
});

// ─── Root ─────────────────────────────────────────────────────────────────────

interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

function Select({ value, defaultValue = '', onValueChange, children }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);
  const controlled = value !== undefined;
  const currentValue = controlled ? value : internalValue;

  const handleChange = (v: string) => {
    if (!controlled) setInternalValue(v);
    onValueChange?.(v);
    setOpen(false);
  };

  // Close on outside click
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <SelectContext.Provider value={{ value: currentValue, onValueChange: handleChange, open, setOpen }}>
      <div ref={ref} className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

interface SelectTriggerProps {
  className?: string;
  children: React.ReactNode;
}

function SelectTrigger({ className, children }: SelectTriggerProps) {
  const { open, setOpen } = React.useContext(SelectContext);
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {children}
      <ChevronDown className={cn('h-4 w-4 opacity-50 transition-transform', open && 'rotate-180')} />
    </button>
  );
}

// ─── Value ────────────────────────────────────────────────────────────────────

function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = React.useContext(SelectContext);
  // Find label from children — we display the raw value if no match
  return <span className={cn(!value && 'text-muted-foreground')}>{value || placeholder}</span>;
}

// ─── Content ──────────────────────────────────────────────────────────────────

function SelectContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { open } = React.useContext(SelectContext);
  if (!open) return null;
  return (
    <div
      className={cn(
        'absolute z-50 top-full mt-1 w-full min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md',
        className,
      )}
    >
      <div className="p-1 max-h-60 overflow-auto">
        {children}
      </div>
    </div>
  );
}

// ─── Item ─────────────────────────────────────────────────────────────────────

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

function SelectItem({ value, children, className }: SelectItemProps) {
  const { value: selectedValue, onValueChange } = React.useContext(SelectContext);
  const isSelected = selectedValue === value;
  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={() => onValueChange(value)}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
        isSelected && 'bg-accent text-accent-foreground font-medium',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
