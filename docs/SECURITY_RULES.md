# 🔐 Gagandrishti — Security Rules Definition

This document defines the security detection rules used by **Gagandrishti** to
identify cloud misconfigurations that can lead to real-world cyber attacks.

The rules are designed with a focus on **preventive security**, **clarity**,
and **actionable remediation**, aligned with common cloud breach patterns.

Rules are based on real-world attack scenarios and security best practices.

# ALERTS

Rule 1: Public Cloud Storage

- Detect publicly accessible storage
- Risk: HIGH
- Impact: Data leakage
- Fix: Disable public access

Rule 2: Open Management Ports

- Detect SSH/RDP open to 0.0.0.0/0
- Risk: HIGH
- Impact: Unauthorized access
- Fix: Restrict IPs / VPN

Rule 3: Over-Permissive IAM

-Detect admin or wildcard permissions
-Risk: MEDIUM/HIGH
-Impact: Privilege escalation
-Fix: Least privilege


--------------------------------------------------------------------------------------------------------------------------------------------

## 📌 Rule Structure

Each security rule follows the structure below:

- Rule ID
- Rule Name
- Category
- Description
- Detection Logic
- Risk Level
- Security Impact
- Remediation

---

## 🔴 RULE 001 – Public Cloud Storage Exposure

**Rule ID:** GGD-CS-001  
**Rule Name:** Public Cloud Storage Exposure  
**Category:** Data Exposure / Misconfiguration  

### Description
Detects cloud storage resources that are publicly accessible, allowing
unauthorized users to read or write sensitive data.

### Detection Logic
- Check if cloud storage resources (e.g., object storage buckets) allow public access  
- Identify public ACLs or access policies granting permissions to `AllUsers` or `Everyone`

### Risk Level
**HIGH**

### Security Impact
Publicly exposed storage can result in:
- Sensitive data leakage  
- Regulatory and compliance violations  
- Unauthorized data modification or deletion  

### Remediation
- Disable public access  
- Apply least-privilege access policies  
- Enable encryption and access logging  

---

## 🔴 RULE 002 – Open Management Ports to Internet

**Rule ID:** GGD-CS-002  
**Rule Name:** Open Management Ports to Internet  
**Category:** Network Exposure / Misconfiguration  

### Description
Identifies cloud network configurations where critical management ports are
exposed directly to the public internet.

### Detection Logic
- Inspect firewall or security group rules  
- Identify inbound rules allowing `0.0.0.0/0` on:
  - Port 22 (SSH)
  - Port 3389 (RDP)

### Risk Level
**HIGH**

### Security Impact
Open management ports enable:
- Brute-force login attacks  
- Unauthorized remote system access  
- Full system compromise  

### Remediation
- Restrict access to trusted IP ranges  
- Use bastion hosts or VPN access  
- Disable unused management ports  

---

## 🟡 RULE 003 – Over-Permissive IAM Roles

**Rule ID:** GGD-CS-003  
**Rule Name:** Over-Permissive IAM Permissions  
**Category:** Identity & Access Management  

### Description
Detects IAM users or roles that have excessive permissions beyond their
operational requirements.

### Detection Logic
- Identify IAM policies containing wildcard permissions (`*:*`)  
- Detect attachment of administrator-level roles to users or services  

### Risk Level
**MEDIUM / HIGH** (based on usage context)

### Security Impact
Over-permissive access can lead to:
- Privilege escalation  
- Amplified impact of account compromise  
- Unauthorized resource creation, deletion, or modification  

### Remediation
- Apply the principle of least privilege  
- Remove unused or excessive permissions  
- Perform periodic IAM access reviews  

---

## 🔵 RULE 004 – Missing Encryption on Cloud Resources  
*(Optional – Future Scope)*

**Rule ID:** GGD-CS-004  
**Rule Name:** Encryption Disabled  
**Category:** Data Protection  

### Description
Detects cloud resources where encryption at rest is not enabled.

### Detection Logic
- Check encryption settings on storage services and databases  

### Risk Level
**MEDIUM**

### Security Impact
Unencrypted data can be:
- Exposed during unauthorized access  
- Non-compliant with security and regulatory standards  

### Remediation
- Enable encryption at rest  
- Use managed key management services  

---

## 🧠 Severity Classification Logic

| Severity | Meaning |
|--------|--------|
| HIGH | Directly exploitable from the internet |
| MEDIUM | Exploitable after initial access |
| LOW | Best-practice violation (not included in MVP) |

---

## 🎯 Design Philosophy

Gagandrishti focuses on:
- Preventive security  
- Explainable findings  
- Actionable remediation  
- Minimal alert noise  

The system operates with **read-only access** and **never modifies cloud
resources**.

---

## 👤 Ownership

This document is maintained by the **Security Team Lead**.  
All backend detection logic and UI representation **must strictly follow**
these defined rules.
