import { useEffect } from 'react'
import { X, CheckCircle, AlertCircle } from 'lucide-react'

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed bottom-6 left-6 z-50 animate-slide-up">
      <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border-l-4 min-w-[300px] max-w-md ${
        type === 'success' 
          ? 'bg-green-50 border-green-500 text-green-800' 
          : 'bg-red-50 border-red-500 text-red-800'
      }`}>
        {type === 'success' ? (
          <CheckCircle size={22} className="text-green-600 shrink-0" />
        ) : (
          <AlertCircle size={22} className="text-red-600 shrink-0" />
        )}
        <p className="text-sm font-medium flex-1">{message}</p>
        <button
          onClick={onClose}
          className="p-1 hover:bg-black/5 rounded-lg transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

export default Toast