// Format validation utilities for stock management

// Stock types
export const STOCK_TYPES = ['Full Set', 'Decoder Only'] as const;
export type StockType = typeof STOCK_TYPES[number];

// Smartcard format: 82 followed by 8 digits (10 digits total)
export const SMARTCARD_REGEX = /^82\d{8}$/;
export const SMARTCARD_PREFIX = '82';
export const SMARTCARD_LENGTH = 10;

// Serial number format: S075 or S076 followed by 6-8 characters (digits or 'X')
// Examples accepted: S076482052 (10 chars), S076482052X5 (12 chars)
export const SERIAL_REGEX = /^S07(?:5|6)[0-9X]{6,8}$/i;
export const SERIAL_PREFIX = 'S07X';
export const SERIAL_LENGTH = 12; // nominal max length

export function validateSmartcard(value: string): { valid: boolean; message?: string } {
  if (!value) {
    return { valid: false, message: 'Smartcard number is required' };
  }
  if (!SMARTCARD_REGEX.test(value)) {
    return { valid: false, message: 'Format: 82 followed by 8 digits (e.g., 8212345678)' };
  }
  return { valid: true };
}

export function validateSerialNumber(value: string): { valid: boolean; message?: string } {
  if (!value) {
    return { valid: false, message: 'Serial number is required' };
  }
  const upperValue = value.toUpperCase();
  if (!SERIAL_REGEX.test(upperValue)) {
    return { valid: false, message: 'Format: S075 or S076 followed by 6–8 digits (X allowed), e.g. S076482052 or S076482052X5' };
  }
  return { valid: true };
}

export function formatSmartcardHint(): string {
  return `Format: ${SMARTCARD_PREFIX}XXXXXXXX (${SMARTCARD_LENGTH} digits)`;
}

export function formatSerialHint(): string {
  return `Format: S075/S076 plus 6–8 characters (digits, optional 'X'), e.g. S076482052 or S076482052X5`;
}
