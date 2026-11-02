export function validateSearchQuery(query) {
  if (!query || typeof query !== 'string') {
    return { valid: false, error: 'Query must be a non-empty string' };
  }
  if (query.length < 1 || query.length > 100) {
    return { valid: false, error: 'Query must be between 1 and 100 characters' };
  }
  return { valid: true };
}
