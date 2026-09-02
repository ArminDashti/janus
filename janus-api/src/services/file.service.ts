import { readFile, writeFile, readdir, stat, mkdir, copyFile, rm, rename } from 'fs/promises'
import { existsSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { getTrashPath } from '../app-paths'

export type TrashResourceKind = 'skills' | 'rules' | 'hooks' | 'subAgents' | 'tools'

export class FileService {
  async readText(filePath: string): Promise<string> {
    return readFile(filePath, 'utf-8')
  }

  async writeText(filePath: string, content: string): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf-8')
  }

  async listFilesRecursive(dir: string): Promise<string[]> {
    if (!existsSync(dir)) return []

    const results: string[] = []
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...(await this.listFilesRecursive(full)))
      } else {
        results.push(full)
      }
    }

    return results
  }

  async listDirectories(dir: string): Promise<string[]> {
    if (!existsSync(dir)) return []
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => join(dir, e.name))
  }

  async listEntries(dir: string): Promise<{ path: string; name: string; isDirectory: boolean }[]> {
    if (!existsSync(dir)) return []

    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .map((entry) => ({
        path: join(dir, entry.name),
        name: entry.name,
        isDirectory: entry.isDirectory()
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }

  async copyDirectory(src: string, dest: string): Promise<void> {
    if (!existsSync(src)) return
    await mkdir(dest, { recursive: true })
    const entries = await readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = join(src, entry.name)
      const destPath = join(dest, entry.name)
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath)
      } else {
        await mkdir(dirname(destPath), { recursive: true })
        await copyFile(srcPath, destPath)
      }
    }
  }

  async removePath(target: string): Promise<void> {
    if (!existsSync(target)) return
    const info = await stat(target)
    if (info.isDirectory()) {
      await rm(target, { recursive: true, force: true })
    } else {
      await rm(target, { force: true })
    }
  }

  /**
   * Soft-delete: move into `.trash/<kind>/<name>__<timestamp>/` and write meta.json.
   * Returns the trash directory path.
   */
  async moveToTrash(
    sourcePath: string,
    kind: TrashResourceKind,
    name: string,
    meta: Record<string, unknown> = {}
  ): Promise<string | null> {
    if (!existsSync(sourcePath)) return null

    const safeName = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'item'
    const trashDir = getTrashPath(kind, `${safeName}__${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
    await mkdir(trashDir, { recursive: true })

    const destPath = join(trashDir, basename(sourcePath))
    await this.renameWithFallback(sourcePath, destPath)

    const payload = {
      originalPath: sourcePath,
      name,
      kind,
      deletedAt: new Date().toISOString(),
      ...meta
    }
    await writeFile(join(trashDir, 'meta.json'), JSON.stringify(payload, null, 2), 'utf-8')
    return trashDir
  }

  /** Write meta-only trash entry (e.g. hook config snippet without a file move). */
  async writeTrashMeta(
    kind: TrashResourceKind,
    name: string,
    meta: Record<string, unknown>
  ): Promise<string> {
    const safeName = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'item'
    const trashDir = getTrashPath(kind, `${safeName}__${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
    await mkdir(trashDir, { recursive: true })
    const payload = {
      name,
      kind,
      deletedAt: new Date().toISOString(),
      ...meta
    }
    await writeFile(join(trashDir, 'meta.json'), JSON.stringify(payload, null, 2), 'utf-8')
    return trashDir
  }

  fileName(path: string): string {
    return basename(path)
  }

  extension(path: string): string {
    return extname(path).toLowerCase()
  }

  async getMtime(filePath: string): Promise<number | null> {
    if (!existsSync(filePath)) return null
    const info = await stat(filePath)
    return info.mtimeMs
  }

  async renamePath(from: string, to: string): Promise<void> {
    if (!existsSync(from)) return
    if (existsSync(to)) {
      throw new Error(`Cannot rename: target already exists (${to})`)
    }
    await mkdir(dirname(to), { recursive: true })
    await this.renameWithFallback(from, to)
  }

  /**
   * Rename that survives Windows locks (Cursor open on a skill folder often
   * returns EPERM/EACCES/EBUSY). Tries native rename, short retries, then
   * copy + remove — the same path that works when Explorer rename fails.
   */
  private async renameWithFallback(from: string, to: string): Promise<void> {
    try {
      await rename(from, to)
      return
    } catch (err) {
      if (!this.isRetryableRenameError(err)) throw err
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      await sleep(100 * (attempt + 1))
      try {
        await rename(from, to)
        return
      } catch (err) {
        if (!this.isRetryableRenameError(err)) throw err
      }
    }

    await this.copyPath(from, to)
    await this.removePathWithRetry(from)
  }

  private isRetryableRenameError(err: unknown): boolean {
    const code = (err as NodeJS.ErrnoException)?.code
    return code === 'EXDEV' || code === 'EPERM' || code === 'EACCES' || code === 'EBUSY'
  }

  private async copyPath(from: string, to: string): Promise<void> {
    const info = await stat(from)
    if (info.isDirectory()) {
      await this.copyDirectory(from, to)
    } else {
      await mkdir(dirname(to), { recursive: true })
      await copyFile(from, to)
    }
  }

  private async removePathWithRetry(target: string, attempts = 5): Promise<void> {
    let lastError: unknown
    for (let i = 0; i < attempts; i++) {
      try {
        await this.removePath(target)
        if (!existsSync(target)) return
      } catch (err) {
        lastError = err
      }
      await sleep(150 * (i + 1))
    }
    if (existsSync(target)) {
      throw lastError instanceof Error
        ? lastError
        : new Error(`Failed to remove locked path after rename copy: ${target}`)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const fileService = new FileService()
