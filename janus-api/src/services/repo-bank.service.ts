import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { getDataPath } from '../app-paths'
import { settingsStore } from './settings-store'
import { fileService } from './file.service'

/** Local on-disk resource bank (no Git remote). */
export class RepoBankService {
  async ensureClone(): Promise<string> {
    const settings = settingsStore.get()
    const clonePath = join(getDataPath(settings.dataPath), 'repo-bank')
    await mkdir(clonePath, { recursive: true })
    return clonePath
  }

  async writeResourceFile(
    resourceType: 'skill' | 'subAgent',
    name: string,
    relativePath: string,
    content: string
  ): Promise<string> {
    const clonePath = await this.ensureClone()
    const typeDir = resourceType === 'skill' ? 'skills' : 'agents'
    const dest = join(clonePath, typeDir, name, relativePath)
    await fileService.writeText(dest, content)
    return dest
  }
}

export const repoBankService = new RepoBankService()
