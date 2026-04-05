# Gagandrishti User Execution Workflow

Gagandrishti provides a streamlined pipeline for security staff to authenticate, attach decoupled AWS identities, orchestrate concurrent security queues, and seamlessly triage resultant vulnerabilities.

## Phase 1: Authentication & Connection Identity
1. **User Authentication**: Administrators register and authenticate via the core portal. 
2. **Identity Vaulting**: Users attach their remote AWS clusters by assigning AWS Account Names alongside programmatic Access Keys or internal IAM STS Role ARNs. These credentials are encrypted and stored inside the protected MongoDB vault, exposing only the vault IDs back to the frontend.

## Phase 2: The CyberGuard Orchestrator
To execute vulnerability discovery operations:
1. Administrators navigate to the active **CyberGuard Orchestrator** dashboard.
2. Select the designated AWS Environment profile to scan.
3. The platform provides two distinct scanning modes:
   - **Full Environment Scan**: Queues an overarching payload dispatching all individual component scanners (S3, EC2, IAM, RDS) asynchronously.
   - **Targeted Scan**: Isolates single resources to restrict system noise. Users can pass explicit infrastructure overrides (e.g., locking search parameters against a single isolated RDS instance ID or isolated S3 Bucket).
4. **Queue Dispatch**: Selecting "Push to Scan Queue" instantly bundles the constraints and invokes REST POSTs against the API queue layer.

## Phase 3: Real-Time BullMQ WebSocket Tracking
Upon entering the processing queue:
- **Asynchronous Hand-off**: BullMQ natively takes control over task scaling, delaying processes efficiently on back-off sequences if external AWS APIs rate-limit requests. 
- **Active State Monitoring**: Instead of polling endpoints manually, the Node.js API bridges directly into Socket.io.
- The UI maintains an **Active Job Queue** panel emitting visual indicators reflecting job pipelines mapping identically from `Queued` ➡️ `Active` ➡️ `Completed`.

## Phase 4: Triaging & Resolution
1. Once a subset job or full-environment aggregation finishes (triggering the green `Completed` Socket notification banner), administrators review severity counts embedded directly within the UI tracker cards.
2. An embedded rapid-navigate link forwards administrators directly to the unified **Findings Report Dashboard**. 
3. The Findings Report lists exactly triggered violations ranked by critical constraints, tying detailed remediation strategies dynamically attached by the `awsScanOrchestrator` findings transformer engine.
