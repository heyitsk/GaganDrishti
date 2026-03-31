import {
  S3Client,
  GetBucketEncryptionCommand,
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

/**
 * Scans an S3 bucket's server-side encryption (SSE) configuration.
 *
 * Possible encryption types AWS supports:
 *   - AES256  : AWS S3-managed keys (SSE-S3)
 *   - aws:kms : AWS KMS-managed keys (SSE-KMS)
 *   - aws:kms:dsse : Dual-layer SSE with KMS (DSSE-KMS)
 *   - null    : No default encryption configured
 *
 * @param {string} bucketName - The S3 bucket name to scan
 * @returns {Promise<object>} Structured encryption scan result
 */
export async function scanS3BucketEncryption(bucketName, credentials) {
  const client = createS3Client(credentials);

  try {
    const data = await client.send(
      new GetBucketEncryptionCommand({ Bucket: bucketName })
    );

    const rules =
      data?.ServerSideEncryptionConfiguration?.Rules ?? [];

    // Extract encryption details from each rule
    const encryptionRules = rules.map((rule) => {
      const apply = rule?.ApplyServerSideEncryptionByDefault ?? {};
      return {
        sseAlgorithm: apply.SSEAlgorithm ?? null,
        kmsMasterKeyId: apply.KMSMasterKeyID ?? null,
        bucketKeyEnabled: rule?.BucketKeyEnabled ?? false,
      };
    });

    const isEncrypted = encryptionRules.length > 0;
    const primaryAlgorithm = encryptionRules[0]?.sseAlgorithm ?? null;

    let reason;
    if (!isEncrypted) {
      reason =
        "No default encryption is configured. Objects may be stored unencrypted unless the uploader specifies encryption.";
    } else if (primaryAlgorithm === "aws:kms" || primaryAlgorithm === "aws:kms:dsse") {
      reason = `Bucket is encrypted using AWS KMS (${primaryAlgorithm}). Keys are managed via KMS.`;
    } else if (primaryAlgorithm === "AES256") {
      reason = "Bucket is encrypted using SSE-S3 (AES-256). Keys are managed by AWS S3.";
    } else {
      reason = `Bucket is encrypted with algorithm: ${primaryAlgorithm}.`;
    }

    return {
      bucketName,
      isEncrypted,
      primaryAlgorithm,
      reason,
      rules: encryptionRules,
      error: null,
    };
  } catch (caught) {
    if (
      caught instanceof S3ServiceException &&
      caught.name === "ServerSideEncryptionConfigurationNotFoundError"
    ) {
      // No encryption configured — valid state, not an error
      return {
        bucketName,
        isEncrypted: false,
        primaryAlgorithm: null,
        reason:
          "No default encryption is configured. Objects may be stored unencrypted unless the uploader specifies encryption.",
        rules: [],
        error: null,
      };
    }

    if (caught instanceof S3ServiceException && caught.name === "NoSuchBucket") {
      return {
        bucketName,
        isEncrypted: false,
        primaryAlgorithm: null,
        reason: `Bucket "${bucketName}" does not exist.`,
        rules: [],
        error: `NoSuchBucket: ${caught.message}`,
      };
    }

    return {
      bucketName,
      isEncrypted: false,
      primaryAlgorithm: null,
      reason: "Could not determine encryption status due to an error.",
      rules: [],
      error: `${caught.name ?? "Error"}: ${caught.message ?? String(caught)}`,
    };
  }
}


// scanS3BucketEncryption("publik-access-bucket").then((result) => {
  // console.log(JSON.stringify(result, null, 2));
// });


//raw output 
// {
//   "bucketName": "publik-access-bucket",
//   "isEncrypted": true,
//   "primaryAlgorithm": "AES256",
//   "reason": "Bucket is encrypted using SSE-S3 (AES-256). Keys are managed by AWS S3.",
//   "rules": [
//     {
//       "sseAlgorithm": "AES256",
//       "kmsMasterKeyId": null,
//       "bucketKeyEnabled": false
//     }
//   ],
//   "error": null
// }