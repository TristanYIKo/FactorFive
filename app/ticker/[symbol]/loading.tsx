/**
 * Loading state for ticker pages
 * Displayed while fetching stock data from API
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse">
          {/* Back button skeleton */}
          <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-6"></div>
          
          {/* Profile header skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
              <div className="flex-1">
                <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-64 mb-2"></div>
                <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-40"></div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20 mb-2"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Price and score panels skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-4"></div>
              <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-40 mb-4"></div>
              <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-32"></div>
            </div>
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-4"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          </div>

          {/* News skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-4"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6 mb-2"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-32"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
