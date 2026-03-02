const mongoose = require('mongoose');
const crypto = require('crypto');

// Encryption helpers — uses AES-256-CBC
// ENCRYPTION_KEY must be a 32-byte hex string in .env
const ALGORITHM = 'aes-256-cbc';

const getKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || Buffer.from(key, 'hex').length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string in .env');
  }
  return Buffer.from(key, 'hex');
};

const encrypt = (plainText) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  // Store as iv:encryptedData (both hex-encoded)
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

const decrypt = (cipherText) => {
  const [ivHex, encryptedHex] = cipherText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
};

// ─── Schema ──────────────────────────────────────────────────────────────────

const cloudCredentialsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  provider: {
    type: String,
    enum: ['AWS', 'Azure', 'GCP'],
    required: [true, 'Provider is required']
  },
  // Stored encrypted as "iv:ciphertext"
  accessKeyId: {
    type: String,
    required: [true, 'Access Key ID is required']
  },
  secretAccessKey: {
    type: String,
    required: [true, 'Secret Access Key is required']
  },
  region: {
    type: String,
    required: [true, 'Region is required'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// ─── Pre-save: encrypt sensitive fields ──────────────────────────────────────

cloudCredentialsSchema.pre('save', function (next) {
  // Only encrypt if the field was modified (prevents double-encrypting)
  if (this.isModified('accessKeyId')) {
    this.accessKeyId = encrypt(this.accessKeyId);
  }
  if (this.isModified('secretAccessKey')) {
    this.secretAccessKey = encrypt(this.secretAccessKey);
  }
  next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Returns the decrypted access key ID in plain text.
 */
cloudCredentialsSchema.methods.getDecryptedAccessKeyId = function () {
  return decrypt(this.accessKeyId);
};

/**
 * Returns the decrypted secret access key in plain text.
 */
cloudCredentialsSchema.methods.getDecryptedSecretAccessKey = function () {
  return decrypt(this.secretAccessKey);
};

/**
 * Marks this credential as inactive (soft-disable).
 */
cloudCredentialsSchema.methods.deactivate = async function () {
  this.isActive = false;
  return this.save();
};

module.exports = mongoose.model('CloudCredentials', cloudCredentialsSchema);
