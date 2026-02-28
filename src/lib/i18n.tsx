import React, { createContext, useContext, useMemo } from 'react';
import en from '@/messages/en.json';
import da from '@/messages/da.json';
import de from '@/messages/de.json';

export type Locale = 'en' | 'da' | 'de';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'da', 'de'];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as string[]).includes(value);
}

const messages: Record<Locale, Record<string, unknown>> = { en, da, de };

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return path;
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current === 'string') return current;
  return path;
}

interface I18nContextValue {
  locale: Locale;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  t: (key) => key,
});

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<I18nContextValue>(() => {
    const dict = messages[locale] ?? messages.en;
    return {
      locale,
      t: (key: string) => getNestedValue(dict, key),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function createTranslator(locale: Locale): (key: string) => string {
  const dict = messages[locale] ?? messages.en;
  return (key: string) => getNestedValue(dict, key);
}
