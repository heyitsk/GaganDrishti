import CloudCredentials from '../models/CloudCredentials.js';
import { resolveCredentials, validateCredentials } from '../services/credentialManager.js';
import { addAccountSchema } from '../utils/validationSchemas.js';

// ─── POST /api/accounts — Add Account ────────────────────────────────────────

export const addAccount = async (req, res) => {
  // 1. Validate input
  const parsed = addAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.issues,
    });
  }

  const data = parsed.data;

  try {
    // 2. Create document (pre-save hook encrypts keys if authType === 'keys')
    const account = await CloudCredentials.create({
      userId: req.user._id,
      accountName: data.accountName,
      provider: data.provider,
      authType: data.authType,
      region: data.region,
      // Conditionally set fields based on authType
      ...(data.authType === 'role' && { roleArn: data.roleArn }),
      ...(data.authType === 'keys' && {
        accessKeyId: data.accessKeyId,
        secretAccessKey: data.secretAccessKey,
      }),
    });

    return res.status(201).json({
      message: 'Account added successfully',
      account: account.toSafeJSON(),
    });
  } catch (error) {
    console.error('Add account error:', error);
    return res.status(500).json({ error: 'Failed to add account' });
  }
};

// ─── GET /api/accounts — List Accounts ───────────────────────────────────────

export const listAccounts = async (req, res) => {
  try {
    const accounts = await CloudCredentials.find({
      userId: req.user._id,
      isActive: true,
    });

    const safeAccounts = accounts.map((acc) => acc.toSafeJSON());
    return res.status(200).json({ accounts: safeAccounts });
  } catch (error) {
    console.error('List accounts error:', error);
    return res.status(500).json({ error: 'Failed to list accounts' });
  }
};

// ─── POST /api/accounts/:id/validate — Test Credentials ─────────────────────

export const validateAccount = async (req, res) => {
  const { id } = req.params;

  let account;
  try {
    // 1. Find account (must belong to the authenticated user)
    account = await CloudCredentials.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // 2. Resolve credentials (role → AssumeRole, keys → decrypt)
    const creds = await resolveCredentials(account);

    // 3. Validate with STS:GetCallerIdentity
    const result = await validateCredentials(creds);

    account.isValidated = result.valid;
    await account.save();

    return res.status(200).json(result);
  } catch (error) {
    console.error('Validate account error:', error);
    
    if (account) {
      account.isValidated = false;
      await account.save();
    }

    return res.status(200).json({
      valid: false,
      error: error.message || 'Failed to validate account credentials',
    });
  }
};

// ─── DELETE /api/accounts/:id — Delete Account ──────────────────────────────

export const deleteAccount = async (req, res) => {
  const { id } = req.params;

  try {
    const account = await CloudCredentials.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    return res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
};
