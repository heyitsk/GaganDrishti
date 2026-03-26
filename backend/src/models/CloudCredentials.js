import mongoose from 'mongoose';
import crypto from 'crypto';

// ─── Encryption helpers — AES-256-CBC ─────────────────────────────────────────
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
  accountName: {
    type: String,
    trim: true,
    maxlength: [50, 'Account name must not exceed 50 characters'],
    default: ''
  },
  provider: {
    type: String,
    enum: ['AWS', 'Azure', 'GCP'],
    required: [true, 'Provider is required']
  },
  // ─── Dual-mode auth ─────────────────────────────────────────────────────────
  // 'role'  → store only roleArn, use STS AssumeRole at scan-time (recommended)
  // 'keys'  → store encrypted accessKeyId + secretAccessKey (fallback)
  authType: {
    type: String,
    enum: ['role', 'keys'],
    required: [true, 'Auth type is required']
  },

  // Role mode fields
  roleArn: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        // Required only when authType is 'role'
        if (this.authType === 'role') return !!v && v.length > 0;
        return true;
      },
      message: 'Role ARN is required when authType is "role"'
    }
  },

  // Keys mode fields — stored encrypted as "iv:ciphertext"
  accessKeyId: {
    type: String,
    validate: {
      validator: function (v) {
        if (this.authType === 'keys') return !!v && v.length > 0;
        return true;
      },
      message: 'Access Key ID is required when authType is "keys"'
    }
  },
  secretAccessKey: {
    type: String,
    validate: {
      validator: function (v) {
        if (this.authType === 'keys') return !!v && v.length > 0;
        return true;
      },
      message: 'Secret Access Key is required when authType is "keys"'
    }
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

// ─── Pre-save: encrypt sensitive fields (keys mode only) ─────────────────────

cloudCredentialsSchema.pre('save', function () {
  if (this.authType === 'keys') {
    if (this.isModified('accessKeyId')) {
      this.accessKeyId = encrypt(this.accessKeyId);
    }
    if (this.isModified('secretAccessKey')) {
      this.secretAccessKey = encrypt(this.secretAccessKey);
    }
  }
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Returns the decrypted access key ID (keys mode only).
 */
cloudCredentialsSchema.methods.getDecryptedAccessKeyId = function () {
  if (this.authType !== 'keys') throw new Error('Cannot decrypt — authType is not "keys"');
  return decrypt(this.accessKeyId);
};

/**
 * Returns the decrypted secret access key (keys mode only).
 */
cloudCredentialsSchema.methods.getDecryptedSecretAccessKey = function () {
  if (this.authType !== 'keys') throw new Error('Cannot decrypt — authType is not "keys"');
  return decrypt(this.secretAccessKey);
};

/**
 * Returns a safe JSON representation — credentials masked, never raw encrypted blobs.
 */
cloudCredentialsSchema.methods.toSafeJSON = function () {
  const obj = {
    _id: this._id,
    userId: this.userId,
    accountName: this.accountName,
    provider: this.provider,
    authType: this.authType,
    region: this.region,
    isActive: this.isActive,
    createdAt: this.createdAt,
  };

  if (this.authType === 'role') {
    obj.roleArn = this.roleArn;
  } else {
    // Show only last 4 chars of the access key ID
    const decryptedKeyId = this.getDecryptedAccessKeyId();
    obj.accessKeyId = '****' + decryptedKeyId.slice(-4);
    obj.secretAccessKey = '********';
  }

  return obj;
};

/**
 * Marks this credential as inactive (soft-disable).
 */
cloudCredentialsSchema.methods.deactivate = async function () {
  this.isActive = false;
  return this.save();
};

export default mongoose.model('CloudCredentials', cloudCredentialsSchema);
