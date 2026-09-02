import { Agent } from '@cursor/sdk'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { settingsStore } from './settings-store'
import type {
  OpenRouterRefactorRequest,
  OpenRouterRefactorResult,
  OpenRouterRefactorType
} from './openrouter.service'

const TYPE_LABELS: Record<OpenRouterRefactorType, string> = {
  skill: 'Skills',
  rule: 'Rules',
  hook: 'Hooks',
  subAgent: 'Sub-agent'
}

const RESOURCE_FILE = 'resource.md'

function buildCursorPrompt(resourceType: OpenRouterRefactorType, userPrompt: string): string {
  const label = TYPE_LABELS[resourceType]
  return [
    `You are editing the file \`${RESOURCE_FILE}\` in this workspace.`,
    `This file is a Janus ${label} resource used by an AI coding agent.`,
    `Apply the user's editing instructions by modifying \`${RESOURCE_FILE}\` in place.`,
    'Edit only what the request requires. Preserve formatting and indentation where unchanged.',
    'Do not create other files. Do not ask questions. When finished, stop.',
    '',
    '## User request:',
    userPrompt
  ].join('\n')
}

/**
 * Refactor resource content via Cursor Local SDK (@cursor/sdk).
 * Writes content to a temp workspace, runs a one-shot local agent, reads the file back.
 */
export async function refactorWithCursorApi(
  request: OpenRouterRefactorRequest
): Promise<OpenRouterRefactorResult> {
  const settings = settingsStore.get()
  const apiKey = settings.cursorApi?.apiKey?.trim() ?? ''
  const model = settings.cursorApi?.model?.trim() || 'composer-2.5'

  if (!apiKey) {
    throw new Error('CursorAPI key is not configured. Set it in Settings → API.')
  }
  if (!request.userPrompt.trim()) {
    throw new Error('A user prompt is required')
  }
  if (!request.content.trim()) {
    throw new Error('Resource content is empty')
  }

  const workDir = mkdtempSync(join(tmpdir(), 'janus-cursor-refactor-'))
  const filePath = join(workDir, RESOURCE_FILE)

  let agent: Awaited<ReturnType<typeof Agent.create>> | null = null
  try {
    writeFileSync(filePath, request.content, 'utf-8')

    agent = await Agent.create({
      apiKey,
      model: { id: model },
      local: { cwd: workDir }
    })

    const run = await agent.send(buildCursorPrompt(request.resourceType, request.userPrompt.trim()))
    const result = await run.wait()

    if (result.status === 'error') {
      throw new Error(result.error?.message ?? 'CursorAPI refactor failed')
    }
    if (result.status === 'cancelled') {
      throw new Error('CursorAPI refactor was cancelled')
    }

    const updated = readFileSync(filePath, 'utf-8')
    if (!updated.trim()) {
      throw new Error('CursorAPI left the resource file empty')
    }

    return {
      content: updated,
      model
    }
  } finally {
    if (agent) {
      try {
        await agent[Symbol.asyncDispose]()
      } catch {
        // ignore dispose errors
      }
    }
    try {
      rmSync(workDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  }
}
