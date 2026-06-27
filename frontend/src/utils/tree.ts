import type { FileItem, Folder } from '../api'

export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name))
}

export function buildFoldersByParent(folders: Folder[]): Map<number | null, Folder[]> {
  const map = new Map<number | null, Folder[]>()
  for (const folder of folders) {
    const key = folder.parent_id
    const siblings = map.get(key)
    if (siblings) siblings.push(folder)
    else map.set(key, [folder])
  }
  for (const siblings of map.values()) {
    siblings.sort((a, b) => a.name.localeCompare(b.name))
  }
  return map
}

export function buildFilesByFolder(files: FileItem[]): Map<number | null, FileItem[]> {
  const map = new Map<number | null, FileItem[]>()
  for (const file of files) {
    const key = file.folder_id
    const siblings = map.get(key)
    if (siblings) siblings.push(file)
    else map.set(key, [file])
  }
  for (const siblings of map.values()) {
    siblings.sort((a, b) => a.name.localeCompare(b.name))
  }
  return map
}

export function getFolderPath(folderId: number, folders: Folder[]): string {
  return getFolderBreadcrumbs(folderId, folders)
    .map((crumb) => crumb.name)
    .join(' / ')
}

export function getFolderBreadcrumbs(
  folderId: number,
  folders: Folder[],
): Array<{ id: number; name: string }> {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const parts: Array<{ id: number; name: string }> = []
  let current = byId.get(folderId)
  while (current) {
    parts.unshift({ id: current.id, name: current.name })
    current = current.parent_id != null ? byId.get(current.parent_id) : undefined
  }
  return parts
}
