import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  addAccount,
  listAccounts,
  validateAccount,
  deleteAccount,
} from '../controllers/accountController.js';

const router = express.Router();

// All routes require JWT authentication
router.use(requireAuth);

// ─── Account CRUD + Validate ──────────────────────────────────────────────────
router.post('/',              addAccount);       // POST   /api/accounts
router.get('/',               listAccounts);     // GET    /api/accounts
router.post('/:id/validate',  validateAccount);  // POST   /api/accounts/:id/validate
router.delete('/:id',         deleteAccount);    // DELETE /api/accounts/:id

export default router;
