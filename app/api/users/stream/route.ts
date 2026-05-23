import { NextResponse } from "next/server"

// In-memory set of SSE response writers — keyed by a random id
const clients = new Map<string, ReadableStreamDefaultController<Uint8Array>>()

export function notifyUsersChanged() {
  const msg = new TextEncoder().encode(`data: users_changed\n\n`)
  for (const controller of clients.values()) {
    try {
      controller.enqueue(msg)
    } catch {
      // client disconnected
    }
  }
}

export async function GET() {
  const clientId = Math.random().toString(36).slice(2)

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      clients.set(clientId, controller)
      // send a keep-alive immediately
      controller.enqueue(new TextEncoder().encode(`: connected\n\n`))
    },
    cancel() {
      clients.delete(clientId)
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
