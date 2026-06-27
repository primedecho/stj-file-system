import { useState } from 'react'
import { useFileSystem } from '../hooks/useFileSystem'
import { getFolderBreadcrumbs } from '../utils/tree'
import { ErrorAlert } from './ErrorAlert'
import { FolderTree } from './FolderTree'
import { LoadingSpinner } from './LoadingSpinner'
import { SearchPanel } from './SearchPanel'

export function FileExplorer() {
  const {
    folders,
    files,
    loading,
    refreshing,
    mutating,
    deletingFolderId,
    deletingFileId,
    error,
    apiConnected,
    clearError,
    refresh,
    createFolder,
    createFile,
    deleteFolder,
    deleteFile,
  } = useFileSystem()

  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [scopeSearchToFolder, setScopeSearchToFolder] = useState(false)

  const handleDeleteFolder = async (folderId: number) => {
    if (!confirm('Delete this folder and all its contents?')) return

    try {
      await deleteFolder(folderId)
      if (selectedFolderId === folderId) setSelectedFolderId(null)
    } catch {
      // error handled by hook
    }
  }

  const handleDeleteFile = async (fileId: number) => {
    if (!confirm('Delete this file?')) return

    try {
      await deleteFile(fileId)
    } catch {
      // error handled by hook
    }
  }

  const breadcrumbs =
    selectedFolderId != null ? getFolderBreadcrumbs(selectedFolderId, folders) : []

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">STJ File System</h1>
          <p className="mt-1 text-sm text-slate-500">
            Browse folders, create items at any level, and search files
          </p>
        </div>
        {apiConnected === null ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
            Checking API...
          </span>
        ) : (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              apiConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {apiConnected ? 'API connected' : 'API offline'}
          </span>
        )}
      </header>

      <SearchPanel
        folders={folders}
        selectedFolderId={selectedFolderId}
        scopeToSelection={scopeSearchToFolder}
        onScopeChange={setScopeSearchToFolder}
        disabled={loading}
      />

      {error && (
        <ErrorAlert
          message={error}
          onDismiss={clearError}
          onRetry={() => void refresh()}
        />
      )}

      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {(refreshing || mutating) && !loading && (
          <div className="absolute inset-0 z-10 flex items-start justify-center bg-white/60 pt-20">
            <LoadingSpinner
              size="sm"
              label={mutating ? 'Saving changes...' : 'Refreshing...'}
            />
          </div>
        )}

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-800">Selected: </span>
            {breadcrumbs.length > 0 ? (
              <nav aria-label="Folder breadcrumb" className="inline-flex flex-wrap items-center gap-1">
                {breadcrumbs.map((crumb, index) => (
                  <span key={crumb.id} className="inline-flex items-center gap-1">
                    {index > 0 && <span className="text-slate-400">/</span>}
                    <button
                      type="button"
                      onClick={() => setSelectedFolderId(crumb.id)}
                      className="rounded px-1 text-blue-700 hover:bg-blue-50 hover:underline"
                    >
                      {crumb.name}
                    </button>
                  </span>
                ))}
              </nav>
            ) : (
              <span>Click a folder to select it for search scoping</span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Hover a folder to add subfolders or files. Use + Root folder for top-level folders.
          </p>
        </div>

        <div className="min-h-[320px] p-4">
          {loading ? (
            <LoadingSpinner label="Loading folders and files..." />
          ) : (
            <FolderTree
              folders={folders}
              files={files}
              selectedFolderId={selectedFolderId}
              mutating={mutating}
              deletingFolderId={deletingFolderId}
              deletingFileId={deletingFileId}
              onSelectFolder={setSelectedFolderId}
              onCreateFolder={createFolder}
              onCreateFile={(name, folderId) => createFile(folderId, name)}
              onDeleteFolder={handleDeleteFolder}
              onDeleteFile={handleDeleteFile}
            />
          )}
        </div>
      </div>
    </div>
  )
}
