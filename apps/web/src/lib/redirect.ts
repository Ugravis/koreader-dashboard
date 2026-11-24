/** Keeps only same-site relative paths, to avoid open redirects. */
export function safeRedirect(value: string | string[] | undefined, fallback = '/dashboard') {
  const path = Array.isArray(value) ? value[0] : value
  return path && path.startsWith('/') && !path.startsWith('//') ? path : fallback
}
