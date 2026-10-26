import { handle, type EngineRequest } from './engineCore';
const ctx = self as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage(m: unknown): void };
ctx.onmessage = (e: MessageEvent) => {
  const { id, req } = e.data as { id: number; req: EngineRequest };
  try { ctx.postMessage({ id, reply: handle(req) }); } catch (err) { ctx.postMessage({ id, error: String(err) }); }
};
