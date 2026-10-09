type SseClient = {
  write: (chunk: string) => void
  close: () => void
}

type ScanChangedListener = () => void

const clients = new Set<SseClient>()
const listeners = new Set<ScanChangedListener>()

export function addSseClient(client: SseClient): () => void {
  clients.add(client)
  return () => {
    clients.delete(client)
  }
}

/** Register an in-process listener fired alongside the SSE broadcast. */
export function onScanChanged(listener: ScanChangedListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyScanChanged(): void {
  const payload = `event: scan-changed\ndata: {}\n\n`
  for (const client of clients) {
    try {
      client.write(payload)
    } catch {
      clients.delete(client)
    }
  }
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      listeners.delete(listener)
    }
  }
}
