interface LoadingSpinnerProps {
  label?: string
  size?: 'sm' | 'md'
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-[3px]',
}

export function LoadingSpinner({ label, size = 'md' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6">
      <div
        className={`animate-spin rounded-full border-slate-200 border-t-blue-600 ${sizeClasses[size]}`}
        role="status"
        aria-label={label ?? 'Loading'}
      />
      {label && <p className="text-sm text-slate-500">{label}</p>}
    </div>
  )
}
