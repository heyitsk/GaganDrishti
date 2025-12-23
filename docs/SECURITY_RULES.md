
# GaganDrishti– Security Rules

This document defines the security rules used to detect cloud
misconfigurations that can lead to security risks.

Rules are based on real-world attack scenarios and security best practices.

# [ALERTS]

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
