import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/** 0x1234…abcd */
export function short(value: string, head = 6, tail = 4) {
  return value.length <= head + tail + 2 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-line bg-panel', className)} {...rest} />;
}

export function CardHead({ title, right }: { title: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {right}
    </div>
  );
}

export function Tag({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted',
        className,
      )}
      {...rest}
    />
  );
}

export function BitBox({ on }: { on: boolean | undefined }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 w-5 items-center justify-center rounded font-mono text-xs font-semibold',
        on ? 'bg-accent text-accent-ink' : 'bg-low text-ink/70',
      )}
    >
      {on ? 1 : 0}
    </span>
  );
}

const variants = {
  primary: 'bg-accent text-accent-ink hover:brightness-110',
  secondary: 'bg-panel-2 text-ink border border-line hover:border-muted',
  ghost: 'text-muted hover:text-ink',
} as const;

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}

export function timeAgo(ms: number) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}
