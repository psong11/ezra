/**
 * Word Explanation Sidebar Component
 * Fixed sidebar that displays word explanation with close button
 * Stays visible even when scrolling
 */

interface WordExplanationSidebarProps {
  word: string;
  explanation: string | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

export default function WordExplanationSidebar({ 
  word, 
  explanation, 
  isLoading, 
  error, 
  onClose 
}: WordExplanationSidebarProps) {
  return (
    <div className="fixed right-0 top-0 h-screen w-full md:w-80 lg:w-96 bg-white shadow-2xl z-50 overflow-y-auto border-l-4 border-amber-500">
      {/* Header with close button */}
      <div className="sticky top-0 bg-amber-600 text-white p-4 flex items-center justify-between z-10">
        <div className="flex-1">
          <h3 className="text-lg font-semibold">Word Analysis</h3>
          {!isLoading && !error && (
            <p className="text-sm text-amber-100 mt-1 truncate" dir="ltr">{word}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-4 w-8 h-8 flex items-center justify-center bg-white text-amber-600 rounded-full hover:bg-amber-50 transition-colors flex-shrink-0"
          aria-label="Close word explanation"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path 
              fillRule="evenodd" 
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
              clipRule="evenodd" 
            />
          </svg>
        </button>
      </div>

      {/* Content area */}
      <div className="p-6">
        {isLoading && (
          <div className="flex flex-col items-center justify-center space-y-4 py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-amber-600"></div>
            <span className="text-gray-600">Loading explanation...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <div className="font-semibold text-red-800 mb-2">Error</div>
            <div className="text-sm text-red-600">{error}</div>
          </div>
        )}

        {explanation && !isLoading && !error && (
          <div 
            className="text-left text-base leading-relaxed break-words prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-900 prose-strong:text-gray-900"
            style={{ color: '#000000' }}
            dir="ltr"
            dangerouslySetInnerHTML={{ __html: explanation }}
          />
        )}
      </div>
    </div>
  );
}
