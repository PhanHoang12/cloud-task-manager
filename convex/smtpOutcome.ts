// SMTP has no portable idempotency guarantee. Retry only definite non-acceptance.
export function smtpOutcome(error: unknown): 'retry' | 'failed' | 'uncertain' {
  const value = error as { responseCode?: number; command?: string; code?: string } | null;
  if (value?.responseCode && value.responseCode >= 500) return 'failed';
  if (value?.responseCode && value.responseCode >= 400 && value.responseCode < 500) return 'retry';
  if (value?.code === 'EAUTH' || value?.code === 'ECONFIG') return 'failed';
  if (/^(CONN|EHLO|HELO|STARTTLS|AUTH(?: .*)?|MAIL FROM|RCPT TO)$/.test(value?.command ?? '')) return 'retry';
  return 'uncertain';
}
