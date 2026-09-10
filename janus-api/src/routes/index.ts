import { existsSync, mkdirSync, readdirSync } from 'fs'
import { basename, join } from 'path'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import type { AppSettings, PlatformId, ResourceType } from '../shared/types'
import { DEFAULT_PLATFORM_PROJECT_DIRS } from '../shared/types'
import { createDefaultSettings } from '../shared/defaults'
import { expandHome, skillFolderNameFromKey, stableId } from '../shared/utils'
import { getAppRoot, getInstructionsPath } from '../app-paths'
import { assignmentService } from '../services/assignment.service'
import { refactorWithActiveApi } from '../services/api-refactor.service'
import { agentDebugLog } from '../services/debug-log'
import { fileService } from '../services/file.service'
import { importedProjectsStore } from '../services/imported-projects-store'
import type { OpenRouterRefactorRequest } from '../services/openrouter.service'
import { platformCleanupService } from '../services/platform-cleanup.service'
import { syncEnabledPlatformsToProjects } from '../services/platform-sync.service'
import { projectBootstrapService } from '../services/project-bootstrap.service'
import { resourceService } from '../services/resource.service'
import { scannerService } from '../services/scanner.service'
import { settingsStore } from '../services/settings-store'
import { applyStartupSetting } from '../services/startup.service'
import { startFileWatcher, stopFileWatcher } from '../services/watcher.service'
import { getAdapter } from '../platforms'

type NonMcpResourceType = Exclude<ResourceType, 'mcp'>
type CreatableResourceType = 'skill' | 'rule' | 'hook' | 'subAgent'

const RESOURCE_TYPES = new Set<ResourceType>(['skill', 'rule', 'mcp', 'hook', 'subAgent', 'tool'])
const NON_MCP_RESOURCE_TYPES = new Set<NonMcpResourceType>([
  'skill',
  'rule',
  'hook',
  'subAgent',
  'tool'
])
const CREATABLE_RESOURCE_TYPES = new Set<CreatableResourceType>(['skill', 'rule', 'hook', 'subAgent'])

function isResourceType(value: string): value is ResourceType {
  return RESOURCE_TYPES.has(value as ResourceType)
}

function isNonMcpResourceType(value: string): value is NonMcpResourceType {
  return NON_MCP_RESOURCE_TYPES.has(value as NonMcpResourceType)
}

function isCreatableResourceType(value: string): value is CreatableResourceType {
  return CREATABLE_RESOURCE_TYPES.has(value as CreatableResourceType)
}

function sendError(reply: FastifyReply, err: unknown, status = 500): void {
  const message = err instanceof Error ? err.message : String(err)
  void reply.status(status).type('text/plain').send(message)
}

function route<T>(
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<T>
): (request: FastifyRequest, reply: FastifyReply) => Promise<T | void> {
  return async (request, reply) => {
    try {
      return await handler(request, reply)
    } catch (err) {
      const status =
        err instanceof Error && /invalid|required|missing|not found|no enabled/i.test(err.message)
          ? 400
          : 500
      sendError(reply, err, status)
    }
  }
}

