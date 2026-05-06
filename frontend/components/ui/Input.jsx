'use client';

import { forwardRef } from 'react';

const Input = forwardRef(({
  type = 'text',
  label,
  hint,
  error,
  icon,
  className = '',
  ...props
}, ref) => {
  const inputCls = `w-full px-4 py-3 bg-surface-container-low border rounded-xl text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${icon ? 'pl-10' : ''} ${error ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant'} ${className}`;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-on-surface mb-1.5">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant" style={{ fontSize: '18px' }}>
            {icon}
          </span>
        )}
        <input ref={ref} type={type} className={inputCls} {...props} />
      </div>
      {hint && !error && <p className="mt-1.5 text-xs text-on-surface-variant">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
