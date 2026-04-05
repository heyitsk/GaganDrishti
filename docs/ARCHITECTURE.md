# GaganDrishti – System Architecture

GaganDrishti leverages a modern, decoupled architecture to reliably inspect AWS infrastructure, discover vulnerabilities, and stream real-time insights securely to administrators.

## High-Level Diagram

```mermaid
graph TD
    UI[Frontend (React / Vite)]
    API[API Hub (Node.js / Express)]
    Mongo[(Metadata & Findings DB<br/>MongoDB)]
    Queue[(Task Broker<br/>Redis / BullMQ)]
    Worker[Scan Engine Worker]
    AWS([AWS Cloud Infrastructure])

    UI -- "REST + WSS (Socket.io)" --> API
    API -- "Jobs" --> Queue
    API -- "CRUD Settings" --> Mongo
    Worker -- "Pulls Jobs" --> Queue
    Worker -- "AWS SDK (STS/Read-only)" --> AWS
    Worker -- "Saves Scan Results" --> Mongo
    Worker -- "WSS Job state" --> API
```

## Core Components

### 1. Frontend Interface (The Dashboard)
Built with **React**, **Vite**, and styled with **Tailwind CSS**. It provides:
- Credential management & registration.
- The **CyberGuard Orchestrator** UI for dispatching targeted and full-environment scan payloads.
- Real-time queued job monitoring hooked directly into WebSockets (`Socket.io`).

### 2. API Aggregation Layer (Backend)
Powered by **Node.js** and **Express**, the REST controllers handle:
- Authenticating users and vaulting AWS credentials (securely handling Access Keys and Role ARNs).
- Validating scan requests and injecting jobs into the processing queue.
- Orchestrating WebSocket event emissions when jobs undergo state transitions.

### 3. Task Orchestration Workflow
The core asynchronous processing is powered by **BullMQ** wrapping a **Redis** instance:
- **Resiliency**: The queue mitigates heavy or slow AWS API bottlenecks, retries on transient errors, and limits concurrency gracefully.
- **Worker Processes**: Background workers (`scanWorker.js`) independently pop scanning jobs, run internal transformer logic on raw AWS data, and compute accurate risk metrics and severities.
- Separation of scan coordination ensures that heavy external API limits don’t exhaust the main Node thread.

### 4. Data Persistence Strategy
**MongoDB** (via Mongoose) manages persistence:
- `User` and `CloudCredentials` hold the platform state.
- `Scan` tracks metadata regarding full executions or targeted runs (counts, timestamps). 
- `Finding` contains individual misconfigurations, logically mapped to specific scans and specific AWS components.

## Security & Execution Model 
- **Read-Only**: The backend scanners (leveraging the official AWS SDK-v3) exclusively invoke `-Describe-` and `-Get-` class functions. 
- **Decoupled Architecture**: Secrets/Authentication isolation and distinct background scanner modules limit blast perimeters upon failure. 
