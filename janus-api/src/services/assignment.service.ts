import { copyFile, mkdir, rm } from 'fs/promises'
import { dirname, join, basename } from 'path'
import { existsSync } from 'fs'
import type {
  AppSettings,
  AssignTarget,
  HookResource,
  PlatformId,
  ResourceType,
  RuleResource,
  SkillResource,
  SubAgentResource
} from '../shared/types'
import { CURSOR_ONLY_RESOURCES, PROJECT_ONLY_RESOURCES } from '../shared/types'
import { ruleBaseName, ruleFileNameForPlatform } from '../shared/rule-names'
import { skillContentHash } from '../shared/utils'
import { fileService } from './file.service'
import { getAdapter } from '../platforms'
import { settingsStore } from './settings-store'

type ScannedResource =
  | SkillResource
  | RuleResource
  | HookResource
  | SubAgentResource

export class AssignmentService {
  getTargets(settings: AppSettings, resourceType: ResourceType): AssignTarget[] {
    const targets: AssignTarget[] = []

    if (!PROJECT_ONLY_RESOURCES.includes(resourceType)) {
      for (const platform of settings.platforms) {
        if (!platform.enabled) continue
        if (CURSOR_ONLY_RESOURCES.includes(resourceType) && platform.id !== 'cursor') continue

        const adapter = getAdapter(platform.id)
        if (!adapter) continue

        targets.push({
          type: 'platform',
          id: platform.id,
          label: adapter.label,
          platformId: platform.id
        })
      }
    }

    for (const root of settings.projectRoots) {
      for (const project of root.projects) {
        if (CURSOR_ONLY_RESOURCES.includes(resourceType)) {
          targets.push({
            type: 'project',
            id: project.id,
            label: `${project.name} (Cursor)`,
            platformId: 'cursor'
          })
        } else {
          for (const platform of settings.platforms) {
            if (!platform.enabled) continue
            targets.push({
              type: 'project',
              id: `${project.id}:${platform.id}`,
              label: `${project.name} (${getAdapter(platform.id)?.label ?? platform.id})`,
              platformId: platform.id
            })
          }
        }
      }
    }

    return targets
  }

  async assignToProject(
    resource: ScannedResource,
    resourceType: ResourceType,
    projectId: string
  ): Promise<void> {
    const settings = settingsStore.get()
    const project = settings.projectRoots.flatMap((r) => r.projects).find((p) => p.id === projectId)
    if (!project) throw new Error('Project not found')

    const platforms =
      CURSOR_ONLY_RESOURCES.includes(resourceType)
        ? settings.platforms.filter((p) => p.enabled && p.id === 'cursor')
        : settings.platforms.filter((p) => p.enabled)

    for (const platform of platforms) {
      const target: AssignTarget = {
        type: 'project',
        id: CURSOR_ONLY_RESOURCES.includes(resourceType)
          ? project.id
          : `${project.id}:${platform.id}`,
        label: `${project.name}`,
        platformId: platform.id
      }
      await this.assignResource(resource, resourceType, target)
    }
  }

