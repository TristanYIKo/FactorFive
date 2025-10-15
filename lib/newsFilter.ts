/**
 * News Relevance Filtering
 * 
 * Filters and ranks news articles by relevance to a specific company
 * Prioritizes company-specific news over generic market news
 */

import { NewsAPIArticle } from '@/types/stock';

// Generic finance/market terms that indicate non-company-specific news
const GENERIC_MARKET_TERMS = [
  'stock market',
  'wall street',
  'nasdaq',
  'dow jones',
  's&p 500',
  'federal reserve',
  'fed',
  'interest rate',
  'inflation',
  'economy',
  'economic',
  'market update',
  'market news',
  'stocks to watch',
  'top stocks',
  'best stocks',
  'stock picks',
  'market wrap',
  'market close',
  'market open',
];

// Spam/irrelevant indicators
const SPAM_INDICATORS = [
  'sponsored',
  'advertisement',
  'promoted',
  'partner content',
  'stock alert',
  'trade now',
  'buy now',
  'subscribe',
];

/**
 * Calculate relevance score for a news article
 * @param article - NewsAPI article
 * @param companyName - Full company name (e.g., "Apple Inc.")
 * @param symbol - Stock ticker symbol (e.g., "AAPL")
 * @returns Relevance score (higher = more relevant)
 */
function calculateRelevanceScore(
  article: NewsAPIArticle,
  companyName: string,
  symbol: string
): number {
  const title = article.title?.toLowerCase() || '';
  const description = article.description?.toLowerCase() || '';
  const source = article.source?.name?.toLowerCase() || '';
  
  const companyLower = companyName.toLowerCase();
  const symbolLower = symbol.toLowerCase();
  
  // Extract first word of company name (e.g., "Apple" from "Apple Inc.")
  const companyFirstWord = companyName.split(' ')[0].toLowerCase();
  
  let score = 0;
  
  // HIGH RELEVANCE: Company name or ticker in title
  if (title.includes(symbolLower)) {
    score += 10; // Ticker in title is very specific
  }
  if (title.includes(companyLower)) {
    score += 8; // Full company name in title
  } else if (title.includes(companyFirstWord) && companyFirstWord.length > 3) {
    score += 6; // First word of company name (if not too short)
  }
  
  // MEDIUM RELEVANCE: Company name or ticker in description
  if (description.includes(symbolLower)) {
    score += 5;
  }
  if (description.includes(companyLower)) {
    score += 4;
  } else if (description.includes(companyFirstWord) && companyFirstWord.length > 3) {
    score += 3;
  }
  
  // BONUS: From reputable business/tech sources
  const reputableSources = [
    'bloomberg',
    'reuters',
    'cnbc',
    'financial times',
    'wall street journal',
    'wsj',
    'marketwatch',
    'seeking alpha',
    'barrons',
    'the verge',
    'techcrunch',
    'ars technica',
  ];
  
  if (reputableSources.some(src => source.includes(src))) {
    score += 2;
  }
  
  // PENALTIES: Generic market news (not company-specific)
  const hasGenericTermInTitle = GENERIC_MARKET_TERMS.some(term => title.includes(term));
  const hasGenericTermInDesc = GENERIC_MARKET_TERMS.some(term => description.includes(term));
  
  // Only penalize if generic terms appear WITHOUT company name
  if (hasGenericTermInTitle && !title.includes(companyLower) && !title.includes(symbolLower)) {
    score -= 5; // Generic market news in title
  }
  
  if (hasGenericTermInDesc && !description.includes(companyLower) && !description.includes(symbolLower)) {
    score -= 2; // Generic market news in description
  }
  
  // SPAM DETECTION: Heavily penalize promotional content
  const hasSpamInTitle = SPAM_INDICATORS.some(spam => title.includes(spam));
  const hasSpamInDesc = SPAM_INDICATORS.some(spam => description.includes(spam));
  
  if (hasSpamInTitle || hasSpamInDesc) {
    score -= 20; // Effectively filters out spam
  }
  
  return score;
}

/**
 * Filter and sort news articles by relevance
 * @param articles - Array of NewsAPI articles
 * @param companyName - Full company name
 * @param symbol - Stock ticker symbol
 * @param minScore - Minimum relevance score (default: 0, set higher to be more strict)
 * @returns Filtered and sorted articles (most relevant first)
 */
export function filterAndSortNewsByRelevance(
  articles: NewsAPIArticle[],
  companyName: string,
  symbol: string,
  minScore: number = 0
): NewsAPIArticle[] {
  if (!articles || articles.length === 0) {
    return [];
  }
  
  // Calculate relevance score for each article
  const scoredArticles = articles.map(article => ({
    article,
    score: calculateRelevanceScore(article, companyName, symbol),
  }));
  
  // Filter out low-relevance articles
  const filteredArticles = scoredArticles.filter(item => item.score >= minScore);
  
  // Sort by score (descending - highest first)
  filteredArticles.sort((a, b) => b.score - a.score);
  
  // Return just the articles (without scores)
  return filteredArticles.map(item => item.article);
}

/**
 * Categorize articles into company-specific and market news
 * @param articles - Array of NewsAPI articles
 * @param companyName - Full company name
 * @param symbol - Stock ticker symbol
 * @returns Object with companyNews and marketNews arrays
 */
export function categorizeNews(
  articles: NewsAPIArticle[],
  companyName: string,
  symbol: string
): { companyNews: NewsAPIArticle[]; marketNews: NewsAPIArticle[] } {
  const scoredArticles = articles.map(article => ({
    article,
    score: calculateRelevanceScore(article, companyName, symbol),
  }));
  
  // Company-specific: score >= 5 (has company name/ticker in title or description)
  const companyNews = scoredArticles
    .filter(item => item.score >= 5)
    .sort((a, b) => b.score - a.score)
    .map(item => item.article);
  
  // Market news: score < 5 but > 0 (related but not company-specific)
  const marketNews = scoredArticles
    .filter(item => item.score > 0 && item.score < 5)
    .sort((a, b) => b.score - a.score)
    .map(item => item.article);
  
  return { companyNews, marketNews };
}
