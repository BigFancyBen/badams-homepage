export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-xs p-6 mb-6 animate-pulse">
          <div className="h-8 bg-gray-200 rounded-sm w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded-sm w-2/3"></div>
        </div>
        
        <div className="bg-white rounded-lg shadow-xs p-6 mb-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded-sm w-1/4 mb-4"></div>
          <div className="flex gap-2 mb-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 w-16 bg-gray-200 rounded-sm"></div>
            ))}
          </div>
          <div className="flex gap-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 w-20 bg-gray-200 rounded-sm"></div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-xs p-6">
          <div className="h-6 bg-gray-200 rounded-sm w-1/6 mb-4"></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {[...Array(24)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-488/680 bg-gray-200 rounded-lg mb-2"></div>
                <div className="h-4 bg-gray-200 rounded-sm mb-1"></div>
                <div className="h-3 bg-gray-200 rounded-sm w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
