'use client';

const variants = {
  default: 'bg-slate-100  text-slate-600',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100  text-amber-700',
  danger:  'bg-red-100    text-red-700',
  info:    'bg-blue-100   text-blue-700',
};

const sizes = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-[10px]',
  lg: 'px-3 py-1 text-xs',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-widest ${variants[variant] || variants.default} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const map = {
    draft:  { variant: 'warning', label: 'Draft'  },
    active: { variant: 'success', label: 'Active' },
    closed: { variant: 'default', label: 'Closed' },
  };
  const { variant, label } = map[status] || map.draft;
  return <Badge variant={variant}>{label}</Badge>;
}

export function VotedBadge() {
  return (
    <Badge variant="primary" className="gap-1">
      <span className="material-symbols-outlined" style={{ fontSize: '11px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
      Voted
    </Badge>
  );
}
