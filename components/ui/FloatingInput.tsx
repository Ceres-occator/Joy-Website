'use client';

import React, { useId } from 'react';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface FloatingInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  /** When true, strictly strips non-numeric characters and treats 0 as empty so users never have to erase "0" */
  numericOnly?: boolean;
  /** Allow decimal point when numericOnly is true */
  allowDecimal?: boolean;
  /** When true, displays empty string when numeric value is 0 so users can type directly */
  zeroAsEmpty?: boolean;
  /** Optional helper or validation error text */
  error?: string | null;
  helperText?: string | null;
}

export default function FloatingInput({
  label,
  value,
  onChange,
  numericOnly = false,
  allowDecimal = false,
  zeroAsEmpty = false,
  error = null,
  helperText = null,
  type = 'text',
  className = '',
  required,
  ...rest
}: FloatingInputProps) {
  const id = useId();

  // If zeroAsEmpty is enabled and value is 0 or '0', render empty string so the user doesn't have to backspace "0"
  const displayValue =
    zeroAsEmpty && (value === 0 || value === '0') ? '' : String(value ?? '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    if (numericOnly) {
      raw = allowDecimal ? raw.replace(/[^0-9.]/g, '') : raw.replace(/\D/g, '');
      if (!allowDecimal && raw.length > 1) {
        raw = raw.replace(/^0+/, '');
      }
    }
    onChange(raw);
  };

  const isEmailInvalid =
    type === 'email' &&
    displayValue.trim().length > 0 &&
    !EMAIL_REGEX.test(displayValue.trim());

  const activeError =
    error ||
    (isEmailInvalid ? 'Please enter a valid email address (e.g., name@example.com).' : null);

  return (
    <div className={`w-full relative z-0 ${className}`}>
      <div className="relative overflow-hidden rounded-[0.625rem]">
        <input
          id={id}
          type={numericOnly ? 'text' : type}
          inputMode={numericOnly ? (allowDecimal ? 'decimal' : 'numeric') : undefined}
          value={displayValue}
          onChange={handleChange}
          placeholder=" "
          required={required}
          className={`peer neu-input block w-full px-3.5 pt-6 pb-2 text-sm font-medium text-gray-900 dark:text-gray-100 placeholder-transparent ${
            activeError ? 'border-red-500 focus:border-red-500' : ''
          }`}
          {...rest}
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-3.5 right-3.5 top-2 z-10 truncate text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 transition-all duration-150 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-wider peer-focus:font-semibold peer-focus:text-emerald-600 dark:peer-focus:text-emerald-400"
        >
          {label}
          {required ? ' *' : ''}
        </label>
      </div>
      {activeError ? (
        <p className="mt-1.5 pl-1 text-[11px] font-medium text-red-600 dark:text-red-400">
          {activeError}
        </p>
      ) : helperText ? (
        <p className="mt-1.5 pl-1 text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
