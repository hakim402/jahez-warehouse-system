export function photoSource(value: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === window.location.origin)
      ? url.href : undefined;
  } catch {
    return undefined;
  }
}
