import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getScans,
  getScanDetails,
  getScanFindings,
  getFindings,
  getDashboardStats,
  getTimeline,
  resolveFinding,
  ignoreFinding,
} from '../controllers/scanController.js';

const router = express.Router();

// All routes require JWT authentication
router.use(requireAuth);

// ─── Scan History ─────────────────────────────────────────────────────────────
router.get('/scans', getScans);
router.get('/scans/:id', getScanDetails);
router.get('/scans/:id/findings', getScanFindings);

// ─── Findings ─────────────────────────────────────────────────────────────────
// NOTE: /findings/timeline must come before any /findings/:id route
router.get('/findings/timeline', getTimeline);
router.get('/findings', getFindings);
router.patch('/findings/:id/resolve', resolveFinding);
router.patch('/findings/:id/ignore', ignoreFinding);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard/stats', getDashboardStats);

export default router;
