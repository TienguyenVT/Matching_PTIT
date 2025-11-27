'use client';

import { useState } from 'react';
import { useSearchCourses } from '@/hooks/use-search';

/**
 * Demo component showing debounced search
 * ✅ Only sends API request 300ms after user stops typing
 */
export default function SearchCoursesDemo() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // ✅ Debounced search - no API spam!
  const { data: results = [], isLoading, isFetching } = useSearchCourses({ 
    query: searchQuery 
  });

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm khóa học... (debounced 300ms)"
          className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        
        {/* Loading indicator */}
        {isFetching && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {/* Status message */}
      <div className="mt-2 text-sm text-gray-500">
        {searchQuery.length > 0 && searchQuery.length < 2 && (
          <p>Nhập ít nhất 2 ký tự để tìm kiếm</p>
        )}
        {isFetching && <p>🔍 Đang tìm kiếm...</p>}
        {!isFetching && results.length > 0 && (
          <p>✅ Tìm thấy {results.length} khóa học</p>
        )}
        {!isFetching && searchQuery.length >= 2 && results.length === 0 && (
          <p>❌ Không tìm thấy kết quả</p>
        )}
      </div>

      {/* Results */}
      <div className="mt-4 space-y-2">
        {results.map((course: any) => (
          <div 
            key={course.id}
            className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <h3 className="font-semibold text-gray-900">{course.title}</h3>
            {course.description && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                {course.description}
              </p>
            )}
            {course.level && (
              <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                {course.level}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
          <p><strong>Query typed:</strong> {searchQuery}</p>
          <p><strong>Status:</strong> {isFetching ? 'Fetching...' : 'Idle'}</p>
          <p><strong>Results:</strong> {results.length}</p>
          <p className="text-green-600 mt-1">
            ✅ API only called 300ms after typing stops (debounced)
          </p>
        </div>
      )}
    </div>
  );
}