  async unassignFromProject(
    resourceName: string,
    resourceType: ResourceType,
    projectId: string
  ): Promise<void> {
    const settings = settingsStore.get()
    const project = settings.projectRoots.flatMap((r) => r.projects).find((p) => p.id === projectId)
    if (!project) return

    const platforms =
      CURSOR_ONLY_RESOURCES.includes(resourceType)
        ? settings.platforms.filter((p) => p.enabled && p.id === 'cursor')
        : settings.platforms.filter((p) => p.enabled)

    for (const platform of platforms) {
      const adapter = getAdapter(platform.id)
      if (!adapter) continue
      const paths = adapter.getProjectPaths(project.path, platform.projectDirName)

      switch (resourceType) {
        case 'skill':
          await fileService.removePath(join(paths.skillsDirs[0], resourceName))
          break
        case 'rule': {
          const base = ruleBaseName(resourceName)
          await fileService.removePath(join(paths.rulesDir, `${base}.mdc`))
          await fileService.removePath(join(paths.rulesDir, `${base}.md`))
          break
        }
        case 'subAgent': {
          const agentsDir = paths.agentsDir
          if (!agentsDir) break
          const files = await fileService.listFilesRecursive(agentsDir)
          for (const file of files) {
            if (basename(file, '.md') === resourceName || basename(file) === resourceName) {
              await fileService.removePath(file)
            }
          }
          break
        }
        case 'hook': {
          if (!paths.hooksConfigPath || !existsSync(paths.hooksConfigPath)) break
          try {
            const raw = await fileService.readText(paths.hooksConfigPath)
            const parsed = JSON.parse(raw) as {
              hooks?: Record<string, Array<Record<string, unknown>>>
            }
            for (const [event, entries] of Object.entries(parsed.hooks ?? {})) {
              const filtered = entries.filter((e) => {
                const cmd = String(e.command ?? '')
                return !cmd.includes(resourceName) && !basename(cmd).includes(resourceName)
              })
              if (filtered.length === 0) delete parsed.hooks?.[event]
              else if (parsed.hooks) parsed.hooks[event] = filtered
            }
            await fileService.writeText(paths.hooksConfigPath, JSON.stringify(parsed, null, 2))
          } catch {
            // ignore
          }
          break
        }
        case 'mcp': {
          if (!existsSync(paths.mcpConfigPath)) break
          try {
            const raw = await fileService.readText(paths.mcpConfigPath)
            const config = JSON.parse(raw) as { mcpServers?: Record<string, unknown> }
            if (config.mcpServers) delete config.mcpServers[resourceName]
            await fileService.writeText(paths.mcpConfigPath, JSON.stringify(config, null, 2))
          } catch {
            // ignore
          }
          break
        }
      }
    }
  }

  /** Copy a skill/rule into an IDE/CLI global folder (rootPath/skills | rootPath/rules). */
  async assignToPlatformGlobal(
    resource: ScannedResource,
    resourceType: ResourceType,
    platformId: PlatformId
  ): Promise<void> {
    if (resourceType !== 'skill' && resourceType !== 'rule') {
      throw new Error('Only skills and rules can be assigned to an IDE/CLI global folder')
    }
    const settings = settingsStore.get()
    const platform = settings.platforms.find((p) => p.id === platformId && p.enabled)
    if (!platform) throw new Error('IDE/CLI is not enabled')
    const adapter = getAdapter(platformId)
    if (!adapter) throw new Error('IDE/CLI adapter not found')
    const target: AssignTarget = {
      type: 'platform',
      id: platform.id,
      label: adapter.label,
      platformId
    }
    await this.assignResource(resource, resourceType, target)
  }

  /** Remove a skill/rule from an IDE/CLI global folder. */
  async unassignFromPlatformGlobal(
    resourceName: string,
    resourceType: ResourceType,
    platformId: PlatformId
  ): Promise<void> {
    if (resourceType !== 'skill' && resourceType !== 'rule') {
      throw new Error('Only skills and rules can be unassigned from an IDE/CLI global folder')
    }
    const settings = settingsStore.get()
    const platform = settings.platforms.find((p) => p.id === platformId)
    if (!platform) return
    const adapter = getAdapter(platformId)
    if (!adapter) return
    const paths = adapter.getPlatformPaths(platform.rootPath)

    if (resourceType === 'skill') {
      await fileService.removePath(join(paths.skillsDirs[0], resourceName))
      return
    }
    const base = ruleBaseName(resourceName)
    await fileService.removePath(join(paths.rulesDir, `${base}.mdc`))
    await fileService.removePath(join(paths.rulesDir, `${base}.md`))
  }

  private async assignResource(
    resource: ScannedResource,
    resourceType: ResourceType,
    target: AssignTarget
  ): Promise<void> {
    switch (resourceType) {
      case 'skill':
        await this.assignSkill(resource as SkillResource, target)
        break
      case 'rule':
        await this.assignRule(resource as RuleResource, target)
        break
      case 'hook':
        await this.assignHook(resource as HookResource, target)
        break
      case 'subAgent':
        await this.assignSubAgent(resource as SubAgentResource, target)
        break
      case 'mcp':
        break
    }
  }

  async assignSkill(skill: SkillResource, target: AssignTarget): Promise<void> {
    const adapter = getAdapter(target.platformId)
    if (!adapter) return
    const settings = settingsStore.get()
    const destRoot = this.resolvePaths(adapter, target, settings).skillsDirs[0]
    const destPath = join(destRoot, skill.name)
    const destSkillMd = join(destPath, 'SKILL.md')
    if (existsSync(destSkillMd)) {
      const existingText = await fileService.readText(destSkillMd)
      const existingHash = skillContentHash(existingText)
      if (existingHash !== skill.contentHash) {
        throw new Error(
          `Cannot assign "${skill.name}": target already has a different SKILL.md (unique skill with the same name).`
        )
      }
    }
    await fileService.copyDirectory(skill.rootPath, destPath)
  }

