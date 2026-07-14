export interface AmoCrmOAuthStateSnapshot {
  expiresAt: string;
  consumedAt?: string;
  cancelledAt?: string;
}

export function isAmoCrmOAuthStateExpired(
  state: AmoCrmOAuthStateSnapshot,
  now = new Date(),
): boolean {
  const expiresAt = new Date(state.expiresAt).getTime();
  return !Number.isFinite(expiresAt) || expiresAt <= now.getTime();
}

export function isAmoCrmOAuthStateConsumed(state: AmoCrmOAuthStateSnapshot): boolean {
  return Boolean(state.consumedAt);
}

export function isAmoCrmOAuthStateCancelled(state: AmoCrmOAuthStateSnapshot): boolean {
  return Boolean(state.cancelledAt);
}

export function canConsumeAmoCrmOAuthState(
  state: AmoCrmOAuthStateSnapshot,
  now = new Date(),
): boolean {
  return !isAmoCrmOAuthStateExpired(state, now)
    && !isAmoCrmOAuthStateConsumed(state)
    && !isAmoCrmOAuthStateCancelled(state);
}
