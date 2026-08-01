import type { Ack, AckFailure } from "../types/events.js";

export function fail<T>(ack: Ack<T> | undefined, code: string, message: string): AckFailure {
  const response: AckFailure = { ok: false, error: { code, message } };
  ack?.(response);
  return response;
}

export function succeed<T>(ack: Ack<T> | undefined, data: T): void {
  ack?.({ ok: true, data });
}
