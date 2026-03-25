import mongoose from 'mongoose';

const scanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  credentialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CloudCredentials',
    required: [true, 'Credential ID is required']
  },
  provider: {
    type: String,
    enum: ['AWS', 'Azure', 'GCP'],
    required: [true, 'Provider is required']
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  totalFindings: {
    type: Number,
    default: 0,
    min: 0
  },
  criticalCount: {
    type: Number,
    default: 0,
    min: 0
  },
  highCount: {
    type: Number,
    default: 0,
    min: 0
  },
  mediumCount: {
    type: Number,
    default: 0,
    min: 0
  }
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Marks the scan as completed, records completedAt timestamp,
 * and updates finding counts.
 * @param {{ totalFindings, criticalCount, highCount, mediumCount }} counts
 */
scanSchema.methods.markCompleted = async function (counts = {}) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.totalFindings = counts.totalFindings ?? this.totalFindings;
  this.criticalCount = counts.criticalCount ?? this.criticalCount;
  this.highCount = counts.highCount ?? this.highCount;
  this.mediumCount = counts.mediumCount ?? this.mediumCount;
  return this.save();
};

/**
 * Marks the scan as failed and records completedAt timestamp.
 */
scanSchema.methods.markFailed = async function () {
  this.status = 'failed';
  this.completedAt = new Date();
  return this.save();
};

export default mongoose.model('Scan', scanSchema);
