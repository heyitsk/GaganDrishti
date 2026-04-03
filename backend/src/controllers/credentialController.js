import CloudCredentials from '../models/CloudCredentials.js';

// ─── GET /api/credentials — List Credential IDs ───────────────────────────────
// Returns only _id for each active credential belonging to the logged-in user.
// Used by the frontend to populate the scan dropdown and pipe credentialId
// into scan request bodies — no sensitive data is exposed.

export const listCredentials = async (req, res) => {
  try {
    const credentials = await CloudCredentials.find(
      { userId: req.user._id, isActive: true },          // filter: all active creds for this user
      { _id: 1, accountName: 1, provider: 1 }            // projection: return only these fields
    ).lean();      // plain JS objects, no Mongoose overhead
    
    return res.status(200).json({ credentials });
  } catch (error) {
    console.error('List credentials error:', error);
    return res.status(500).json({ error: 'Failed to list credentials' });
  }
};
