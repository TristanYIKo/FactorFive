/**
 * Utility functions for formatting numbers and currency
 */

/**
 * Format large numbers dynamically
 * - Uses Trillions (T) for values >= 1,000,000,000,000
 * - Uses Billions (B) for values >= 1,000,000,000
 * - Uses Millions (M) for values >= 1,000,000
 * - Uses Thousands (K) for values >= 1,000
 * - Returns raw number for smaller values
 * 
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with appropriate suffix
 * 
 * @example
 * formatLargeNumber(2500000000000) // "2.50T"
 * formatLargeNumber(1500000000) // "1.50B"
 * formatLargeNumber(450000000) // "450.00M"
 * formatLargeNumber(50000) // "50.00K"
 */
export function formatLargeNumber(value: number, decimals: number = 2): string {
  if (value >= 1_000_000_000_000) {
    // Trillions
    return `${(value / 1_000_000_000_000).toFixed(decimals)}T`;
  } else if (value >= 1_000_000_000) {
    // Billions
    return `${(value / 1_000_000_000).toFixed(decimals)}B`;
  } else if (value >= 1_000_000) {
    // Millions
    return `${(value / 1_000_000).toFixed(decimals)}M`;
  } else if (value >= 1_000) {
    // Thousands
    return `${(value / 1_000).toFixed(decimals)}K`;
  } else {
    // Small numbers
    return value.toFixed(decimals);
  }
}

/**
 * Format currency with dynamic scaling
 * Adds $ prefix to formatLargeNumber output
 * 
 * @param value - The number to format as currency
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency string
 * 
 * @example
 * formatCurrency(2500000000000) // "$2.50T"
 * formatCurrency(1500000000) // "$1.50B"
 * formatCurrency(450000000) // "$450.00M"
 */
export function formatCurrency(value: number, decimals: number = 2): string {
  return `$${formatLargeNumber(value, decimals)}`;
}

/**
 * Format market cap specifically
 * Market cap from Finnhub comes in millions, so multiply by 1,000,000
 * 
 * @param marketCapInMillions - Market cap value (Finnhub format)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted market cap string
 * 
 * @example
 * formatMarketCap(2500000) // "$2.50T" (2.5M millions = 2.5T)
 * formatMarketCap(500000) // "$500.00B" (500K millions = 500B)
 * formatMarketCap(2500) // "$2.50B" (2500 millions = 2.5B)
 * formatMarketCap(450) // "$450.00M"
 */
export function formatMarketCap(marketCapInMillions: number, decimals: number = 2): string {
  const actualValue = marketCapInMillions * 1_000_000; // Convert to actual dollars
  return formatCurrency(actualValue, decimals);
}
