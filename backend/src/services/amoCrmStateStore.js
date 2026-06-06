const crypto = require('crypto');

/**
 * In-memory map of OAuth states for development and skeleton testing only.
 * Structure: { [stateString]: { createdAt: number } }
 */
const stateStore = new Map();

/**
 * Expiration time for OAuth states: 10 minutes.
 */
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Removes all expired states passively.
 * Does not require a background interval for this dev-only skeleton.
 */
function clearExpiredOAuthStates() {
  const now = Date.now();
  for (const [state, data] of stateStore.entries()) {
    if (now - data.createdAt > STATE_TTL_MS) {
      stateStore.delete(state);
    }
  }
}

/**
 * Generates a random secure state string and stores it with a timestamp.
 * Passively clears expired states during generation.
 * @returns {string} The generated state.
 */
function createOAuthState() {
  clearExpiredOAuthStates();
  
  const state = crypto.randomBytes(32).toString('hex');
  stateStore.set(state, { createdAt: Date.now() });
  
  return state;
}

/**
 * Validates a given OAuth state string.
 * It is one-time use only: if valid, it is immediately deleted.
 * Passively clears expired states during validation.
 * @param {string} state 
 * @returns {boolean} True if state is valid and not expired.
 */
function validateOAuthState(state) {
  clearExpiredOAuthStates();
  
  if (!state || typeof state !== 'string') {
    return false;
  }
  
  const stateData = stateStore.get(state);
  if (!stateData) {
    return false;
  }
  
  // It's a valid, unexpired state (since clearExpiredOAuthStates ran).
  // Burn the state (one-time use).
  stateStore.delete(state);
  return true;
}

module.exports = {
  createOAuthState,
  validateOAuthState,
  clearExpiredOAuthStates
};
