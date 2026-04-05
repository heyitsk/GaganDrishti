# Threat Model – GaganDrishti

## System Boundaries & Security Posture
The core objective of GaganDrishti is preventative misconfiguration identification within remote AWS environments. We map our security architecture and mitigations with zero assumption of internal host compromise. 

## Trust Assumptions
1. **Read-Only Operation Mode**: GaganDrishti exclusively uses AWS read-level (`Describe*`, `Get*`, `List*`) action permissions. It fundamentally lacks computational or write-access permissions to directly modify cloud environments.
2. **Decoupled Job Lifecycle**: The underlying scan mechanisms execute outside the main API thread by leveraging isolated worker pipelines.

## Target Threat Profiles
We assess system strength against the following simulated threat actors: 
- **Automated Scanning Bots**: Scanning wide IPv4 netblocks to identify vulnerable exposed ports on edge computing devices.
- **External Intruders**: Actors exploiting exposed storage access points, stolen stale keys, or compromised root consoles to hijack network persistence.
- **Internal Malicious/Careless Parties**: Insiders creating wildcard policies or intentionally modifying systems to bypass internal controls.

## Vector Coverage (Monitored by Rules)
GaganDrishti actively restricts the lateral movement of threat actors via its scan orchestration rules engine across these vectors:
* **Object Store Exfiltration (S3)**: Assesses bucket boundary protections and ACLs to mitigate the threat of public read/write exposure.
* **Network Intercept (EC2)**: Analyzes logical topology gaps on attached default VPC/Security Group firewalls exposing management ports (SSH/RDP).
* **Identity Compromise (IAM)**: Pinpoints absent MFA protections, dormant but active developer credentials, and reckless privilege escalations that grant over-permissive wildcard execution.
* **Database Sniffing (RDS)**: Locates unrestricted internet gateway routes feeding directly to primary relational database endpoints.

## Internal Mitigation Defenses (GaganDrishti System)
* **Secret Storage**: Standardizing IAM Role ARN handovers mitigates static credential injection. When Access Key storage is strictly necessary, backend interfaces require secure ingestion and AES mechanisms.
* **API Exposure**: Real-time websocket endpoints execute strictly utilizing standard authorization handshake controls tied exclusively to the active dashboard session.
* **DDoS Vulnerability (Queue Management)**: The BullMQ orchestration pipeline handles scan delays properly—if an authenticated user forces repeated scan requests on a locked AWS architecture, Redis buffers concurrency controls rather than crashing internal worker memory.
