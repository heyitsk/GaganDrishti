import {
  STSClient,
  AssumeRoleCommand,
  GetCallerIdentityCommand,
} from '@aws-sdk/client-sts';

// ─── Base STS client (uses your .env creds — the "base identity") ────────────

function createSTSClient() {
  return new STSClient({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.ACCESS_KEY,
      secretAccessKey: process.env.SECRET_ACCESS_KEY,
    },
  });
}

// ─── AssumeRole ──────────────────────────────────────────────────────────────

/**
 * Calls STS:AssumeRole to obtain temporary credentials for a given Role ARN.
 *
 * @param {string} roleArn - The ARN of the role to assume.
 * @returns {Promise<{ accessKeyId: string, secretAccessKey: string, sessionToken: string }>}
 */
export async function assumeRole(roleArn) {
  const client = createSTSClient();

  const command = new AssumeRoleCommand({
    RoleArn: roleArn,
    RoleSessionName: `GaganDrishti-${Date.now()}`,
    DurationSeconds: 3600, // 1 hour
  });

  const response = await client.send(command);
  const creds = response.Credentials;

  return {
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken,
  };
}

// ─── Resolve Credentials ────────────────────────────────────────────────────

/**
 * Resolves usable AWS credentials from a CloudCredentials document.
 *
 * - role  → calls AssumeRole, returns temporary credentials
 * - keys  → decrypts from DB, returns permanent credentials
 *
 * @param {import('mongoose').Document} account - A CloudCredentials document.
 * @returns {Promise<{ accessKeyId: string, secretAccessKey: string, sessionToken?: string }>}
 */
export async function resolveCredentials(account) {
  if (account.authType === 'role') {
    return await assumeRole(account.roleArn);
  }

  // Keys mode — decrypt from DB
  return {
    accessKeyId: account.getDecryptedAccessKeyId(),
    secretAccessKey: account.getDecryptedSecretAccessKey(),
  };
}

// ─── Validate Credentials ────────────────────────────────────────────────────

/**
 * Verifies that a set of AWS credentials are valid by calling
 * STS:GetCallerIdentity (requires zero permissions).
 *
 * @param {{ accessKeyId: string, secretAccessKey: string, sessionToken?: string }} creds
 * @returns {Promise<{ valid: boolean, awsAccountId?: string, arn?: string, error?: string }>}
 */
export async function validateCredentials(creds) {
  try {
    const client = new STSClient({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        ...(creds.sessionToken && { sessionToken: creds.sessionToken }),
      },
    });

    const response = await client.send(new GetCallerIdentityCommand({}));

    return {
      valid: true,
      awsAccountId: response.Account,
      arn: response.Arn,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message || String(error),
    };
  }
}
