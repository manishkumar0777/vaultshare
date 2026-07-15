# 🔒 VaultShare — Zero-Knowledge End-to-End Encrypted File Sharing

VaultShare is a secure, zero-knowledge, full-stack file-sharing platform designed for temporary and secure transmission of files. By encrypting files client-side in the browser before upload, the server acts solely as an encrypted coordinator and **never** has access to the plaintext file or the decryption key.

Developed and maintained by [manishkumar777](https://github.com/manishkumar0777).

---

## 📋 Table of Contents
1. [Core Features](#-core-features)
2. [Security Architecture & Data Flows](#-security-architecture--data-flows)
3. [Cryptographic Design](#-cryptographic-design)
4. [Redis & Cache Infrastructure](#-redis--cache-infrastructure)
5. [Rate Limiting Design](#-rate-limiting-design)
6. [Resilience & Fallback Architecture](#-resilience--fallback-architecture)
7. [Installation & Setup](#-installation--setup)
8. [E2E Testing & Verification](#-e2e-testing--verification)

---

## 🚀 Core Features

* **End-to-End Client-Side Encryption:** Symmetric `AES-GCM 256-bit` encryption occurs directly in the user's browser via the Web Crypto API before the file is uploaded.
* **Zero-Knowledge Key Exchange:** The encryption key remains in the URL fragment identifier (`#key=...`). The fragment is processed locally by the client browser and is **never** sent to the backend server in HTTP request headers.
* **Self-Destructing & Expiring Links:** File life spans are configured on upload and enforced by high-speed Redis TTL eviction keys.
* **Configurable Download Limits:** Uploaders can configure limits (e.g. burn-after-reading or a multiple-download cap). Download tracking is updated atomically via Redis to prevent race conditions.
* **IP-Based Rate Limiting:** Outgoing and incoming endpoints are protected by fixed-window rate-limiting algorithms with RFC-compliant tracking headers.
* **Fail-Soft Portability:** Built-in automatic mock database (MongoDB) and cache (Redis) fallbacks allow the application to compile and run offline without active database connections.

---

## ⚙️ Security Architecture & Data Flows

### 1. File Upload (Client-Side Encryption)
```mermaid
sequenceDiagram
    actor Client as User Browser
    participant Server as Next.js API
    database DB as MongoDB
    database Cache as Redis

    Client->>Client: Generate 256-bit AES-GCM Key
    Client->>Client: Encrypt File & Metadata (Name, MIME Type)
    Client->>Server: POST /api/files (Encrypted Blob, IV, Encrypted Metadata)
    Note over Client,Server: Key remains in browser; NEVER sent to server!
    Server->>DB: Store Encrypted Blob + Metadata + Expiry Date
    Server->>Cache: SET file:expires (TTL Key) & file:limit
    Server-->>Client: Response (fileId, shareUrl without key)
    Client->>Client: Append `#key=BASE64_KEY` to Share URL
```

### 2. File Download (Client-Side Decryption)
```mermaid
sequenceDiagram
    actor Client as Recipient Browser
    participant Server as Next.js API
    database Cache as Redis
    database DB as MongoDB

    Client->>Server: GET /api/files/[id]/meta (Checks status)
    Server->>Cache: Check TTL & Download count limits
    Server-->>Client: Returns Encrypted Metadata (Name & MIME Type)
    Client->>Client: Extract key from window.location.hash
    Client->>Client: Decrypt filename in UI
    Client->>Server: GET /api/files/[id] (Request payload)
    Server->>Cache: Increment downloads (INCR) & Check Limits
    alt Expiry/Limit Reached
        Server->>DB: Delete file record
        Server->>Cache: Clean up Redis keys
        Server-->>Client: HTTP 410 (Gone)
    else Under Limits
        Server-->>Client: Return Encrypted Blob + IV in Header
    end
    Client->>Client: Decrypt Blob locally using AES-GCM Key
    Client->>Client: Trigger file download in browser
```

---

## 🔒 Cryptographic Design

VaultShare uses the browser's native **Web Crypto API** (`window.crypto.subtle`) for high-performance, secure encryption:
* **Algorithm:** `AES-GCM` (Galois/Counter Mode) with 256-bit keys.
* **Integrity Validation:** AES-GCM is an **AEAD** mode (Authenticated Encryption with Associated Data). It guarantees both confidentiality and integrity by creating a secure authentication tag. If the encrypted blob is altered on the server by even a single bit, client-side decryption immediately throws an error, protecting users against malicious modifications.
* **Initialization Vector (IV):** A unique, random 12-byte (96-bit) IV is generated for every session using `crypto.getRandomValues()` to guarantee semantic security.
* **Metadata Obfuscation:** The original filename and MIME type are also encrypted on the client side, keeping file extensions and titles completely private from server administrators.

---

## 🧠 Redis & Cache Infrastructure

Redis handles link lifespans and concurrent download tracking due to its high-speed in-memory lookups:
1. **Link Expirations:** The server establishes a key in Redis (`file:{fileId}:expires`) with a custom Time-To-Live (TTL). When the TTL reaches 0, Redis automatically deletes the key. The API checks for this key's presence on download requests; if missing, it initiates database clean-ups and returns a `410 Gone`.
2. **Atomic Download Tracking:** To prevent concurrent downloads from bypassing the download limits (race conditions), download counts are tracked using Redis `INCR`:
   ```bash
   INCR file:{fileId}:downloads
   ```
   Redis executes commands in a single-threaded queue, ensuring that concurrent requests are processed sequentially. If the count reaches the limit, VaultShare immediately drops the database entry and cleans up Redis.

---

## 🛡️ Rate Limiting Design

API abuse and scanning attacks are managed using an IP-based fixed-window algorithm implemented through Redis:
* **Limits:** Uploads are restricted to 10 requests/minute per IP, and downloads are restricted to 30 requests/minute per IP.
* **Execution:** Done atomically via `multi()` transactions:
  ```typescript
  const multi = client.multi();
  multi.incr(rateLimitKey);
  if (isFirstRequestOfWindow) {
    multi.expire(rateLimitKey, 60);
  }
  await multi.exec();
  ```
* **RFC Compliance:** Injects tracking headers into every response:
  * `X-RateLimit-Limit`: Maximum requests per window.
  * `X-RateLimit-Remaining`: Requests left in the current window.
  * `X-RateLimit-Reset`: UNIX epoch timestamp when the rate limit window resets.

---

## ⚡ Resilience & Fallback Architecture

To support local testing, CI pipelines, and standalone deployment configurations, VaultShare has a dual mock fallback system:
* **Database Mocking:** If MongoDB connection strings are absent, the application routes operations to an in-memory `Map` that emulates Mongoose schema actions (`save`, `findOne`, `deleteOne`, `find`).
* **Cache Mocking:** If Redis connections time out, operations fallback to a local mock client mimicking caching actions (`get`, `set`, `incr`, `expire`, `multi`) using timers.

---

## 💻 Installation & Setup

### Prerequisites
* **Node.js:** v18.x or later
* **MongoDB & Redis:** Optional (local fallbacks are automatically utilized if offline)

### Setup Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/manishkumar0777/vaultshare.git
   cd vaultshare
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the environment variables:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` to configure your MongoDB connection string and Redis URL if running in production.*

4. Run the development server:
   ```bash
   npm run dev
   ```
   *Access the web app at [http://localhost:3000](http://localhost:3000).*

---

## 🧪 E2E Testing & Verification

VaultShare provides an integration test script validating the complete encryption and exchange flow:
```bash
npx ts-node -r tsconfig-paths/register src/scripts/test-end-to-end.ts
```
**Test Stages Run:**
1. Generates local cryptographic keys.
2. Encrypts a sample payload and its metadata locally.
3. Uploads the ciphertext block to the API.
4. Checks metadata parsing and Redis TTL parameters.
5. Downloads the file and retrieves IV values from the headers.
6. Decrypts the content locally in client space and validates identity.