async function restartWatcher(): Promise<void> {
  stopFileWatcher()
  startFileWatcher()
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/app/root',
    route(async () => getAppRoot())
  )

  app.get(
    '/api/settings',
    route(async () => settingsStore.get())
  )

  app.put(
    '/api/settings',
    route(async (request) => {
      const settings = request.body as AppSettings
      const previous = settingsStore.get()
      const platformsChanged =
        JSON.stringify(previous.platforms) !== JSON.stringify(settings.platforms)

      settingsStore.save(settings)
      applyStartupSetting(settings.startup?.runOnLogin ?? false)

      if (platformsChanged) {
        try {
          await syncEnabledPlatformsToProjects()
        } catch (err) {
          console.error('Platform sync after settings save failed:', err)
        }
      }

      await restartWatcher()
      return settingsStore.get()
    })
  )

  app.post(
    '/api/settings/reset',
    route(async () => {
      const defaults = createDefaultSettings()
      settingsStore.save(defaults)
      return settingsStore.get()
    })
  )

  app.get(
    '/api/scan',
    route(async (request) => {
      const query = request.query as { probeMcps?: string }
      const probeMcps = query.probeMcps === 'true'
      const startedAt = Date.now()
      agentDebugLog('B', 'routes/index.ts:scan', 'HTTP scan invoked', { probeMcps })
      const result = await scannerService.scanAll(settingsStore.get(), { probeMcps })
      agentDebugLog('B', 'routes/index.ts:scan:done', 'HTTP scan done', {
        durationMs: Date.now() - startedAt,
        probeMcps
      })
      return result
    })
  )

  app.get(
    '/api/scan/projects',
    route(async (request) => {
      const query = request.query as { path?: string }
      if (!query.path) {
        throw new Error('path query parameter is required')
      }
      return scannerService.discoverGitProjects(query.path)
    })
  )

  app.get(
    '/api/files',
    route(async (request) => {
      const query = request.query as { path?: string }
      if (!query.path) {
        throw new Error('path query parameter is required')
      }
      return fileService.readText(query.path)
    })
  )

  app.put(
    '/api/files',
    route(async (request) => {
      const body = request.body as { path?: string; content?: string }
      if (!body.path || body.content === undefined) {
        throw new Error('path and content are required')
      }
      await fileService.writeText(body.path, body.content)
      return true
    })
  )

  app.get(
    '/api/files/list',
    route(async (request) => {
      const query = request.query as { path?: string }
      if (!query.path) {
        throw new Error('path query parameter is required')
      }
      return fileService.listFilesRecursive(query.path)
    })
  )

  app.get(
    '/api/files/entries',
    route(async (request) => {
      const query = request.query as { path?: string }
      if (!query.path) {
        throw new Error('path query parameter is required')
      }
      return fileService.listEntries(query.path)
    })
  )

  app.put(
    '/api/files/skill-md',
    route(async (request) => {
      const body = request.body as {
        filePath?: string
        content?: string
        currentResourceName?: string
      }
      if (!body.filePath || body.content === undefined || !body.currentResourceName) {
        throw new Error('filePath, content, and currentResourceName are required')
      }

      const nameMatch = body.content.match(/^---[\s\S]*?\nname:\s*(.+)/m)
      const frontmatterName = nameMatch ? nameMatch[1].trim() : null

      await fileService.writeText(body.filePath, body.content)

      const folderName = skillFolderNameFromKey(body.currentResourceName)
      const folderLeaf =
        folderName.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? folderName
      if (frontmatterName && frontmatterName !== folderName && frontmatterName !== folderLeaf) {
        const settings = settingsStore.get()
        const scan = await scannerService.scanAll(settings)
        try {
          await resourceService.renameResource(scan, 'skill', body.currentResourceName, frontmatterName)
        } catch {
          // file was saved; rename failure is non-fatal
        }
      }

      return true
    })
  )

  app.get(
    '/api/resources/:resourceType/targets',
    route(async (request) => {
      const { resourceType } = request.params as { resourceType: string }
      if (!isResourceType(resourceType)) {
        throw new Error(`Invalid resource type: ${resourceType}`)
      }
      return assignmentService.getTargets(settingsStore.get(), resourceType)
    })
  )

  app.get(
    '/api/resources/:resourceType/stats',
    route(async (request) => {
      const { resourceType } = request.params as { resourceType: string }
      if (!isNonMcpResourceType(resourceType)) {
        throw new Error(`Invalid resource type: ${resourceType}`)
      }

      const startedAt = Date.now()
      agentDebugLog('B', 'routes/index.ts:resource:stats', 'HTTP resource:stats invoked', {
        resourceType
      })

      const settings = settingsStore.get()
      const scan = await scannerService.scanAll(settings)
      const afterScanAt = Date.now()
      const summaries = await resourceService.getGroupSummaries(scan, settings, resourceType)

      agentDebugLog('B', 'routes/index.ts:resource:stats:done', 'HTTP resource:stats done', {
        resourceType,
        scanMs: afterScanAt - startedAt,
        summariesMs: Date.now() - afterScanAt,
        totalMs: Date.now() - startedAt,
        summaryCount: summaries.length
      })

      return summaries
    })
  )

  app.post(
    '/api/resources/:resourceType/assign-all',
    route(async (request) => {
      const { resourceType } = request.params as { resourceType: string }
      if (!isNonMcpResourceType(resourceType)) {
        throw new Error(`Invalid resource type: ${resourceType}`)
      }
      return resourceService.applyAllToAllProjects(resourceType)
    })
  )

  app.post(
    '/api/resources/:resourceType/rename',
    route(async (request) => {
      const { resourceType } = request.params as { resourceType: string }
      if (!isCreatableResourceType(resourceType)) {
        throw new Error(`Invalid resource type: ${resourceType}`)
      }

      const body = request.body as { oldName?: string; newName?: string }
      if (!body.oldName || !body.newName) {
        throw new Error('oldName and newName are required')
      }

      const settings = settingsStore.get()
      const scan = await scannerService.scanAll(settings)
      await resourceService.renameResource(scan, resourceType, body.oldName, body.newName)
      return true
    })
  )

  app.post(
    '/api/resources/:resourceType',
    route(async (request) => {
      const { resourceType } = request.params as { resourceType: string }
      if (!isCreatableResourceType(resourceType)) {
        throw new Error(`Invalid resource type: ${resourceType}`)
      }

      const body = request.body as { name?: string; projectIds?: string[] }
      if (!body.name || !body.projectIds) {
        throw new Error('name and projectIds are required')
      }

      await resourceService.createResource(resourceType, body.name, body.projectIds)
      return true
    })
  )

  app.get(
    '/api/resources/:resourceType/:resourceName/matrix',
    route(async (request) => {
      const { resourceType, resourceName } = request.params as {
        resourceType: string
        resourceName: string
      }
      if (!isNonMcpResourceType(resourceType)) {
        throw new Error(`Invalid resource type: ${resourceType}`)
      }

      const settings = settingsStore.get()
      const scan = await scannerService.scanAll(settings)
      return resourceService.getProjectMatrix(scan, settings, resourceType, resourceName)
    })
  )

  app.post(
    '/api/resources/:resourceType/:resourceName/assign',
    route(async (request) => {
      const { resourceType, resourceName } = request.params as {
        resourceType: string
        resourceName: string
      }
      if (!isNonMcpResourceType(resourceType)) {
        throw new Error(`Invalid resource type: ${resourceType}`)
      }

      const body = request.body as { assignedProjectIds?: string[] }
      if (!body.assignedProjectIds) {
        throw new Error('assignedProjectIds is required')
      }

      await resourceService.applyProjectAssignment(
        resourceType,
        resourceName,
        body.assignedProjectIds
      )
      return true
    })
  )

  app.post(
    '/api/resources/:resourceType/:resourceName/mandatory',
    route(async (request) => {
      const { resourceType, resourceName } = request.params as {
        resourceType: string
        resourceName: string
      }
      if (!isNonMcpResourceType(resourceType)) {
        throw new Error(`Invalid resource type: ${resourceType}`)
      }

      const body = request.body as { mandatory?: boolean }
      if (body.mandatory === undefined) {
        throw new Error('mandatory is required')
      }

      await resourceService.setMandatory(resourceType, resourceName, body.mandatory)
      return true
    })
  )

  app.get(
    '/api/resources/:resourceType/:resourceName/canonical',
    route(async (request) => {
      const { resourceType, resourceName } = request.params as {
        resourceType: string
        resourceName: string
      }
      if (!isNonMcpResourceType(resourceType)) {
        throw new Error(`Invalid resource type: ${resourceType}`)
      }

      const settings = settingsStore.get()
      const scan = await scannerService.scanAll(settings)
      return resourceService.findCanonicalInstance(scan, resourceType, resourceName)
    })
  )

  app.delete(
    '/api/resources/:resourceType/:resourceName',
    route(async (request) => {
      const { resourceType, resourceName } = request.params as {
        resourceType: string
        resourceName: string
      }
      if (!isNonMcpResourceType(resourceType)) {
        throw new Error(`Invalid resource type: ${resourceType}`)
      }

      const settings = settingsStore.get()
      const scan = await scannerService.scanAll(settings)
      await resourceService.deleteResource(scan, resourceType, resourceName)
      return true
    })
  )

  app.delete(
    '/api/mcps/:name',
    route(async (request) => {
      const { name } = request.params as { name: string }
      const query = request.query as { configPath?: string }
      if (!query.configPath) {
        throw new Error('configPath query parameter is required')
      }
      if (!existsSync(query.configPath)) {
        return false
      }

      const raw = await fileService.readText(query.configPath)
      const config = JSON.parse(raw) as { mcpServers?: Record<string, unknown> }
      if (config.mcpServers) {
        delete config.mcpServers[name]
      }
      await fileService.writeText(query.configPath, JSON.stringify(config, null, 2))
      return true
    })
  )

  app.post(
    '/api/mcps',
    route(async (request) => {
      const body = request.body as { name?: string; params?: Record<string, unknown> }
      if (!body.name || !body.params) {
        throw new Error('name and params are required')
      }

      const settings = settingsStore.get()
      const platform =
        settings.platforms.find((p) => p.enabled && p.id === 'cursor') ??
        settings.platforms.find((p) => p.enabled)
      if (!platform) {
        throw new Error('No enabled platform')
      }

      const adapter = getAdapter(platform.id)
      if (!adapter) {
        throw new Error('No adapter')
      }

      const paths = adapter.getPlatformPaths(platform.rootPath)
      let config: { mcpServers?: Record<string, unknown> } = { mcpServers: {} }
      if (existsSync(paths.mcpConfigPath)) {
        config = JSON.parse(await fileService.readText(paths.mcpConfigPath))
      }
      config.mcpServers ??= {}
      config.mcpServers[body.name] = body.params
      await fileService.writeText(paths.mcpConfigPath, JSON.stringify(config, null, 2))
      return paths.mcpConfigPath
    })
  )

  app.post(
    '/api/platforms',
    route(async (request) => {
      const body = request.body as {
        id?: PlatformId
        rootPath?: string
        projectDirName?: string
        enabled?: boolean
      }
      if (!body.id || !body.rootPath) {
        throw new Error('id and rootPath are required')
      }

      const projectDirName =
        typeof body.projectDirName === 'string' && body.projectDirName.trim()
          ? body.projectDirName.trim()
          : DEFAULT_PLATFORM_PROJECT_DIRS[body.id]

      settingsStore.update((s) => {
        const existing = s.platforms.find((p) => p.id === body.id)
        if (existing) {
          existing.rootPath = expandHome(body.rootPath!)
          existing.projectDirName = projectDirName
          existing.enabled = body.enabled ?? true
          return { ...s }
        }
        return {
          ...s,
          platforms: [
            ...s.platforms,
            {
              id: body.id!,
              enabled: body.enabled ?? true,
              rootPath: expandHome(body.rootPath!),
              projectDirName
            }
          ]
        }
      })

      return settingsStore.get()
    })
  )

  app.post(
    '/api/platforms/purge',
    route(async (request) => {
      const body = request.body as { platformIds?: PlatformId[] }
      if (!body.platformIds) {
        throw new Error('platformIds is required')
      }
      return platformCleanupService.purgeFromProjects(body.platformIds)
    })
  )

  app.post(
    '/api/projects/roots',
    route(async (request) => {
      const body = request.body as { scanPath?: string }
      if (!body.scanPath) {
        throw new Error('scanPath is required')
      }

      const previousIds = new Set(
        importedProjectsStore.get().flatMap((r) => r.projects.map((p) => p.id))
      )
      const projects = await scannerService.discoverGitProjects(body.scanPath)
      const enabledIds = settingsStore
        .get()
        .platforms.filter((p) => p.enabled)
        .map((p) => p.id)

      await projectBootstrapService.bootstrapProjects(
        projects.map((p) => p.path),
        enabledIds
      )

      const id = uuidv4()
      importedProjectsStore.update((roots) => [...roots, { id, scanPath: body.scanPath!, projects }])

      const newProjectIds = projects.filter((p) => !previousIds.has(p.id)).map((p) => p.id)
      await resourceService.syncMandatoryForNewProjects(newProjectIds)
      await restartWatcher()

      return { id, projects }
    })
  )

  app.post(
    '/api/projects/import',
    route(async (request) => {
      const body = request.body as { paths?: string[] }
      if (!body.paths || body.paths.length === 0) {
        throw new Error('paths is required')
      }

      const previousIds = new Set(
        importedProjectsStore.get().flatMap((r) => r.projects.map((p) => p.id))
      )
      const collected: Array<{ id: string; name: string; path: string; rootId: string }> = []

      for (const scanPath of body.paths) {
        if (existsSync(join(scanPath, '.git'))) {
          collected.push({
            id: stableId(scanPath),
            name: basename(scanPath),
            path: scanPath,
            rootId: scanPath
          })
        } else {
          const discovered = await scannerService.discoverGitProjects(scanPath)
          collected.push(...discovered)
        }
      }

      const seen = new Set(importedProjectsStore.get().flatMap((r) => r.projects.map((p) => p.id)))
      const newProjects = collected.filter((p) => !seen.has(p.id))
      if (newProjects.length === 0) {
        return { imported: 0, projects: [] }
      }

      const enabledIds = settingsStore
        .get()
        .platforms.filter((p) => p.enabled)
        .map((p) => p.id)

      await projectBootstrapService.bootstrapProjects(
        newProjects.map((p) => p.path),
        enabledIds
      )

      const rootId = uuidv4()
      importedProjectsStore.update((roots) => [
        ...roots,
        {
          id: rootId,
          scanPath: body.paths[0] ?? 'imported',
          projects: newProjects.map((p) => ({ ...p, rootId }))
        }
      ])

      const newProjectIds = newProjects.filter((p) => !previousIds.has(p.id)).map((p) => p.id)
      await resourceService.syncMandatoryForNewProjects(newProjectIds)
      await restartWatcher()

      return { imported: newProjects.length, projects: newProjects }
    })
  )

  app.delete(
    '/api/projects/:projectId',
    route(async (request) => {
      const { projectId } = request.params as { projectId: string }

      importedProjectsStore.update((roots) =>
        roots
          .map((root) => ({
            ...root,
            projects: root.projects.filter((p) => p.id !== projectId)
          }))
          .filter((root) => root.projects.length > 0)
      )

      await restartWatcher()
      return true
    })
  )

  app.post(
    '/api/debug/log',
    route(async (request) => {
      const body = request.body as {
        hypothesisId?: string
        location?: string
        message?: string
        data?: Record<string, unknown>
      }
      if (!body.hypothesisId || !body.location || !body.message) {
        throw new Error('hypothesisId, location, and message are required')
      }

      agentDebugLog(body.hypothesisId, body.location, body.message, {
        ...(body.data ?? {}),
        runId: 'post-fix'
      })
      return true
    })
  )

  app.get(
    '/api/instructions',
    route(async () => {
      const dir = getInstructionsPath()
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
        return []
      }
      return readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .sort()
    })
  )

  app.get(
    '/api/instructions/:name',
    route(async (request) => {
      const { name } = request.params as { name: string }
      const filePath = getInstructionsPath(name)
      if (!existsSync(filePath)) {
        return ''
      }
      return fileService.readText(filePath)
    })
  )

  app.put(
    '/api/instructions/:name',
    route(async (request) => {
      const { name } = request.params as { name: string }
      const body = request.body as { content?: string }
      if (body.content === undefined) {
        throw new Error('content is required')
      }

      const dir = getInstructionsPath()
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      await fileService.writeText(getInstructionsPath(name), body.content)
      return true
    })
  )

  app.post(
    '/api/instructions',
    route(async (request) => {
      const body = request.body as { name?: string }
      if (!body.name) {
        throw new Error('name is required')
      }

      const dir = getInstructionsPath()
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      const safeName = body.name.endsWith('.md') ? body.name : `${body.name}.md`
      const filePath = getInstructionsPath(safeName)
      if (!existsSync(filePath)) {
        await fileService.writeText(filePath, `# ${body.name.replace(/\.md$/, '')}\n\n`)
      }
      return safeName
    })
  )

  app.post(
    '/api/refactor',
    route(async (request) => {
      const body = request.body as OpenRouterRefactorRequest
      if (!body.resourceType || body.content === undefined || !body.userPrompt) {
        throw new Error('resourceType, content, and userPrompt are required')
      }
      return refactorWithActiveApi(body)
    })
  )
}
