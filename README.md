# 🌐 GAGANDRISHTI

*GaganDrishti* represents deep visibility into cloud configurations to identify security risks before they become breaches.

A modernized, preventive cloud security platform engineered to detect, prioritize, and remediate dangerous misconfigurations across your AWS infrastructure.

---

## 🚀 Key Features
- **BullMQ-Powered Orchestration**: Reliable, asynchronous scanning capabilities distributed efficiently to prevent AWS rate-limiting.
- **Real-Time Job Tracking**: Instantaneous feedback across the frontend via WebSocket (`Socket.io`) tracking queues, active processes, and failure states natively.
- **Comprehensive Scanners**: Granular analysis identifying public S3 buckets, exposed EC2 Internet ports, insecure IAM policies, missing MFA, and unencrypted RDS instances.
- **Actionable Triage Dashboard**: Instantly sorts discovered misconfigurations from `CRITICAL` down to `LOW` risk and embeds straightforward command-line/console remediation steps.

## 🛠️ Technology Stack
- **Frontend Layer**: React + Vite + Tailwind CSS
- **API Engine**: Node.js + Express
- **Task Orchestrator**: BullMQ + Redis
- **Database Vault**: MongoDB (Mongoose)  
- **Event Mesh**: WebSockets (Socket.io)

---

## 📚 Detailed Documentation
Please explore the `/docs` directory for granular system details:
- **[System Architecture](docs/ARCHITECTURE.md)**: Technical dependencies, diagrams, and logic scopes.
- **[User Workflow](docs/WORKFLOW.md)**: How to attach AWS vaults and operate the CyberGuard Orchestrator UI.
- **[Security Rules Library](docs/SECURITY_RULES.md)**: Every executed rule (S3, EC2, IAM, RDS) natively identified, ranked, and resolved.
- **[Threat Model](docs/THREAT_MODEL.md)**: The systemic vectors actively mitigated by the application infrastructure.

---

## 🚦 Getting Started

### Quick Start (Recommended: Docker Compose)
GaganDrishti is fully containerized. You can spin up the entire stack (Frontend, Backend, and Redis orchestration) with a single command. 

Ensure you have [Docker](https://www.docker.com/) installed, then run from the root directory:

```bash
docker compose up -d --build
```
- **Frontend Dashboard:** `http://localhost:3000`
- **Backend API:** `http://localhost:5000`
*(Note: Ensure you have populated `backend/.env` with your desired configuration, AWS keys, and MongoDB URI before building).*

---

### Manual Local Development Start

If you prefer running processes manually outside of Docker:

1. **Start Infrastructure Services (Redis)**
   Ensure you have a Redis instance locally running (used by BullMQ) and a valid MongoDB URI. 

2. **Initialize Backend API**
   ```bash
   cd backend
   npm install
   # Set your .env parameters (MONGODB_URI, PORT, etc.)
   npm run dev
   ```

3. **Initialize Frontend Dashboard**
   ```bash
   cd frontend
   npm install
   # set VITE_API_URL in .env if not default
   npm run dev
   ```

## 🤝 The Problem & Solution
A large percentage of cloud security breaches originate from simple infrastructure misconfigurations—like globally exposed `0.0.0.0/0` SSH ports or `AllUsers` bucket ACLs. Gagandrishti bridges the gap between infrastructure deployment and zero-trust validation by continuously auditing read-only AWS blueprints and actively surfacing remediation tactics without risking internal system modification.
