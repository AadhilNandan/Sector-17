/**
 * Utility for conditionally joining class names
 */
export type ClassValue = string | number | boolean | bigint | undefined | null | { [key: string]: any };

export function cn(...classes: (ClassValue | ClassValue[] | undefined | null)[]): string {
  const result: string[] = [];

  for (const item of classes) {
    if (!item) continue;

    if (Array.isArray(item)) {
      const nested = cn(...item);
      if (nested) result.push(nested);
    } else if (typeof item === 'object') {
      for (const [key, val] of Object.entries(item)) {
        if (val && key) result.push(key);
      }
    } else if (typeof item === 'string' && item.trim()) {
      result.push(item.trim());
    }
  }

  return result.join(' ');
}
