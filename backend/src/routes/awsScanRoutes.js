import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  scanS3PublicAccess,
  scanS3Encryption,
  scanEC2,
  scanIAMUsers,
  scanRDS,
  scanAll,
  enqueueSingleScan,
  enqueueFullScan,
  getJobStatus,
} from '../controllers/awsScanController.js';

const router = express.Router();

// All routes require JWT authentication
router.use(requireAuth);

// ─── Individual Scanners ──────────────────────────────────────────────────────
router.get('/s3/public-access/:bucketName', scanS3PublicAccess);
router.get('/s3/encryption/:bucketName', scanS3Encryption);
router.get('/ec2', scanEC2);
router.get('/iam', scanIAMUsers);
router.get('/rds{/:instanceId}', scanRDS);    // instanceId is optional

// ─── Unified Scan ─────────────────────────────────────────────────────────────
router.post('/all', scanAll);

// ─── Async Queue Routes (202 + jobId) ─────────────────────────────────────────
router.post('/queue/single', enqueueSingleScan);  // POST /api/aws/scan/queue/single
router.post('/queue/all',    enqueueFullScan);    // POST /api/aws/scan/queue/all
router.get('/job/:jobId',    getJobStatus);       // GET  /api/aws/scan/job/:jobId

export default router;
