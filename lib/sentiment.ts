/**
 * Sentiment Analysis for News Headlines
 * 
 * Simple keyword-based sentiment scoring for stock-related news
 */

import { NewsAPIArticle, SentimentAnalysis } from '@/types/stock';

// Positive keywords that indicate good news
const POSITIVE_KEYWORDS = [
  'growth',
  'beats',
  'beat',
  'record',
  'strong',
  'profit',
  'innovation',
  'surge',
  'soar',
  'rally',
  'upgrade',
  'bullish',
  'gains',
  'positive',
  'success',
  'breakthrough',
  'outperform',
  'exceeds',
  'exceed',
  'higher',
  'rise',
  'boost',
];

// Negative keywords that indicate bad news
const NEGATIVE_KEYWORDS = [
  'lawsuit',
  'miss',
  'decline',
  'investigation',
  'drop',
  'warning',
  'falls',
  'fall',
  'plunge',
  'crash',
  'downgrade',
  'bearish',
  'loss',
  'losses',
  'negative',
  'concern',
  'concerns',
  'worry',
  'worries',
  'underperform',
  'weak',
  'disappointing',
  'lower',
];

/**
 * Analyze sentiment of a single text string
 * @param text - Title or description to analyze
 * @returns Sentiment score: +1 for positive, -1 for negative, 0 for neutral
 */
function analyzeSentiment(text: string): number {
  if (!text) return 0;
  
  const lowerText = text.toLowerCase();
  let score = 0;
  
  // Check for positive keywords
  for (const keyword of POSITIVE_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      score += 1;
      break; // Only count once per article to avoid over-weighting
    }
  }
  
  // Check for negative keywords
  for (const keyword of NEGATIVE_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      score -= 1;
      break; // Only count once per article
    }
  }
  
  return score;
}

/**
 * Analyze sentiment across multiple news articles
 * @param articles - Array of NewsAPI articles
 * @returns Complete sentiment analysis with score, counts, and breakdown
 */
export function analyzeNewsSentiment(articles: NewsAPIArticle[]): SentimentAnalysis {
  if (!articles || articles.length === 0) {
    return {
      newsScore: 10, // Neutral score (middle of 0-20 range)
      averageSentiment: 0,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      totalArticles: 0,
    };
  }
  
  let totalSentiment = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;
  
  // Analyze each article (title + description)
  for (const article of articles) {
    const titleSentiment = analyzeSentiment(article.title);
    const descSentiment = analyzeSentiment(article.description || '');
    
    // Combine title and description sentiment (title weighted higher)
    const articleSentiment = titleSentiment + (descSentiment * 0.5);
    
    totalSentiment += articleSentiment;
    
    // Categorize article
    if (articleSentiment > 0) {
      positiveCount++;
    } else if (articleSentiment < 0) {
      negativeCount++;
    } else {
      neutralCount++;
    }
  }
  
  // Calculate average sentiment (-1 to +1)
  const averageSentiment = articles.length > 0 
    ? totalSentiment / articles.length 
    : 0;
  
  // Normalize to -1 to +1 range (clamp extreme values)
  const normalizedSentiment = Math.max(-1, Math.min(1, averageSentiment));
  
  // Convert to 0-20 point score
  // -1 (very negative) = 0 points
  //  0 (neutral) = 10 points
  // +1 (very positive) = 20 points
  const newsScore = Math.round(((normalizedSentiment + 1) / 2) * 20);
  
  return {
    newsScore: Math.max(0, Math.min(20, newsScore)), // Ensure 0-20 range
    averageSentiment: normalizedSentiment,
    positiveCount,
    negativeCount,
    neutralCount,
    totalArticles: articles.length,
  };
}

/**
 * Get sentiment label for display
 * @param score - News sentiment score (0-20)
 * @returns Human-readable sentiment label
 */
export function getSentimentLabel(score: number): string {
  if (score >= 16) return 'Very Positive';
  if (score >= 12) return 'Positive';
  if (score >= 8) return 'Neutral';
  if (score >= 4) return 'Negative';
  return 'Very Negative';
}

/**
 * Get sentiment color for UI
 * @param score - News sentiment score (0-20)
 * @returns Tailwind color class
 */
export function getSentimentColor(score: number): string {
  if (score >= 16) return 'text-green-600 dark:text-green-400';
  if (score >= 12) return 'text-green-500 dark:text-green-500';
  if (score >= 8) return 'text-gray-600 dark:text-gray-400';
  if (score >= 4) return 'text-red-500 dark:text-red-500';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get sentiment background color for UI
 * @param score - News sentiment score (0-20)
 * @returns Tailwind background color class
 */
export function getSentimentBgColor(score: number): string {
  if (score >= 16) return 'bg-green-100 dark:bg-green-900/20';
  if (score >= 12) return 'bg-green-50 dark:bg-green-900/10';
  if (score >= 8) return 'bg-gray-100 dark:bg-gray-800';
  if (score >= 4) return 'bg-red-50 dark:bg-red-900/10';
  return 'bg-red-100 dark:bg-red-900/20';
}
