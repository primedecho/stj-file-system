import { useEffect, useState } from 'react'
import { api, ApiError, type FileItem, type Folder } from '../api'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { LoadingSpinner } from './LoadingSpinner'

const SEARCH_DEBOUNCE_MS = 300

interface SearchPanelProps {
  folders: Folder[]
  selectedFolderId: number | null
  scopeToSelection: boolean
  onScopeChange: (scoped: boolean) => void
  disabled?: boolean
}

export function SearchPanel({
  folders,
  selectedFolderId,
  scopeToSelection,
  onScopeChange,
  disabled = false,
}: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FileItem[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)

  useEffect(() => {
    const trimmed = debouncedQuery.trim()
    if (trimmed.length === 0) {
      setResults([])
      setSearching(false)
      setSearchError(null)
      return
    }

    let cancelled = false
    setSearching(true)
    setSearchError(null)

    void (async () => {
      try {
        const folderId = scopeToSelection ? selectedFolderId ?? undefined : undefined
        const matches = await api.searchFiles(trimmed, folderId)
        if (!cancelled) {
          setResults(matches)
          setSearchError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setResults([])
          setSearchError(
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : 'Search failed',
          )
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, scopeToSelection, selectedFolderId])

  const folderName = (folderId: number | null) =>
    folders.find((f) => f.id === folderId)?.name ?? 'Root'

  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files by name prefix..."
          disabled={disabled}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50"
        />
        <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={scopeToSelection}
            onChange={(e) => onScopeChange(e.target.checked)}
            disabled={selectedFolderId === null}
            className="rounded border-slate-300"
          />
          Current folder only
        </label>
      </div>

      {query.trim().length > 0 && (
        <div className="absolute z-10 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          {searching ? (
            <LoadingSpinner size="sm" label="Searching..." />
          ) : searchError ? (
            <p className="px-4 py-3 text-sm text-red-600">{searchError}</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">No matching files</p>
          ) : (
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
              {results.map((file) => (
                <li key={file.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="text-base" aria-hidden="true">📄</span>
                  <span className="font-medium text-slate-800">{file.name}</span>
                  <span className="ml-auto text-xs text-slate-400">
                    in {folderName(file.folder_id)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