  async assignRule(rule: RuleResource, target: AssignTarget): Promise<void> {
    const adapter = getAdapter(target.platformId)
    if (!adapter) return
    const settings = settingsStore.get()
    const paths = this.resolvePaths(adapter, target, settings)
    const base = ruleBaseName(rule.name)
    const destFileName = ruleFileNameForPlatform(base, target.platformId)
    await mkdir(paths.rulesDir, { recursive: true })
    await copyFile(rule.filePath, join(paths.rulesDir, destFileName))
  }

  async assignHook(hook: HookResource, target: AssignTarget): Promise<void> {
    const adapter = getAdapter(target.platformId)
    if (!adapter) return
    const settings = settingsStore.get()
    const paths = this.resolvePaths(adapter, target, settings)
    if (!paths.hooksConfigPath) return

    let config: { hooks?: Record<string, Array<Record<string, unknown>>> } = { hooks: {} }
    if (existsSync(paths.hooksConfigPath)) {
      config = JSON.parse(await fileService.readText(paths.hooksConfigPath))
    }
    config.hooks ??= {}
    const entries = config.hooks[hook.event] ?? []
    const exists = entries.some(
      (e) => String(e.command ?? '') === String(hook.definition.command ?? '')
    )
    if (!exists) {
      entries.push({ ...hook.definition })
      config.hooks[hook.event] = entries
    }
    await mkdir(dirname(paths.hooksConfigPath), { recursive: true })
    await fileService.writeText(paths.hooksConfigPath, JSON.stringify(config, null, 2))

    if (hook.scriptPath && existsSync(hook.scriptPath) && paths.hooksScriptsDir) {
      await mkdir(paths.hooksScriptsDir, { recursive: true })
      const dest = join(paths.hooksScriptsDir, basename(hook.scriptPath))
      if (!existsSync(dest)) {
        await copyFile(hook.scriptPath, dest)
      }
    }
  }

  async assignSubAgent(agent: SubAgentResource, target: AssignTarget): Promise<void> {
    const adapter = getAdapter(target.platformId)
    if (!adapter) return
    const settings = settingsStore.get()
    const paths = this.resolvePaths(adapter, target, settings)
    if (!paths.agentsDir) return
    await mkdir(paths.agentsDir, { recursive: true })
    const dest = join(paths.agentsDir, basename(agent.filePath))
    if (!existsSync(dest)) {
      await copyFile(agent.filePath, dest)
    }
  }

  async assignMcp(
    mcp: { name: string; params: Record<string, unknown> },
    target: AssignTarget
  ): Promise<void> {
    const adapter = getAdapter(target.platformId)
    if (!adapter) return
    const settings = settingsStore.get()
    const paths = this.resolvePaths(adapter, target, settings)

    let config: { mcpServers?: Record<string, unknown> } = { mcpServers: {} }
    if (existsSync(paths.mcpConfigPath)) {
      config = JSON.parse(await fileService.readText(paths.mcpConfigPath))
    }
    config.mcpServers ??= {}
    config.mcpServers[mcp.name] = mcp.params
    await fileService.writeText(paths.mcpConfigPath, JSON.stringify(config, null, 2))
  }

  private resolvePaths(
    adapter: ReturnType<typeof getAdapter>,
    target: AssignTarget,
    settings: AppSettings
  ) {
    if (!adapter) throw new Error('No adapter')
    if (target.type === 'platform') {
      const platform = settings.platforms.find((p) => p.id === target.platformId)!
      return adapter.getPlatformPaths(platform.rootPath)
    }
    const projectId = target.id.includes(':') ? target.id.split(':')[0] : target.id
    const project = settings.projectRoots
      .flatMap((r) => r.projects)
      .find((p) => p.id === projectId)
    if (!project) throw new Error('Project not found')
    const platform = settings.platforms.find((p) => p.id === target.platformId)
    if (!platform) throw new Error('Platform not found')
    return adapter.getProjectPaths(project.path, platform.projectDirName)
  }
}

export const assignmentService = new AssignmentService()
