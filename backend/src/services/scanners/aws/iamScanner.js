import {
  IAMClient,
  ListUsersCommand,
  ListAccessKeysCommand,
  GetAccessKeyLastUsedCommand,
  GetAccountSummaryCommand,
  ListMFADevicesCommand,
  GetLoginProfileCommand,
  ListAttachedUserPoliciesCommand,
  IAMServiceException,
} from "@aws-sdk/client-iam";
import dotenv from "dotenv";
dotenv.config();

// ─── Client Factory ───────────────────────────────────────────────────────────
// Accepts optional credentials object; falls back to .env if not provided.
function createIAMClient(credentials) {
  return new IAMClient({
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


// ─── Helper: Normalize IAM errors ────────────────────────────────────────────
function parseIAMError(caught) {
  if (caught instanceof IAMServiceException) {
    return `${caught.name}: ${caught.message}`;
  }
  return String(caught);
}

// ─── Helper: Calculate age in days ───────────────────────────────────────────
function ageDays(date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Dangerous AWS-managed policies ───────────────────────────────────────────
// These give extremely broad permissions and should rarely (if ever) be attached
// directly to a user. Flag them as HIGH or CRITICAL risk.
const DANGEROUS_POLICIES = {
  "arn:aws:iam::aws:policy/AdministratorAccess": "CRITICAL",
  "arn:aws:iam::aws:policy/PowerUserAccess": "HIGH",
  "arn:aws:iam::aws:policy/IAMFullAccess": "HIGH",
  "arn:aws:iam::aws:policy/AmazonEC2FullAccess": "MEDIUM",
  "arn:aws:iam::aws:policy/AmazonS3FullAccess": "MEDIUM",
  "arn:aws:iam::aws:policy/AmazonRDSFullAccess": "MEDIUM",
};

// ─── Account-level Check: Root MFA ───────────────────────────────────────────
/**
 * Uses GetAccountSummaryCommand to read the AccountMFAEnabled value.
 * AccountMFAEnabled: 1 = MFA on, 0 = MFA off.
 *
 * Root account without MFA is the most critical IAM misconfiguration.
 *
 * @param {IAMClient} client
 * @returns {Promise<object>}
 */
async function checkRootMFA(client) {
  try {
    const response = await client.send(new GetAccountSummaryCommand({}));
    const summaryMap = response.SummaryMap ?? {};
    const isEnabled = summaryMap["AccountMFAEnabled"] === 1;

    return {
      isEnabled,
      isFlagged: !isEnabled,
      reason: isEnabled
        ? "Root account MFA is enabled — OK."
        : "Root account has NO MFA enabled — CRITICAL RISK. Enable MFA on the root account immediately.",
    };
  } catch (caught) {
    return { isEnabled: null, isFlagged: false, error: parseIAMError(caught) };
  }
}

// ─── User Check 1: Access Keys ────────────────────────────────────────────────
/**
 * Lists all access keys for a user, then for each ACTIVE key:
 *   - Checks if it is older than 90 days (should be rotated).
 *   - Calls GetAccessKeyLastUsed to check recent usage.
 *
 * Flow: ListAccessKeys → for each active key → GetAccessKeyLastUsed
 *
 * @param {IAMClient} client
 * @param {string}    userName
 * @returns {Promise<object>}
 */
async function checkAccessKeys(client, userName) {
  const KEY_ROTATION_DAYS = 90;

  try {
    const listResponse = await client.send(
      new ListAccessKeysCommand({ UserName: userName })
    );
    const allKeys = listResponse.AccessKeyMetadata ?? [];
    const activeKeys = allKeys.filter((k) => k.Status === "Active");

    // For each active key, fetch its last-used info in parallel.
    const keyDetails = await Promise.all(
      activeKeys.map(async (key) => {
        const createAge = ageDays(key.CreateDate);
        let lastUsedDate = null;
        let lastUsedService = null;
        let lastUsedAge = null;

        try {
          const lastUsedResponse = await client.send(
            new GetAccessKeyLastUsedCommand({ AccessKeyId: key.AccessKeyId })
          );
          const lastUsed = lastUsedResponse.AccessKeyLastUsed;
          if (lastUsed?.LastUsedDate) {
            lastUsedDate = new Date(lastUsed.LastUsedDate).toISOString();
            lastUsedAge = ageDays(lastUsed.LastUsedDate);
            lastUsedService = lastUsed.ServiceName ?? null;
          }
        } catch {
          // If we can't fetch last used, carry on without it.
        }

        const isStale = createAge > KEY_ROTATION_DAYS;
        const isNeverUsed = lastUsedDate === null;

        return {
          accessKeyId: key.AccessKeyId,
          createAgeDays: createAge,
          isStale,
          lastUsedDate,
          lastUsedAgeDays: lastUsedAge,
          lastUsedService,
          isNeverUsed,
        };
      })
    );

    const staleKeys = keyDetails.filter((k) => k.isStale);
    const neverUsedKeys = keyDetails.filter((k) => k.isNeverUsed);
    const isFlagged = staleKeys.length > 0 || neverUsedKeys.length > 0;

    let reason;
    if (!isFlagged) {
      reason = `${activeKeys.length} active key(s), all within rotation policy — OK.`;
    } else {
      const parts = [];
      if (staleKeys.length > 0)
        parts.push(`${staleKeys.length} key(s) older than ${KEY_ROTATION_DAYS} days`);
      if (neverUsedKeys.length > 0)
        parts.push(`${neverUsedKeys.length} key(s) never used`);
      reason = `${parts.join(" and ")} — rotate or delete them.`;
    }

    return {
      totalActive: activeKeys.length,
      keyDetails,
      staleKeys,
      neverUsedKeys,
      isFlagged,
      reason,
    };
  } catch (caught) {
    return { totalActive: 0, isFlagged: false, error: parseIAMError(caught) };
  }
}

// ─── User Check 2: MFA + Console Login Profile ────────────────────────────────
/**
 * Checks two related things together:
 *   - Does this user have a console login password? (GetLoginProfileCommand)
 *     If NoSuchEntity → no console login → programmatic-only user.
 *   - Does this user have at least one MFA device? (ListMFADevicesCommand)
 *
 * Risk: Console user with NO MFA = HIGH RISK.
 *       Programmatic-only user with NO MFA = OK (MFA doesn't apply).
 *
 * @param {IAMClient} client
 * @param {string}    userName
 * @returns {Promise<object>}
 */
async function checkMFAAndLogin(client, userName) {
  // Run both calls in parallel — they are independent.
  const [loginResult, mfaResult] = await Promise.allSettled([
    client.send(new GetLoginProfileCommand({ UserName: userName })),
    client.send(new ListMFADevicesCommand({ UserName: userName })),
  ]); //promise.allsettled works even if eotheir one fails or accepted but promise.all would throw error as soon as either one fails
  

  // GetLoginProfile throws NoSuchEntityException if no console password exists.
  const hasConsoleLogin =
    loginResult.status === "fulfilled"
      ? true
      : loginResult.reason?.name !== "NoSuchEntityException"
        ? null   // unexpected error — unknown
        : false; // expected NoSuchEntity → no console login

  const mfaDevices =
    mfaResult.status === "fulfilled"
      ? (mfaResult.value.MFADevices ?? [])
      : [];

  const hasMFA = mfaDevices.length > 0;

  // Only flag if user CAN log in to console but has no MFA.
  const isFlagged = hasConsoleLogin === true && !hasMFA;

  let reason;
  if (hasConsoleLogin === null) {
    reason = "Could not determine console login status.";
  } else if (!hasConsoleLogin) {
    reason = "No console login profile — programmatic-only user. MFA not required.";
  } else if (hasMFA) {
    reason = `Console login enabled with ${mfaDevices.length} MFA device(s) — OK.`;
  } else {
    reason = "Console login enabled but NO MFA device configured — HIGH RISK. Enable MFA immediately.";
  }

  return {
    hasConsoleLogin,
    hasMFA,
    mfaDeviceCount: mfaDevices.length,
    isFlagged,
    reason,
  };
}

// ─── User Check 3: Attached Policies ─────────────────────────────────────────
/**
 * Lists all managed policies directly attached to the user and flags any
 * known over-permissive AWS-managed policies.
 *
 * Note: Customer-managed policies are listed but not flagged — reading their
 * policy document would require additional GetPolicyVersion calls.
 *
 * @param {IAMClient} client
 * @param {string}    userName
 * @returns {Promise<object>}
 */
async function checkAttachedPolicies(client, userName) {
  try {
    const response = await client.send(
      new ListAttachedUserPoliciesCommand({ UserName: userName })
    );
    const policies = (response.AttachedPolicies ?? []).map((p) => ({
      policyName: p.PolicyName,
      policyArn: p.PolicyArn,
      riskLevel: DANGEROUS_POLICIES[p.PolicyArn] ?? null,
    }));

    const dangerousPolicies = policies.filter((p) => p.riskLevel !== null);
    const isFlagged = dangerousPolicies.length > 0;

    let reason;
    if (!isFlagged) {
      reason =
        policies.length === 0
          ? "No managed policies directly attached — OK."
          : `${policies.length} policy(s) attached, none are flagged as dangerous — OK.`;
    } else {
      const names = dangerousPolicies.map(
        (p) => `${p.policyName} (${p.riskLevel})`
      );
      reason = `Dangerous policy(s) directly attached to user: ${names.join(", ")}.`;
    }

    return { policies, dangerousPolicies, isFlagged, reason };
  } catch (caught) {
    return { policies: [], dangerousPolicies: [], isFlagged: false, error: parseIAMError(caught) };
  }
}

// ─── Per-User Scanner ─────────────────────────────────────────────────────────
/**
 * Runs all three user-level checks in parallel for a single IAM user.
 *
 * @param {IAMClient} client
 * @param {object}    user - A User object from ListUsers
 * @returns {Promise<object>}
 */
async function scanUser(client, user) {
  const [accessKeys, mfaAndLogin, attachedPolicies] = await Promise.all([
    checkAccessKeys(client, user.UserName),
    checkMFAAndLogin(client, user.UserName),
    checkAttachedPolicies(client, user.UserName),
  ]);

  const isFlagged =
    accessKeys.isFlagged ||
    mfaAndLogin.isFlagged ||
    attachedPolicies.isFlagged;

  return {
    userName: user.UserName,
    userId: user.UserId,
    createdAt: user.CreateDate
      ? new Date(user.CreateDate).toISOString()
      : null,
    isFlagged,
    checks: {
      accessKeys,
      mfaAndLogin,
      attachedPolicies,
    },
  };
}

// ─── Main Scanner ─────────────────────────────────────────────────────────────
/**
 * Scans the AWS account for IAM security issues.
 *
 * Account-level checks:
 *   • Root MFA status
 *
 * Per-user checks (for every IAM user):
 *   • Access key age (flag keys > 90 days old or never used)
 *   • Access key last-used date (via GetAccessKeyLastUsed per key)
 *   • MFA device presence combined with console login profile
 *   • Dangerous managed policies attached directly to the user
 *
 * @returns {Promise<object>} Structured security report or { error } on failure
 */
export async function scanIAM(credentials) {
  const client = createIAMClient(credentials);

  try {
    // ── Step 1: Account-level root MFA check ─────────────────────────────────
    const rootMFA = await checkRootMFA(client);

    // ── Step 2: List all IAM users (no pagination — sufficient for current scale) ──
    const usersResponse = await client.send(new ListUsersCommand({}));
    const iamUsers = usersResponse.Users ?? [];

    // ── Step 3: Run all per-user checks in parallel ───────────────────────────
    const users = await Promise.all(
      iamUsers.map((user) => scanUser(client, user))
    );

    const flaggedUsers = users.filter((u) => u.isFlagged).length;

    return {
      scannedAt: new Date().toISOString(),
      accountChecks: {
        rootMFA,
      },
      totalUsers: users.length,
      flaggedUsers,
      users,
    };
  } catch (caught) {
    return { error: parseIAMError(caught) };
  }
}

// ── Quick local test ──────────────────────────────────────────────────────────
// scanIAM().then((result) => {
//   console.log(JSON.stringify(result, null, 2));
// });
