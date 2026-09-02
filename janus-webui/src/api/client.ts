import type { AgentManagerApi } from './types'
import type { AppSettings, PlatformId } from '@shared/types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8005'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || response.statusText)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>
  }

  return response.text() as Promise<T>
}

function encodeQuery(value: string): string {
  return encodeURIComponent(value)
}

export const agentManagerClient: AgentManagerApi = {
  getAppRoot: () => request<string>('/api/app/root'),

  getSettings: () => request<AppSettings>('/api/settings'),

  saveSettings: (settings) =>
    request<AppSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    }),

  resetSettings: () =>
    request<AppSettings>('/api/settings/reset', {
      method: 'POST'
    }),

  scanAll: (options) => {
    const probe = options?.probeMcps ? 'true' : 'false'
    return request(`/api/scan?probeMcps=${probe}`)
  },

  discoverProjects: (scanPath) =>
    request(`/api/scan/projects?path=${encodeQuery(scanPath)}`),

  readFile: (path) => request<string>(`/api/files?path=${encodeQuery(path)}`),

  writeFile: (path, content) =>
    request<boolean>('/api/files', {
      method: 'PUT',
      body: JSON.stringify({ path, content })
    }),

  listDir: (path) => request<string[]>(`/api/files/list?path=${encodeQuery(path)}`),

  listEntries: (path) =>
    request(`/api/files/entries?path=${encodeQuery(path)}`),

  openDirectory: async () => null,

  openDirectories: async () => [],

  getAssignTargets: (resourceType) =>
    request(`/api/resources/${resourceType}/targets`),

  getResourceStats: (resourceType) =>
    request(`/api/resources/${resourceType}/stats`),

  getProjectMatrix: (resourceType, resourceName) =>
    request(`/api/resources/${resourceType}/${encodeURIComponent(resourceName)}/matrix`),

  applyProjectAssignment: (resourceType, resourceName, assignedProjectIds) =>
    request<boolean>(`/api/resources/${resourceType}/${encodeURIComponent(resourceName)}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assignedProjectIds })
    }),

  applyAllToAllProjects: (resourceType) =>
    request<number>(`/api/resources/${resourceType}/assign-all`, {
      method: 'POST'
    }),

  setMandatory: (resourceType, resourceName, mandatory) =>
    request<boolean>(`/api/resources/${resourceType}/${encodeURIComponent(resourceName)}/mandatory`, {
      method: 'POST',
      body: JSON.stringify({ mandatory })
    }),

  setResourceCategory: (resourceType, resourceName, category) =>
    request<boolean>(`/api/resources/${resourceType}/${encodeURIComponent(resourceName)}/category`, {
      method: 'POST',
      body: JSON.stringify({ category })
    }),

  renameResource: (resourceType, oldName, newName) =>
    request<boolean>(`/api/resources/${resourceType}/rename`, {
      method: 'POST',
      body: JSON.stringify({ oldName, newName })
    }),

  deleteResource: (resourceType, resourceName) =>
    request<boolean>(`/api/resources/${resourceType}/${encodeURIComponent(resourceName)}`, {
      method: 'DELETE'
    }),

  createResource: (resourceType, name, projectIds) =>
    request<boolean>(`/api/resources/${resourceType}`, {
      method: 'POST',
      body: JSON.stringify({ name, projectIds })
    }),

  getCanonicalResource: (resourceType, resourceName) =>
    request(`/api/resources/${resourceType}/${encodeURIComponent(resourceName)}/canonical`),

  deleteMcp: (name, configPath) =>
    request<boolean>(`/api/mcps/${encodeURIComponent(name)}?configPath=${encodeQuery(configPath)}`, {
      method: 'DELETE'
    }),

  addMcp: (name, params) =>
    request<string>('/api/mcps', {
      method: 'POST',
      body: JSON.stringify({ name, params })
    }),

  addPlatform: (id, rootPath) =>
    request<AppSettings>('/api/platforms', {
      method: 'POST',
      body: JSON.stringify({ id, rootPath })
    }),

  addProjectRoot: (scanPath) =>
    request('/api/projects/roots', {
      method: 'POST',
      body: JSON.stringify({ scanPath })
    }),

  importProjects: (paths) =>
    request('/api/projects/import', {
      method: 'POST',
      body: JSON.stringify({ paths })
    }),

  removeProject: (projectId) =>
    request<boolean>(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE'
    }),

  getLogoPath: async (platformId) => `/logos/${platformId}.svg`,

  getBrandingPath: async (name) => `/branding/${name}.png`,

  purgePlatformsFromProjects: (platformIds) =>
    request('/api/platforms/purge', {
      method: 'POST',
      body: JSON.stringify({ platformIds })
    }),

  minimizeWindow: async () => false,

  maximizeWindow: async () => false,

  closeWindow: async () => false,

  isWindowMaximized: async () => false,

  debugLog: async (hypothesisId, location, message, data) => {
    try {
      await request<boolean>('/api/debug/log', {
        method: 'POST',
        body: JSON.stringify({ hypothesisId, location, message, data: data ?? {} })
      })
      return true
    } catch {
      return false
    }
  },

  writeSkillMd: (filePath, content, currentResourceName) =>
    request<boolean>('/api/files/skill-md', {
      method: 'PUT',
      body: JSON.stringify({ filePath, content, currentResourceName })
    }),

  listInstructions: () => request<string[]>('/api/instructions'),

  readInstruction: (name) =>
    request<string>(`/api/instructions/${encodeURIComponent(name)}`),

  saveInstruction: (name, content) =>
    request<boolean>(`/api/instructions/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    }),

  createInstruction: (name) =>
    request<string>('/api/instructions', {
      method: 'POST',
      body: JSON.stringify({ name })
    }),

  openRouterRefactor: (requestBody) =>
    request('/api/refactor', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    }),

  apiRefactor: (requestBody) =>
    request('/api/refactor', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    })
}

export function connectScanEvents(): EventSource {
  const source = new EventSource(`${API_BASE}/api/events`)
  source.onmessage = () => {
    window.dispatchEvent(new Event('scan-changed'))
  }
  return source
}
