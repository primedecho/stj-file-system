import { useMemo, useState } from 'react'
import type { FileItem, Folder } from '../api'
import { buildFilesByFolder, buildFoldersByParent } from '../utils/tree'
import { InlineCreateForm } from './InlineCreateForm'

type CreateTarget =
  | { kind: 'folder'; parentId: number | null }
  | { kind: 'file'; folderId: number }
  | null

interface FolderTreeProps {
  folders: Folder[]
  files: FileItem[]
  selectedFolderId: number | null
  mutating: boolean
  deletingFolderId: number | null
  deletingFileId: number | null
  onSelectFolder: (folderId: number | null) => void
  onCreateFolder: (name: string, parentId: number | null) => Promise<void>
  onCreateFile: (name: string, folderId: number) => Promise<void>
  onDeleteFolder: (folderId: number) => void
  onDeleteFile: (fileId: number) => void
}

interface TreeNodeProps {
  folder: Folder
  depth: number
  foldersByParent: Map<number | null, Folder[]>
  filesByFolder: Map<number | null, FileItem[]>
  selectedFolderId: number | null
  createTarget: CreateTarget
  mutating: boolean
  deletingFolderId: number | null
  deletingFileId: number | null
  onSelectFolder: (folderId: number) => void
  onSetCreateTarget: (target: CreateTarget) => void
  onCreateFolder: (name: string, parentId: number | null) => Promise<void>
  onCreateFile: (name: string, folderId: number) => Promise<void>
  onDeleteFolder: (folderId: number) => void
  onDeleteFile: (fileId: number) => void
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L10.17 10 7.23 6.29a.75.75 0 111.04-1.08l3.5 3.25a.75.75 0 010 1.08l-3.5 3.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function TreeNode({
  folder,
  depth,
  foldersByParent,
  filesByFolder,
  selectedFolderId,
  createTarget,
  mutating,
  deletingFolderId,
  deletingFileId,
  onSelectFolder,
  onSetCreateTarget,
  onCreateFolder,
  onCreateFile,
  onDeleteFolder,
  onDeleteFile,
}: TreeNodeProps) {
  const childFolders = foldersByParent.get(folder.id) ?? []
  const childFiles = filesByFolder.get(folder.id) ?? []
  const hasContents = childFolders.length > 0 || childFiles.length > 0
  const [expanded, setExpanded] = useState(true)

  const isSelected = selectedFolderId === folder.id
  const isCreatingSubfolder =
    createTarget?.kind === 'folder' && createTarget.parentId === folder.id
  const isCreatingFile =
    createTarget?.kind === 'file' && createTarget.folderId === folder.id

  const paddingLeft = 12 + depth * 20

  const openCreateSubfolder = () => {
    setExpanded(true)
    onSetCreateTarget({ kind: 'folder', parentId: folder.id })
  }

  const openCreateFile = () => {
    setExpanded(true)
    onSetCreateTarget({ kind: 'file', folderId: folder.id })
  }

  return (
    <li role="treeitem" aria-expanded={expanded} className="select-none">
      <div
        className={`group flex items-center gap-1 rounded-lg py-1.5 pr-2 transition-colors ${
          isSelected ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'
        }`}
        style={{ paddingLeft }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
        >
          {hasContents || isCreatingSubfolder || isCreatingFile ? (
            <Chevron expanded={expanded} />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectFolder(folder.id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="text-base leading-none" aria-hidden="true">
            📁
          </span>
          <span className="truncate text-sm font-medium text-slate-800">{folder.name}</span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            onClick={openCreateSubfolder}
            disabled={mutating}
            title="New subfolder"
            className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-50"
          >
            + Folder
          </button>
          <button
            type="button"
            onClick={openCreateFile}
            disabled={mutating}
            title="New file"
            className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-50"
          >
            + File
          </button>
          <button
            type="button"
            onClick={() => onDeleteFolder(folder.id)}
            disabled={deletingFolderId === folder.id}
            title="Delete folder"
            className="rounded px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
          >
            {deletingFolderId === folder.id ? '...' : 'Delete'}
          </button>
        </div>
      </div>

      {expanded && (
        <ul role="group" className="border-l border-slate-200" style={{ marginLeft: paddingLeft + 10 }}>
          {isCreatingSubfolder && (
            <li className="px-3 py-1">
              <InlineCreateForm
                placeholder="Subfolder name"
                submitLabel="Create"
                disabled={mutating}
                onCancel={() => onSetCreateTarget(null)}
                onSubmit={async (name) => {
                  await onCreateFolder(name, folder.id)
                  onSetCreateTarget(null)
                }}
              />
            </li>
          )}

          {isCreatingFile && (
            <li className="px-3 py-1">
              <InlineCreateForm
                placeholder="File name"
                submitLabel="Create"
                disabled={mutating}
                onCancel={() => onSetCreateTarget(null)}
                onSubmit={async (name) => {
                  await onCreateFile(name, folder.id)
                  onSetCreateTarget(null)
                }}
              />
            </li>
          )}

          {childFolders.map((child) => (
            <TreeNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              foldersByParent={foldersByParent}
              filesByFolder={filesByFolder}
              selectedFolderId={selectedFolderId}
              createTarget={createTarget}
              mutating={mutating}
              deletingFolderId={deletingFolderId}
              deletingFileId={deletingFileId}
              onSelectFolder={onSelectFolder}
              onSetCreateTarget={onSetCreateTarget}
              onCreateFolder={onCreateFolder}
              onCreateFile={onCreateFile}
              onDeleteFolder={onDeleteFolder}
              onDeleteFile={onDeleteFile}
            />
          ))}

          {childFiles.map((file) => (
            <li
              key={file.id}
              className="group flex items-center gap-2 rounded-lg py-1.5 pr-2 hover:bg-slate-50"
              style={{ paddingLeft: 12 + (depth + 1) * 20 }}
            >
              <span className="w-6 shrink-0 text-center text-sm" aria-hidden="true">
                📄
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{file.name}</span>
              <button
                type="button"
                onClick={() => onDeleteFile(file.id)}
                disabled={deletingFileId === file.id}
                className="rounded px-1.5 py-0.5 text-xs text-red-500 opacity-0 transition hover:bg-red-50 group-hover:opacity-100 disabled:opacity-50"
              >
                {deletingFileId === file.id ? '...' : 'Delete'}
              </button>
            </li>
          ))}

          {!hasContents && !isCreatingSubfolder && !isCreatingFile && (
            <li className="px-3 py-2 text-xs text-slate-400">Empty folder</li>
          )}
        </ul>
      )}
    </li>
  )
}

export function FolderTree({
  folders,
  files,
  selectedFolderId,
  mutating,
  deletingFolderId,
  deletingFileId,
  onSelectFolder,
  onCreateFolder,
  onCreateFile,
  onDeleteFolder,
  onDeleteFile,
}: FolderTreeProps) {
  const [createTarget, setCreateTarget] = useState<CreateTarget>(null)

  const foldersByParent = useMemo(() => buildFoldersByParent(folders), [folders])
  const filesByFolder = useMemo(() => buildFilesByFolder(files), [files])

  const folderIds = useMemo(() => new Set(folders.map((f) => f.id)), [folders])
  const rootFolders = foldersByParent.get(null) ?? []
  const orphanFolders = folders.filter(
    (f) => f.parent_id !== null && !folderIds.has(f.parent_id),
  )
  const topLevelFolders = [...rootFolders, ...orphanFolders].sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  const rootFiles = filesByFolder.get(null) ?? []

  const isCreatingRootFolder =
    createTarget?.kind === 'folder' && createTarget.parentId === null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">File tree</p>
        <button
          type="button"
          onClick={() => setCreateTarget({ kind: 'folder', parentId: null })}
          disabled={mutating}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          + Root folder
        </button>
      </div>

      {isCreatingRootFolder && (
        <InlineCreateForm
          placeholder="Root folder name"
          submitLabel="Create folder"
          disabled={mutating}
          onCancel={() => setCreateTarget(null)}
          onSubmit={async (name) => {
            await onCreateFolder(name, null)
            setCreateTarget(null)
          }}
        />
      )}

      {topLevelFolders.length === 0 && rootFiles.length === 0 && !isCreatingRootFolder ? (
        <p className="py-8 text-center text-sm text-slate-500">
          No folders or files yet. Create a root folder to get started.
        </p>
      ) : (
        <ul role="tree" aria-label="Folder tree" className="space-y-1">
          {topLevelFolders.map((folder) => (
            <TreeNode
              key={folder.id}
              folder={folder}
              depth={0}
              foldersByParent={foldersByParent}
              filesByFolder={filesByFolder}
              selectedFolderId={selectedFolderId}
              createTarget={createTarget}
              mutating={mutating}
              deletingFolderId={deletingFolderId}
              deletingFileId={deletingFileId}
              onSelectFolder={onSelectFolder}
              onSetCreateTarget={setCreateTarget}
              onCreateFolder={onCreateFolder}
              onCreateFile={onCreateFile}
              onDeleteFolder={onDeleteFolder}
              onDeleteFile={onDeleteFile}
            />
          ))}

          {rootFiles.map((file) => (
            <li
              key={file.id}
              className="group flex items-center gap-2 rounded-lg py-1.5 pr-2 hover:bg-slate-50"
              style={{ paddingLeft: 12 }}
            >
              <span className="w-6 shrink-0 text-center text-sm" aria-hidden="true">
                📄
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{file.name}</span>
              <button
                type="button"
                onClick={() => onDeleteFile(file.id)}
                disabled={deletingFileId === file.id}
                className="rounded px-1.5 py-0.5 text-xs text-red-500 opacity-0 transition hover:bg-red-50 group-hover:opacity-100 disabled:opacity-50"
              >
                {deletingFileId === file.id ? '...' : 'Delete'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
