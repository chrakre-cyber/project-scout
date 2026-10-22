export const PATTERNS: [RegExp, string][];
export function loadLiterals(file?: string): string[];
export function sanitizeText(text: string, literals?: string[]): string;
export function hasLeak(text: string, literals?: string[]): boolean;
