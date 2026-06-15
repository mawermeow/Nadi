export function normalizeRange(from: Date, to: Date) {
  if (from > to) {
    throw new Error('Invalid date range');
  }

  return {
    from,
    to,
  };
}
