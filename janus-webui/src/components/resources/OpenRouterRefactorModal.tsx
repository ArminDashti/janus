import { useEffect, useState } from 'react'
import type {
  HookResource,
  RuleResource,
  SkillResource,
  SubAgentResource
} from '@shared/types'
import { parseFrontmatter } from '@shared/utils.browser'
import {
  extractResourceMeta,
  ensureResourceMeta,
  formatMetaTimestamp,
  upsertMarkdownMeta
} from '@shared/resource-meta'
import { showMessage } from '@renderer/stores/messageStore'
import { useAppStore } from '@renderer/stores/appStore'

export type OpenRouterRefactorResourceType = 'skill' | 'rule' | 'hook' | 'subAgent'

const TYPE_LABELS: Record<OpenRouterRefactorResourceType, string> = {
  skill: 'Skill',
  rule: 'Rule',
  hook: 'Hook',
  subAgent: 'Sub-agent'
}

interface OpenRouterRefactorModalProps {
  resourceType: OpenRouterRefactorResourceType
  resourceName: string
  /** When provided (e.g. from edit view), skip loading from disk. */
  initialContent?: string
  initialFilePath?: string
  onClose: () => void
  /** Called after a successful apply with the new content. */
  onApplied?: (content: string, filePath: string) => void
}

function getDefaultFile(
  resource: SkillResource | RuleResource | HookResource | SubAgentResource,
  resourceType: OpenRouterRefactorResourceType
): string {
  switch (resourceType) {
    case 'skill':
      return (resource as SkillResource).skillMdPath
    case 'rule':
      return (resource as RuleResource).filePath
    case 'hook': {
      const h = resource as HookResource
      return h.scriptPath ?? h.configPath
    }
    case 'subAgent':
      return (resource as SubAgentResource).filePath
  }
}

function providerLabel(provider: 'openRouter' | 'cursorApi' | undefined): string {
  return provider === 'cursorApi' ? 'CursorAPI' : 'OpenRouter'
}

export function OpenRouterRefactorModal({
  resourceType,
  resourceName,
  initialContent,
  initialFilePath,
  onClose,
  onApplied
}: OpenRouterRefactorModalProps) {
  const { settings } = useAppStore()
  const [userPrompt, setUserPrompt] = useState('')
  const [content, setContent] = useState(initialContent ?? '')
  const [filePath, setFilePath] = useState(initialFilePath ?? '')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(!initialContent)
  const [running, setRunning] = useState(false)
  const [applying, setApplying] = useState(false)

  const activeProvider = settings?.activeApiProvider ?? 'openRouter'
  const activeLabel = providerLabel(activeProvider)
  const configured =
    activeProvider === 'cursorApi'
      ? Boolean(settings?.cursorApi?.apiKey?.trim())
      : Boolean(settings?.openRouter?.apiKey?.trim())
  const model =
    activeProvider === 'cursorApi'
      ? settings?.cursorApi?.model?.trim() || 'composer-2.5'
      : settings?.openRouter?.model?.trim() || 'openai/gpt-4o-mini'

  useEffect(() => {
    if (initialContent != null && initialFilePath) {
      setContent(initialContent)
      setFilePath(initialFilePath)
      setLoading(false)
      return
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const canonical = await window.agentManager.getCanonicalResource(resourceType, resourceName)
        if (!canonical || cancelled) return
        const path = getDefaultFile(
          canonical as SkillResource | RuleResource | HookResource | SubAgentResource,
          resourceType
        )
        const text = await window.agentManager.readFile(path)
        if (cancelled) return
        setFilePath(path)
        setContent(text)
      } catch (e) {
        if (!cancelled) {
          await showMessage({
            message: e instanceof Error ? e.message : 'Failed to load resource',
            type: 'error'
          })
          onClose()
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [resourceType, resourceName, initialContent, initialFilePath, onClose])

  const runRefactor = async () => {
    if (!configured) {
      await showMessage({
        message: 'Configure AI in Settings → API and set it as the active provider.',
        type: 'error'
      })
      return
    }
    if (!userPrompt.trim()) {
      await showMessage({ message: 'Enter editing instructions', type: 'error' })
      return
    }
    if (!content.trim()) {
      await showMessage({ message: 'Resource content is empty', type: 'error' })
      return
    }

    setRunning(true)
    setResult(null)
    try {
      const response = await window.agentManager.apiRefactor({
        resourceType,
        content,
        userPrompt: userPrompt.trim()
      })
      setResult(response.content)
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'AI edit failed',
        type: 'error'
      })
    } finally {
      setRunning(false)
    }
  }

  const applyResult = async () => {
    if (!result || !filePath) return
    const confirmed = await showMessage({
      message: `Apply AI result to ${filePath.replace(/\\/g, '/').split('/').pop()}?`,
      confirm: true
    })
    if (!confirmed) return

    setApplying(true)
    try {
      let toWrite = result
      if (resourceType !== 'hook' && content.includes('---')) {
        const originalMeta = extractResourceMeta(parseFrontmatter(content).frontmatter)
        const nextParsed = parseFrontmatter(result)
        const nextMeta = extractResourceMeta(nextParsed.frontmatter)
        const meta = ensureResourceMeta({
          ...nextMeta,
          uuid: originalMeta.uuid || nextMeta.uuid,
          last_updated: formatMetaTimestamp()
        })
        toWrite = upsertMarkdownMeta(result, meta, {
          name: nextParsed.frontmatter.name,
          description: nextParsed.frontmatter.description ?? '',
          'disable-model-invocation': nextParsed.frontmatter['disable-model-invocation'],
          globs: nextParsed.frontmatter.globs,
          alwaysApply: nextParsed.frontmatter.alwaysApply,
          model: nextParsed.frontmatter.model
        })
      }
      await window.agentManager.writeFile(filePath, toWrite)
      onApplied?.(toWrite, filePath)
      await showMessage({ message: 'Edited content applied', type: 'success' })
      onClose()
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Failed to write file',
        type: 'error'
      })
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
        <h3 className="font-medium mb-1">Edit by AI</h3>
        <p className="text-xs text-zinc-500 mb-4">
          {TYPE_LABELS[resourceType]}: {resourceName}
          {model ? ` · ${model}` : ''}
        </p>

        {!configured && (
          <p className="text-xs text-amber-500 mb-3">
            AI provider is not configured. Add your key and model in Settings → API, and keep it
            active.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-zinc-500 py-8 text-center">Loading resource…</p>
        ) : (
          <>
            <label className="text-sm text-zinc-400 mb-1 block">Editing instructions</label>
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="Describe how this resource should be edited…"
              rows={5}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm mb-3 resize-y min-h-[100px]"
              disabled={running || applying}
            />

            {result != null && (
              <>
                <label className="text-sm text-zinc-400 mb-1 block">Result preview</label>
                <textarea
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  rows={12}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm mb-3 resize-y font-mono text-xs min-h-[180px]"
                  disabled={running || applying}
                />
              </>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 mt-auto pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm bg-zinc-800 rounded"
            disabled={running || applying}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void runRefactor()}
            disabled={loading || running || applying || !configured}
            className="px-4 py-2 text-sm bg-blue-600 rounded disabled:opacity-50"
          >
            {running ? 'Editing…' : result != null ? 'Re-run' : 'Edit'}
          </button>
          {result != null && (
            <button
              type="button"
              onClick={() => void applyResult()}
              disabled={applying || running}
              className="px-4 py-2 text-sm bg-emerald-700 rounded disabled:opacity-50"
            >
              {applying ? 'Applying…' : 'Apply'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
