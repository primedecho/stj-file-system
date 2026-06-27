import { useState } from 'react'

interface InlineCreateFormProps {
  placeholder: string
  submitLabel: string
  disabled?: boolean
  onSubmit: (name: string) => Promise<void>
  onCancel: () => void
}

export function InlineCreateForm({
  placeholder,
  submitLabel,
  disabled = false,
  onSubmit,
  onCancel,
}: InlineCreateFormProps) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || submitting) return

    setSubmitting(true)
    try {
      await onSubmit(trimmed)
      setName('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 py-1">
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || submitting}
        className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50"
      />
      <button
        type="submit"
        disabled={disabled || submitting || !name.trim()}
        className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {submitting ? '...' : submitLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
      >
        Cancel
      </button>
    </form>
  )
}
