import {
  refactorWithOpenRouter,
  type OpenRouterRefactorRequest,
  type OpenRouterRefactorResult
} from './openrouter.service'

/**
 * Route resource refactor to the configured Settings → API provider (OpenRouter).
 */
export async function refactorWithActiveApi(
  request: OpenRouterRefactorRequest
): Promise<OpenRouterRefactorResult & { provider: 'openRouter' }> {
  const result = await refactorWithOpenRouter(request)
  return { ...result, provider: 'openRouter' }
}
