import { SESSION_ID_BYTES } from "@/lib/qr-payload";

export function createSessionId(): Uint8Array {
  const sessionId = new Uint8Array(SESSION_ID_BYTES);
  crypto.getRandomValues(sessionId);
  return sessionId;
}

export function sessionIdToHex(sessionId: Uint8Array): string {
  return Array.from(sessionId)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function createTransferSession() {
  const sessionId = createSessionId();
  return {
    sessionId,
    sessionIdHex: sessionIdToHex(sessionId),
    startedAt: Date.now(),
  };
}

export type TransferSession = ReturnType<typeof createTransferSession>;
