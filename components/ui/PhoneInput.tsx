'use client';

import React, { useId, useMemo } from 'react';

export interface CountryDialOption {
  code: string;
  dial: string;
  label: string;
  maxDigits: number;
}

export const COUNTRY_DIAL_OPTIONS: CountryDialOption[] = [
  { code: 'PH', dial: '+63', label: 'PH (+63)', maxDigits: 10 },
  { code: 'US', dial: '+1', label: 'US/CA (+1)', maxDigits: 10 },
  { code: 'SG', dial: '+65', label: 'SG (+65)', maxDigits: 8 },
  { code: 'AU', dial: '+61', label: 'AU (+61)', maxDigits: 9 },
  { code: 'GB', dial: '+44', label: 'UK (+44)', maxDigits: 10 },
  { code: 'JP', dial: '+81', label: 'JP (+81)', maxDigits: 10 },
  { code: 'KR', dial: '+82', label: 'KR (+82)', maxDigits: 10 },
  { code: 'AE', dial: '+971', label: 'UAE (+971)', maxDigits: 9 },
  { code: 'HK', dial: '+852', label: 'HK (+852)', maxDigits: 8 },
  { code: 'CN', dial: '+86', label: 'CN (+86)', maxDigits: 11 },
  { code: 'SA', dial: '+966', label: 'SA (+966)', maxDigits: 9 },
  { code: 'QA', dial: '+974', label: 'QA (+974)', maxDigits: 8 },
  { code: 'DE', dial: '+49', label: 'DE (+49)', maxDigits: 11 },
  { code: 'FR', dial: '+33', label: 'FR (+33)', maxDigits: 9 },
];

interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (fullPhone: string) => void;
  required?: boolean;
  helperText?: string;
}

export default function PhoneInput({
  label = 'Mobile Phone Number',
  value,
  onChange,
  required = false,
  helperText,
}: PhoneInputProps) {
  const id = useId();

  // Parse country dial prefix and local digits from value
  const { selectedCountry, localDigits } = useMemo(() => {
    const trimmed = (value || '').trim();
    const sorted = [...COUNTRY_DIAL_OPTIONS].sort((a, b) => b.dial.length - a.dial.length);
    for (const c of sorted) {
      if (trimmed.startsWith(c.dial)) {
        return {
          selectedCountry: c,
          localDigits: trimmed.slice(c.dial.length).replace(/\D/g, ''),
        };
      }
    }
    if (trimmed.startsWith('09') && trimmed.length <= 11) {
      return {
        selectedCountry: COUNTRY_DIAL_OPTIONS[0],
        localDigits: trimmed.slice(1).replace(/\D/g, ''),
      };
    }
    return {
      selectedCountry: COUNTRY_DIAL_OPTIONS[0],
      localDigits: trimmed.replace(/\D/g, ''),
    };
  }, [value]);

  const handleCountryChange = (newDial: string) => {
    const country =
      COUNTRY_DIAL_OPTIONS.find((c) => c.dial === newDial) || COUNTRY_DIAL_OPTIONS[0];
    const clipped = localDigits.slice(0, country.maxDigits);
    onChange(clipped ? `${country.dial}${clipped}` : country.dial);
  };

  const handleDigitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let digits = e.target.value.replace(/\D/g, '');
    if (selectedCountry.dial === '+63' && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    digits = digits.slice(0, selectedCountry.maxDigits);
    onChange(digits ? `${selectedCountry.dial}${digits}` : '');
  };

  return (
    <div className="w-full relative z-0">
      <div className="flex gap-2 items-stretch">
        <select
          aria-label="Country code"
          value={selectedCountry.dial}
          onChange={(e) => handleCountryChange(e.target.value)}
          className="neu-input px-3 text-base sm:text-sm font-medium text-gray-900 dark:text-gray-100 shrink-0 cursor-pointer"
        >
          {COUNTRY_DIAL_OPTIONS.map((c) => (
            <option key={c.code} value={c.dial}>
              {c.label}
            </option>
          ))}
        </select>

        <div className="relative flex-1 overflow-hidden rounded-md">
          <input
            id={id}
            type="tel"
            inputMode="numeric"
            value={localDigits}
            onChange={handleDigitsChange}
            placeholder=" "
            required={required}
            className="peer neu-input block w-full px-4 pt-6 pb-2 text-base sm:text-sm font-mono font-medium text-gray-900 dark:text-gray-100 placeholder-transparent"
          />
          <label
            htmlFor={id}
            className="pointer-events-none absolute left-4 right-4 top-2 z-10 truncate text-xs font-medium text-gray-600 dark:text-gray-300 transition-all duration-150 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-xs peer-focus:text-emerald-600 dark:peer-focus:text-emerald-400"
          >
            {label} ({selectedCountry.dial})
            {required ? ' *' : ''}
          </label>
        </div>
      </div>
      {helperText && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          {helperText}
        </p>
      )}
    </div>
  );
}
