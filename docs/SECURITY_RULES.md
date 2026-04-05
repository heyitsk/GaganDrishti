# 🔐 Gagandrishti — Security Rules Definition

This document maps all cloud auditing detection rules natively implemented within the Gagandrishti backend scanner orchestration system (`awsScanOrchestrator.js`). 

All findings adhere to structural standards dictating rule ID, severity calculation logic (from `CRITICAL` down to `LOW`), and actionable remediation strategies.

---

## ☁️ Amazon S3 Configurations

### GGD-S3-001: Public Cloud Storage Exposure
- **Service**: S3
- **Severity**: HIGH
- **Description**: The bucket lacks robust "Block Public Access" configurations, and evaluation dictates the bucket policy or external ACLs allow public entities to read (or write) internal objects.
- **Remediation**: Review and restrict the S3 bucket policy and ACL settings. Forcefully enable "Block Public Access" at the bucket or account level.

### GGD-S3-002: Default Data Encryption Disabled
- **Service**: S3
- **Severity**: MEDIUM
- **Description**: The bucket is not enforcing server-side encryption configurations at rest. 
- **Remediation**: Enable default server-side encryption (SSE-S3 or SSE-KMS) on the bucket immediately.

---

## 🛡️ Elastic Compute Cloud (EC2)

### GGD-EC2-001: Internet-exposed Dangerous Ports
- **Service**: EC2 Security Group
- **Severity**: CRITICAL
- **Description**: Security groups inherently tied to VPCs flag open global access (`0.0.0.0/0`) targeting dangerous management ports such as `SSH (22)`, `RDP (3389)`, or completely unconstrained inbound access.
- **Remediation**: Restrict inbound rules to specific IP ranges or VPN egress networks. Never allow 0.0.0.0/0 access to sensitive TCP boundaries.

---

## 🛂 Identity & Access Management (IAM)

### GGD-IAM-001: Root Account Lacks Hardware MFA
- **Service**: IAM
- **Severity**: CRITICAL
- **Description**: The primary (Root) AWS account possesses unrestricted ownership and currently has no Multi-Factor Authentication token tied to its access paradigm.
- **Remediation**: Enable MFA on the root account immediately. Implement physical token (Hardware MFA) for maximum protection.

### GGD-IAM-002: IAM User Console Access Disabled MFA
- **Service**: IAM
- **Severity**: HIGH
- **Description**: Individual users with AWS Management Console access have not activated MFA, exposing their credential pipeline to weak-password brute manipulations.
- **Remediation**: Force MFA for this IAM user or revoke console access explicitly.

### GGD-IAM-003: Over-Permissive Managed Policies
- **Service**: IAM
- **Severity**: CRITICAL / HIGH / MEDIUM *(Dynamic)*
- **Description**: Identifies attached IAM policies exposing wildcard (`*:*`) administration-level access. Severity calculates dynamically if the bound user can trigger high-risk administrative disruptions.
- **Remediation**: Replace broad managed policies with least-privilege custom policies specifically scoped to the internal operational boundary of the IAM principal.

### GGD-IAM-004: Stale Access Credentials
- **Service**: IAM
- **Severity**: MEDIUM
- **Description**: Identifies active programmatic Access Keys belonging to a user that haven't rotated or have lain dormant outside the standardized 90-day compliance cycle.
- **Remediation**: Rotate or explicitly delete stale and unused access keys to reduce static credential exposure.

---

## 🗄️ Relational Database Service (RDS)

### GGD-RDS-001: Direct Internet Gateway Exposure
- **Service**: RDS
- **Severity**: CRITICAL
- **Description**: The instance explicitly enables `PubliclyAccessible` properties on a network tier while binding to overly-permissive ingress Security Groups.
- **Remediation**: Disable public accessibility on this RDS instance and restrict ingress strictly to internal peered Subnets or verified Private CIDRs.

### GGD-RDS-002: Unencrypted Storage Volumes
- **Service**: RDS
- **Severity**: HIGH
- **Description**: Backend storage subsystems tied to the Database instance lack cryptographic keys (KMS) assigned for encryption at rest.
- **Remediation**: Enable storage encryption. *(Note: AWS forbids toggling encryption directly on existing active instances. Encrypt a manual snapshot replica and initialize a restored cluster).*

---

## 🧠 Risk Level Baseline Definitions

| Severity Level | Structural Definition |
|---|---|
| **CRITICAL** | Directly exploitable entry mechanisms resulting in immediate full-system or data compromise. Direct internet boundary violations and Root administration failures. |
| **HIGH** | Significant misconfiguration directly facilitating downstream lateral access jumps or high-yield data exposure. |
| **MEDIUM** | Compliance boundary failures or architectural gaps that, while not directly exploitable, degrade defensive layering or assist post-exploitation chains. |
| **LOW** | *(System defined but unused strictly here)* Best-practice violation generating excessive configuration sprawl or metadata leaks. |
