/**
 * Placeholder token store service for amoCRM integration.
 * Real token storage will be implemented later server-side only.
 * DO NOT store real tokens, write to disk, use localStorage, or log tokens in AMO-003.
 */

function getConnectionStatus() {
  // Returns fixed status for AMO-003
  return { connected: false };
}

function saveTokenPlaceholder() {
  // Placeholder: No tokens are actually saved.
  return false;
}

function clearTokenPlaceholder() {
  // Placeholder: No tokens are actually cleared.
  return false;
}

module.exports = {
  getConnectionStatus,
  saveTokenPlaceholder,
  clearTokenPlaceholder
};
