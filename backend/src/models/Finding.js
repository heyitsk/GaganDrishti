import mongoose from 'mongoose';

const findingSchema = new mongoose.Schema({
  scanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scan',
    required: [true, 'Scan ID is required'],
    index: true
  },
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
  // e.g. "S3", "EC2 Security Group", "IAM"
  service: {
    type: String,
    required: [true, 'Service is required'],
    trim: true
  },
  // e.g. bucket name, security group ID
  resource: {
    type: String,
    required: [true, 'Resource identifier is required'],
    trim: true
  },
  resourceName: {
    type: String,
    trim: true,
    default: null
  },
  issue: {
    type: String,
    required: [true, 'Issue description is required']
  },
  severity: {
    type: String,
    enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    required: [true, 'Severity is required']
  },
  // Freeform provider-specific metadata (bucket policy, SG rules, etc.)
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  recommendation: {
    type: String,
    default: null
  },
  detectedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['open', 'resolved', 'ignored'],
    default: 'open'
  }
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Marks the finding as resolved.
 */
findingSchema.methods.resolve = async function () {
  this.status = 'resolved';
  return this.save();
};

/**
 * Marks the finding as ignored.
 */
findingSchema.methods.ignore = async function () {
  this.status = 'ignored';
  return this.save();
};

export default mongoose.model('Finding', findingSchema);
