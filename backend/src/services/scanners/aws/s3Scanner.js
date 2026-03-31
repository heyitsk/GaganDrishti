import {
  S3Client,
  GetBucketPolicyStatusCommand,
  GetPublicAccessBlockCommand,
  GetBucketAclCommand,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();

// ─── S3 Client ───────────────────────────────────────────────────────────────
// Accepts optional credentials object; falls back to .env if not provided.
function createS3Client(credentials) {
  return new S3Client({
    region: process.env.AWS_REGION || "ap-south-1",
    credentials: credentials
      ? {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          ...(credentials.sessionToken && { sessionToken: credentials.sessionToken }),
        }
      : {
          accessKeyId: process.env.ACCESS_KEY,
          secretAccessKey: process.env.SECRET_ACCESS_KEY,
        },
  });
}

// ─── Helper: Normalize S3 errors ─────────────────────────────────────────────
function parseS3Error(caught) {
  if (caught instanceof S3ServiceException) {
    return `${caught.name}: ${caught.message}`;
  }
  return String(caught);
}

// ─── Signal 1: Bucket Policy ─────────────────────────────────────────────────
// Uses GetBucketPolicyStatusCommand — AWS directly tells us if the policy
// makes the bucket public (IsPublic: true/false).
async function checkPolicyPublicStatus(client, bucketName) {
  try {
    const data = await client.send(
      new GetBucketPolicyStatusCommand({ Bucket: bucketName })
    );
    // console.log(data);
    
    const isPublic = data?.PolicyStatus?.IsPublic === true;
    return { isPublic, error: null };
  } catch (caught) {
    // "NoSuchBucketPolicy" means no policy exists → not public via policy
    if (
      caught instanceof S3ServiceException &&
      caught.name === "NoSuchBucketPolicy"
    ) {
      return { isPublic: false, error: null };
    }
    // Any other error (e.g. access denied): we can't determine → assume not public (safe default)
    return { isPublic: false, error: parseS3Error(caught) };
  }
}

// ─── Signal 2: Bucket ACL ─────────────────────────────────────────────────────
// A bucket is publicly accessible via ACL if any grant targets the special
// "AllUsers" (anonymous) or "AuthenticatedUsers" (any AWS account) groups.
const PUBLIC_ACL_GROUPS = [
  "http://acs.amazonaws.com/groups/global/AllUsers",
  "http://acs.amazonaws.com/groups/global/AuthenticatedUsers",
];

async function checkAclPublicStatus(client,bucketName) {
  try {
    const data = await client.send(
      new GetBucketAclCommand({ Bucket: bucketName })
    );
    // console.log(data.Grants);
    
    const grants = data?.Grants ?? [];
    const isPublic = grants.some((grant) =>
      PUBLIC_ACL_GROUPS.includes(grant?.Grantee?.URI)
    );
    return { isPublic, error: null };
  } catch (caught) {
    return { isPublic: false, error: parseS3Error(caught) };
  }
}

// ─── Signal 3: Public Access Block ───────────────────────────────────────────
// Returns the 4 block flags. If the config doesn't exist, all flags are false
// (meaning nothing is blocked — the bucket is open to policy/ACL access).
async function checkPublicAccessBlock(client, bucketName) {
  try {
    
    const data = await client.send(
      new GetPublicAccessBlockCommand({ Bucket: bucketName })
    );
    // console.log(data.PublicAccessBlockConfiguration);
    
    const cfg = data?.PublicAccessBlockConfiguration ?? {};
    return {
      blockPublicPolicy: cfg.BlockPublicPolicy === true,
      restrictPublicBuckets: cfg.RestrictPublicBuckets === true,
      blockPublicAcls: cfg.BlockPublicAcls === true,
      ignorePublicAcls: cfg.IgnorePublicAcls === true,
      error: null,
    };
  } catch (caught) {
    // "NoSuchPublicAccessBlockConfiguration" → no block config → nothing is blocked
    if (
      caught instanceof S3ServiceException &&
      caught.name === "NoSuchPublicAccessBlockConfiguration"
    ) {
      return {
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
        blockPublicAcls: false,
        ignorePublicAcls: false,
        error: null,
      };
    }
    // If we can't read the block config, assume no blocks are in place (worst case)
    return {
      blockPublicPolicy: false,
      restrictPublicBuckets: false,
      blockPublicAcls: false,
      ignorePublicAcls: false,
      error: parseS3Error(caught),
    };
  }
}

// ─── Main Scanner ─────────────────────────────────────────────────────────────
/**
 * Scans an S3 bucket to determine if it is publicly accessible.
 *
 * Logic:
 *   isPublic = (policyIsPublic AND policy channel not blocked)
 *              OR
 *              (aclIsPublic AND acl channel not blocked)
 *
 * PublicAccessBlock works per-channel:
 *   - Policy channel is blocked if: BlockPublicPolicy=true OR RestrictPublicBuckets=true
 *   - ACL channel is blocked if:    BlockPublicAcls=true   OR IgnorePublicAcls=true
 *
 * @param {string} bucketName - The S3 bucket name to scan
 * @returns {Promise<object>} Structured scan result
 */
export async function scanS3BucketPublicAccess(bucketName, credentials) {
  const client = createS3Client(credentials);

  // Run all 3 checks in parallel — they are independent API calls. 
  // promise.all() ke andar ek bhi function fail toh poora promise fails
  const [policyResult, aclResult, blockResult] = await Promise.all([
    checkPolicyPublicStatus(client, bucketName),
    checkAclPublicStatus(client, bucketName),
    checkPublicAccessBlock(client, bucketName),
  ]);

  // ── Apply channel-aware block logic ──────────────────────────────────────
  // Policy channel: blocked if either of the two policy-related flags is true
  const policyChannelBlocked =
    blockResult.blockPublicPolicy || blockResult.restrictPublicBuckets;

  // ACL channel: blocked if either of the two ACL-related flags is true
  const aclChannelBlocked =
    blockResult.blockPublicAcls || blockResult.ignorePublicAcls;

  // Final verdict: public only if a channel is open AND that channel grants public access
  const publicViaPolicy = policyResult.isPublic && !policyChannelBlocked;
  const publicViaAcl = aclResult.isPublic && !aclChannelBlocked;
  const isPublic = publicViaPolicy || publicViaAcl;

  // ── Build a human-readable reason ────────────────────────────────────────
  let reason;
  if (isPublic) {
    const channels = [];
    if (publicViaPolicy) channels.push("Bucket Policy");
    if (publicViaAcl) channels.push("ACL");
    reason = `Bucket is publicly accessible via: ${channels.join(", ")}.`;
  } else {
    const blockedChannels = [];
    if (policyChannelBlocked) blockedChannels.push("Policy (blocked by PublicAccessBlock)");
    if (aclChannelBlocked) blockedChannels.push("ACL (blocked by PublicAccessBlock)");
    if (!policyResult.isPublic && !aclResult.isPublic) {
      reason = "Bucket is not public — neither Policy nor ACL grants public access.";
    } else {
      reason = `Bucket is not public — public access is suppressed: ${blockedChannels.join(", ")}.`;
    }
  }

  return {
    bucketName,
    isPublic,
    reason,
    details: {
      policy: {
        isPublic: policyResult.isPublic,
        channelBlocked: policyChannelBlocked,
        error: policyResult.error,
      },
      acl: {
        isPublic: aclResult.isPublic,
        channelBlocked: aclChannelBlocked,
        error: aclResult.error,
      },
      publicAccessBlock: {
        blockPublicPolicy: blockResult.blockPublicPolicy,
        restrictPublicBuckets: blockResult.restrictPublicBuckets,
        blockPublicAcls: blockResult.blockPublicAcls,
        ignorePublicAcls: blockResult.ignorePublicAcls,
        error: blockResult.error,
      },
    },
  };
}


// scanS3BucketPublicAccess("publik-access-bucket").then((result) => {
//   console.log(JSON.stringify(result, null, 2));
// });

//raw output
// {
//   "bucketName": "publik-access-bucket",
//   "isPublic": true,
//   "reason": "Bucket is publicly accessible via: ACL.",
//   "details": {
//     "policy": {
//       "isPublic": false,
//       "channelBlocked": true,
//       "error": null
//     },
//     "acl": {
//       "isPublic": true,
//       "channelBlocked": false,
//       "error": null
//     },
//     "publicAccessBlock": {
//       "blockPublicPolicy": true,
//       "restrictPublicBuckets": true,
//       "blockPublicAcls": false,
//       "ignorePublicAcls": false,
//       "error": null
//     }
//   }