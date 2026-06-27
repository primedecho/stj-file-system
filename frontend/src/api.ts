/**
 * HTTP client for the STJ File System API.
 *
 * In development, Vite proxies these paths to http://localhost:8000.
 * For production builds, set VITE_API_BASE to the backend URL.
 */

export interface Folder {
  id: number
  name: string
  parent_id: number | null
}

export interface FileItem {
  id: number
  name: string
  folder_id: number | null
}

export interface HealthResponse {
  status: string
  timestamp: string
}

export interface CreateFolderPayload {
  name: string
  parent_id?: number | null
}

export interface CreateFilePayload {
  name: string
}

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function parseErrorDetail(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined

  if ('error' in body) {
    const { error } = body as { error?: { message?: string; details?: unknown } }
    if (error?.message) {
      if (Array.isArray(error.details)) {
        const detailMessages = error.details
          .map((item) =>
            typeof item === 'object' && item && 'message' in item
              ? String(item.message)
              : String(item),
          )
          .join(', ')
        return detailMessages ? `${error.message}: ${detailMessages}` : error.message
      }
      return error.message
    }
  }

  if (!('detail' in body)) return undefined

  const { detail, errors } = body as { detail: unknown; errors?: unknown }
  if (typeof detail === 'string') return detail
  if (Array.isArray(errors)) {
    return errors
      .map((item) =>
        typeof item === 'object' && item && 'message' in item
          ? String(item.message)
          : String(item),
      )
      .join(', ')
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === 'object' && item && 'msg' in item ? String(item.msg) : String(item),
      )
      .join(', ')
  }
  return undefined
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      ...init,
    })
  } catch {
    throw new ApiError(
      'Unable to reach the server. Make sure the backend is running on port 8000.',
      0,
    )
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const detail = parseErrorDetail(await response.json())
      if (detail) message = detail
    } catch {
      // Response body was not JSON — keep the default message.
    }
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

// --- Folders ---

export function listFolders(): Promise<Folder[]> {
  return request<Folder[]>('/folders')
}

export function createFolder(payload: CreateFolderPayload): Promise<Folder> {
  return request<Folder>('/folders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteFolder(folderId: number): Promise<void> {
  return request<void>(`/folders/${folderId}`, { method: 'DELETE' })
}

export function createFileInFolder(
  folderId: number,
  payload: CreateFilePayload,
): Promise<FileItem> {
  return request<FileItem>(`/folders/${folderId}/files`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// --- Files ---

export function listFiles(folderId?: number): Promise<FileItem[]> {
  const query = folderId != null ? `?folder_id=${folderId}` : ''
  return request<FileItem[]>(`/files${query}`)
}

export function deleteFile(fileId: number): Promise<void> {
  return request<void>(`/files/${fileId}`, { method: 'DELETE' })
}

// --- Search ---

export function searchFiles(query: string, folderId?: number): Promise<FileItem[]> {
  const params = new URLSearchParams({ query })
  if (folderId != null) params.set('folder_id', String(folderId))
  return request<FileItem[]>(`/search?${params}`)
}

// --- Health ---

export function checkHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health')
}

/** Convenience object for grouped API access. */
export const api = {
  listFolders,
  createFolder,
  deleteFolder,
  createFileInFolder,
  listFiles,
  deleteFile,
  searchFiles,
  checkHealth,
}
