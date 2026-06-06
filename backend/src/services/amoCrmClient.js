/**
 * Placeholder amoCRM client.
 * AMO-003 constraint: This file must not call network.
 * Forbidden: fetch, axios, XMLHttpRequest, real amoCRM URLs, usage of access/refresh tokens or client_secret.
 */

function assertAmoCrmApiNotImplemented() {
  throw new Error('Real amoCRM API is not implemented in AMO-003 skeleton.');
}

function placeholderSyncContact() {
  return assertAmoCrmApiNotImplemented();
}

function placeholderSyncLead() {
  return assertAmoCrmApiNotImplemented();
}

module.exports = {
  assertAmoCrmApiNotImplemented,
  placeholderSyncContact,
  placeholderSyncLead
};
