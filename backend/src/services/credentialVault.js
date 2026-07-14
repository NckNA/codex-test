const crypto = require('crypto');

class CredentialVaultError extends Error {
  constructor(code) {
    super(code);
    this.name = 'CredentialVaultError';
    this.code = code;
  }
}

function decodeKey(value) {
  const raw = String(value || '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  try {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32) return decoded;
  } catch {
    // Deliberately fall through to a safe configuration error.
  }
  throw new CredentialVaultError('configuration_error');
}

class CredentialVault {
  constructor({ key, keyVersion = 1, randomBytes = crypto.randomBytes }) {
    this.key = decodeKey(key);
    this.keyVersion = Number(keyVersion);
    this.randomBytes = randomBytes;
    if (!Number.isInteger(this.keyVersion) || this.keyVersion < 1) {
      throw new CredentialVaultError('configuration_error');
    }
  }

  encrypt(value) {
    const plaintext = String(value || '');
    if (!plaintext) throw new CredentialVaultError('encryption_error');
    try {
      const iv = this.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      const envelope = {
        algorithm: 'aes-256-gcm',
        keyVersion: this.keyVersion,
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        ciphertext: ciphertext.toString('base64'),
      };
      return Buffer.from(JSON.stringify(envelope), 'utf8');
    } catch {
      throw new CredentialVaultError('encryption_error');
    }
  }

  decrypt(encrypted) {
    try {
      const bytes = Buffer.isBuffer(encrypted) ? encrypted : Buffer.from(encrypted);
      const envelope = JSON.parse(bytes.toString('utf8'));
      if (envelope.algorithm !== 'aes-256-gcm') throw new Error('algorithm');
      if (Number(envelope.keyVersion) !== this.keyVersion) throw new Error('key_version');
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(envelope.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new CredentialVaultError('encryption_error');
    }
  }

  toBytea(buffer) {
    return `\\x${Buffer.from(buffer).toString('hex')}`;
  }

  fromHex(hex) {
    const normalized = String(hex || '').replace(/^\\x/, '');
    if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length % 2 !== 0) {
      throw new CredentialVaultError('encryption_error');
    }
    return Buffer.from(normalized, 'hex');
  }
}

module.exports = {
  CredentialVault,
  CredentialVaultError,
  decodeKey,
};
