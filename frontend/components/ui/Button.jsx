'use client';

export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  onClick,
  ...props
}) {
  const base = 'inline-flex items-center justify-center font-headline font-bold rounded-xl transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary:   'btn-gradient text-on-primary shadow hover:opacity-90',
    secondary: 'bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-low',
    danger:    'bg-error text-on-primary hover:opacity-90',
    outline:   'border-2 border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary',
    ghost:     'text-on-surface-variant hover:bg-surface-container',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3.5 text-sm gap-2',
  };

  const Spinner = () => (
    <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
