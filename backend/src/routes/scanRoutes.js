import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getScans,
  getScanDetails,
  getScanFindings,
  getFindings,
  getDashboardStats,
} from '../controllers/scanController.js';

const router = express.Router();

// All routes require JWT authentication
router.use(requireAuth);

// ─── Scan History ─────────────────────────────────────────────────────────────
router.get('/scans', getScans);
router.get('/scans/:id', getScanDetails);
router.get('/scans/:id/findings', getScanFindings);

// ─── Findings ─────────────────────────────────────────────────────────────────
router.get('/findings', getFindings);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard/stats', getDashboardStats);

export default router;
