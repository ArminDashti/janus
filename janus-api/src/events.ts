type SseClient = {
  write: (chunk: string) => void
  close: () => void
}

const clients = new Set<SseClient>()

export function addSseClient(client: SseClient): () => void {
  clients.add(client)
  return () => {
    clients.delete(client)
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
}
