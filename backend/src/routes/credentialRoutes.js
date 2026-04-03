import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { listCredentials } from '../controllers/credentialController.js';

const router = express.Router();

// All routes require JWT authentication
router.use(requireAuth);

// ─── Credential IDs ───────────────────────────────────────────────────────────
router.get('/', listCredentials);   // GET /api/credentials

export default router;
