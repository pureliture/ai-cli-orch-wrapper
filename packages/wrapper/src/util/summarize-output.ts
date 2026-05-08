/**
 * Default provider output summarization.
 * Trims trailing whitespace and truncates to maxLength with a boundary marker.
 */
export function defaultSummarizeOutput(output: string, maxLength: number): string {
  const source = output.trimEnd();
  if (!source) return '(no provider output)';
  if (source.length <= maxLength) return source;
  return `${source.slice(0, maxLength).trimEnd()}\n...[truncated to ${maxLength} chars]`;
}
