/**
 * Word hint masking — turns the secret Word into a length-preserving mask
 * shown to Guessers above the canvas.
 *
 * Validates Requirements 7.2, 7.3:
 *  - Letters and digits (Unicode-aware) become an underscore (Req 7.2).
 *  - Spaces are preserved as spaces (rendered with a wider visual gap by
 *    the WordHint component) and hyphens are preserved as hyphens (Req 7.2).
 *  - Other punctuation passes through unchanged so a hint like
 *    "It's me!" reveals the structural punctuation but hides the letters.
 *  - Output length always equals input length (Property 12).
 */

/**
 * Build the visual hint shown to Guessers for the supplied `word`.
 *
 * The function walks the word grapheme-by-grapheme using the regex
 * `\p{L}|\p{N}` (Unicode-aware letter and number classes). Anything matching
 * is replaced with `_`; everything else (spaces, hyphens, apostrophes, etc.)
 * is preserved as-is. Length is preserved code-unit-for-code-unit so the
 * underscores line up with the original word in fixed-width contexts.
 *
 * @param word - The secret word to mask.
 * @returns The masked hint, with the same length as `word`.
 */
export function buildHint(word: string): string {
  // /u enables Unicode property escapes; /g lets `replace` walk every match.
  // We replace each individual character (not grapheme cluster) so the
  // output length always equals the input length, which keeps positions
  // aligned for the WordHint component's letter slots.
  return word.replace(/\p{L}|\p{N}/gu, '_');
}
