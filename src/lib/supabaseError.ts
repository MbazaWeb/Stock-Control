export function getSupabaseErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object') {
    const maybeError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [maybeError.message, maybeError.details, maybeError.hint].filter(Boolean);
    if (parts.length > 0) {
      const combined = parts.join(' ');

      if (/column .* does not exist|Could not find the .* column/i.test(combined)) {
        return `${combined} Run the latest audits migration in Supabase.`;
      }

      return combined;
    }

    if (maybeError.code) {
      return `${fallback} (${maybeError.code})`;
    }
  }

  return fallback;
}