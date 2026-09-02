import { settingsStore } from './settings-store'
import {
  refactorWithOpenRouter,
  type OpenRouterRefactorRequest,
  type OpenRouterRefactorResult
} from './openrouter.service'
import { refactorWithCursorApi } from './cursorapi.service'

/**
 * Route resource refactor to the active Settings → API provider.
 */
export async function refactorWithActiveApi(
  request: OpenRouterRefactorRequest
): Promise<OpenRouterRefactorResult & { provider: 'openRouter' | 'cursorApi' }> {
  const provider = settingsStore.get().activeApiProvider ?? 'openRouter'

  if (provider === 'cursorApi') {
    const result = await refactorWithCursorApi(request)
    return { ...result, provider: 'cursorApi' }
  }

  const result = await refactorWithOpenRouter(request)
  return { ...result, provider: 'openRouter' }
}
