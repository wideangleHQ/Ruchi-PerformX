export function extractPhoneDigits(value: string): string {
  return value.replace(/\D+/g, '');
}

export function normalizePhoneNumber(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const prefix = trimmed.startsWith('+') ? '+' : '';
  const digits = extractPhoneDigits(trimmed);

  return digits ? `${prefix}${digits}` : '';
}

export function maskPhoneNumber(value: string): string {
  const digits = extractPhoneDigits(value);
  if (digits.length <= 4) {
    return digits;
  }

  const visible = digits.slice(-4);
  return `${'*'.repeat(digits.length - 4)}${visible}`;
}

