'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-screen bg-leftBarBg">
      <div className="text-center text-white p-8">
        <h2 className="text-2xl font-bold mb-4">حدث خطأ ما!</h2>
        <p className="mb-4 text-gray-400">
          {error.message || 'عذراً، حدث خطأ غير متوقع'}
        </p>
        <button
          onClick={() => reset()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          حاول مرة أخرى
        </button>
      </div>
    </div>
  )
}
