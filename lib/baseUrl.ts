/**
 * Base URL helper for server-side API calls
 * 
 * vercel-ready: Provides correct base URL for both local dev and Vercel production
 * 
 * Usage:
 * - Client-side: Always use relative paths '/api/...' (no base URL needed)
 * - Server-side: Use getBaseUrl() + '/api/...' for absolute URLs
 * 
 * @returns {string} Base URL for the application
 * - Browser: Returns empty string (use relative paths)
 * - Vercel: Returns https://${VERCEL_URL}
 * - Local dev: Returns http://localhost:3000
 */
export function getBaseUrl(): string {
  // Browser context - use relative paths
  if (typeof window !== 'undefined') {
    return '';
  }

  // Vercel production/preview
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Local development fallback
  return 'http://localhost:3000';
}

/**
 * Check if running in Vercel environment
 */
export function isVercel(): boolean {
  return !!process.env.VERCEL;
}

/**
 * Get full API URL for server-side calls
 * 
 * @param path - API route path (e.g., '/api/stock')
 * @returns Full URL for API call
 */
export function getApiUrl(path: string): string {
  const base = getBaseUrl();
  return `${base}${path}`;
}
