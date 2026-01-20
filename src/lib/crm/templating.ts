import { BulkRecipient } from './types';

const DEFAULT_FALLBACKS = {
  first_name: 'der',
  last_name: '',
  initials: '?',
  company_name: 'din virksomhed',
};

export function buildInitials(firstName?: string, lastName?: string) {
  const first = firstName?.trim().charAt(0) || '';
  const last = lastName?.trim().charAt(0) || '';
  const combined = `${first}${last}`.toUpperCase();
  return combined || DEFAULT_FALLBACKS.initials;
}

export function renderBulkTemplate(
  template: string,
  recipient: BulkRecipient,
  fallbacks?: Partial<typeof DEFAULT_FALLBACKS>
) {
  const resolvedFallbacks = { ...DEFAULT_FALLBACKS, ...fallbacks };
  const tokens = {
    first_name: recipient.first_name || resolvedFallbacks.first_name,
    last_name: recipient.last_name || resolvedFallbacks.last_name,
    initials: buildInitials(recipient.first_name, recipient.last_name),
    company_name: recipient.company_name || resolvedFallbacks.company_name,
  };

  return template.replace(
    /{{\s*(first_name|last_name|initials|company_name)\s*}}/g,
    (_, token: keyof typeof tokens) => tokens[token] || ''
  );
}

