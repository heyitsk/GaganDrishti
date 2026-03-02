const { z } = require('zod');

// Registration validation schema
const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters long')
    .max(30, 'Username must not exceed 30 characters'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters long')
    .max(100, 'Password must not exceed 100 characters')
});

// Login validation schema
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

// ─── CloudCredentials Schemas ─────────────────────────────────────────────────

const cloudCredentialsSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  provider: z.enum(['AWS', 'Azure', 'GCP'], {
    errorMap: () => ({ message: 'Provider must be AWS, Azure, or GCP' })
  }),
  accessKeyId: z.string().min(1, 'Access Key ID is required'),
  secretAccessKey: z.string().min(1, 'Secret Access Key is required'),
  region: z.string().min(1, 'Region is required'),
  isActive: z.boolean().optional().default(true)
});

// ─── Scan Schemas ─────────────────────────────────────────────────────────────

const scanSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  credentialId: z.string().min(1, 'Credential ID is required'),
  provider: z.enum(['AWS', 'Azure', 'GCP'], {
    errorMap: () => ({ message: 'Provider must be AWS, Azure, or GCP' })
  }),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional().default('pending')
});

// For PATCH/update endpoints — all fields optional
const updateScanSchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  totalFindings: z.number().int().min(0).optional(),
  criticalCount: z.number().int().min(0).optional(),
  highCount: z.number().int().min(0).optional(),
  mediumCount: z.number().int().min(0).optional()
});

// ─── Finding Schemas ──────────────────────────────────────────────────────────

const findingSchema = z.object({
  scanId: z.string().min(1, 'Scan ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  provider: z.enum(['AWS', 'Azure', 'GCP'], {
    errorMap: () => ({ message: 'Provider must be AWS, Azure, or GCP' })
  }),
  service: z.string().min(1, 'Service is required'),
  resource: z.string().min(1, 'Resource identifier is required'),
  resourceName: z.string().optional().nullable(),
  issue: z.string().min(1, 'Issue description is required'),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], {
    errorMap: () => ({ message: 'Severity must be CRITICAL, HIGH, MEDIUM, or LOW' })
  }),
  details: z.record(z.unknown()).optional().default({}),
  recommendation: z.string().optional().nullable(),
  status: z.enum(['open', 'resolved', 'ignored']).optional().default('open')
});

const updateFindingStatusSchema = z.object({
  status: z.enum(['open', 'resolved', 'ignored'], {
    errorMap: () => ({ message: 'Status must be open, resolved, or ignored' })
  })
});

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Auth
  registerSchema,
  loginSchema,
  // CloudCredentials
  cloudCredentialsSchema,
  // Scan
  scanSchema,
  updateScanSchema,
  // Finding
  findingSchema,
  updateFindingStatusSchema
};
