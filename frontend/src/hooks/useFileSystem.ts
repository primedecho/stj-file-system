/**
 * Central hook for file-system state: loads data from the API,
 * tracks loading/error state, and refreshes after mutations.
 */

import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type FileItem, type Folder } from '../api'

type MutationType = 'createFolder' | 'createFile' | 'deleteFolder' | 'deleteFile' | null

interface UseFileSystemResult {
  folders: Folder[]
  files: FileItem[]
  loading: boolean
  refreshing: boolean
  mutating: boolean
  mutationType: MutationType
  deletingFolderId: number | null
  deletingFileId: number | null
  error: string | null
  apiConnected: boolean | null
  clearError: () => void
  refresh: () => Promise<void>
  createFolder: (name: string, parentId: number | null) => Promise<void>
  createFile: (folderId: number, name: string) => Promise<void>
  deleteFolder: (folderId: number) => Promise<void>
  deleteFile: (fileId: number) => Promise<void>
}

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return fallback
}

export function useFileSystem(): UseFileSystemResult {
  const [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [mutating, setMutating] = useState(false)
  const [mutationType, setMutationType] = useState<MutationType>(null)
  const [deletingFolderId, setDeletingFolderId] = useState<number | null>(null)
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [apiConnected, setApiConnected] = useState<boolean | null>(null)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [folderData, fileData] = await Promise.all([
        api.listFolders(),
        api.listFiles(),
      ])
      setFolders(folderData)
      setFiles(fileData)
      setError(null)
      setApiConnected(true)
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load folders and files'))
      if (err instanceof ApiError && err.status === 0) {
        setApiConnected(false)
      }
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        await api.checkHealth()
        setApiConnected(true)
      } catch {
        setApiConnected(false)
      }
      await refresh()
    })()
  }, [refresh])

  const runMutation = useCallback(
    async (type: MutationType, action: () => Promise<void>) => {
      setMutating(true)
      setMutationType(type)
      try {
        await action()
        await refresh()
      } catch (err) {
        setError(toErrorMessage(err, 'Operation failed'))
        throw err
      } finally {
        setMutating(false)
        setMutationType(null)
        setDeletingFolderId(null)
        setDeletingFileId(null)
      }
    },
    [refresh],
  )

  const createFolder = useCallback(
    (name: string, parentId: number | null) =>
      runMutation('createFolder', async () => {
        await api.createFolder({ name, parent_id: parentId })
      }),
    [runMutation],
  )

  const createFile = useCallback(
    (folderId: number, name: string) =>
      runMutation('createFile', async () => {
        await api.createFileInFolder(folderId, { name })
      }),
    [runMutation],
  )

  const deleteFolder = useCallback(
    (folderId: number) => {
      setDeletingFolderId(folderId)
      return runMutation('deleteFolder', async () => {
        await api.deleteFolder(folderId)
      })
    },
    [runMutation],
  )

  const deleteFile = useCallback(
    (fileId: number) => {
      setDeletingFileId(fileId)
      return runMutation('deleteFile', async () => {
        await api.deleteFile(fileId)
      })
    },
    [runMutation],
  )

  return {
    folders,
    files,
    loading,
    refreshing,
    mutating,
    mutationType,
    deletingFolderId,
    deletingFileId,
    error,
    apiConnected,
    clearError: () => setError(null),
    refresh,
    createFolder,
    createFile,
    deleteFolder,
    deleteFile,
  }
}

export { ApiError }
