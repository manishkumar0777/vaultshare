# 🔒 VaultShare — End-to-End Encrypted File Sharing Service

VaultShare is a secure, zero-knowledge file-sharing web application. Files are encrypted client-side in the browser using the Web Crypto API (AES-GCM 256-bit) before being uploaded to the server. The decryption key stays inside the URL hash fragment and is **never** transmitted to the server. Access controls—including expirations and download limits—are enforced dynamically via Redis, with an automated fallback system.

---

## 📋 Table of Contents
1. [Tech Stack & Resume Alignment](#-tech-stack--resume-alignment)
2. [Key Architecture & Data Flows](#%EF%B8%8F-key-architecture--data-flows)
3. [Deep-Dive Cryptography (Web Crypto API)](#-deep-dive-cryptography-web-crypto-api)
4. [Redis Mechanics & Enforcements](#-redis-mechanics--enforcements)
5. [Rate Limiting Design](#-rate-limiting-design)
6. [Resilience & Fallback Architecture](#-resilience--fallback-architecture)
7. [Challenges Resolved (Real-world Engineering)](#-challenges-resolved-real-world-engineering)
8. [Testing & Verification](#-testing--verification)
9. [Interview Q&A Cheatsheet](#-interview-qa-cheatsheet)

---

## ⚡ Tech Stack & Resume Alignment

Your resume outlines the following stack:
> **Tech Stack:** JavaScript, Node.js, Express.js, MongoDB, Redis, Web Crypto API

Here is how the actual implementation maps to it, along with adjustments you should be prepared to explain:
* **TypeScript & Next.js vs. Express.js:** The project is written in **TypeScript** and built using **Next.js (App Router)** rather than a standalone Express.js server. Next.js handles both the React frontend and the backend API Routes (Serverless Route Handlers). 
  * *Interviewer Tip:* If asked why Next.js instead of Express, explain: *"Using Next.js Route Handlers provides server-side capability equivalent to Express.js (Node.js Request/Response cycle) but allows a unified build system, better server/client boundary configuration, serverless readiness, and simplified full-stack deployment."*
* **Web Crypto API:** Natively implemented in the client browser, securing keys entirely on the user's device.
* **MongoDB & Redis:** Fully integrated with custom in-memory mock fallbacks so the app can run and pass E2E tests even if external database services are temporarily offline.

---

## 🛠️ Key Architecture & Data Flows

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

## 🔒 Deep-Dive Cryptography (Web Crypto API)

The system leverages the browser's built-in **Web Crypto API** (`window.crypto.subtle`) for high-performance, secure encryption operations:
* **Algorithm:** `AES-GCM` (Advanced Encryption Standard - Galois/Counter Mode).
* **Key Strength:** `256-bit` symmetric key, offering military-grade encryption.
* **Why AES-GCM?** AES-GCM is an **AEAD** (Authenticated Encryption with Associated Data) algorithm. Unlike older modes like AES-CBC, AES-GCM provides both **confidentiality** and **integrity validation**. If a malicious server modifies even a single bit of the encrypted blob, the browser's decryption function will reject it as tampered.
* **IV (Initialization Vector):** 12 bytes (96 bits) of cryptographically secure random values are generated for every file using `crypto.getRandomValues()`. GCM requires a 12-byte IV to ensure that encrypting the same file multiple times with the same key produces entirely different ciphertexts, preventing pattern analysis.
* **Metadata Protection:** Filenames and MIME types are also encrypted client-side, preventing the server administrator from knowing what kind of file (e.g. PDF, Image, Executable) was shared.

---

## 🧠 Redis Mechanics & Enforcements

Redis is critical to this architecture due to its speed, atomic execution, and built-in expiration capabilities.

### 1. Expiration (TTL Keys)
When a share link is created with a specific lifespan (e.g. 24 hours), the server calculates the remaining seconds and sets an expiration key:
```bash
SET file:{fileId}:expires "1" EX {seconds_remaining}
```
* **Enforcement:** When a download is requested, the server performs a quick check using `EXISTS file:{fileId}:expires`. If Redis returns `0` (the key expired and was automatically evicted by Redis), the backend immediately deletes the file from MongoDB, sweeps all metadata, and returns a `410 Gone`.

### 2. Download Limits (Atomic Tracking)
Configurable download limits are stored in Redis (`file:{fileId}:limit`). The number of downloads used is incremented on every access:
```bash
INCR file:{fileId}:downloads
```
* **Why Redis?** If download limit tracking was done solely in MongoDB or using standard Node.js variables:
  * Database read-modify-write cycles are susceptible to **race conditions** (multiple users downloading concurrently could exceed the download limit before the DB updates).
  * Redis `INCR` is a **single, atomic operation** executed in a single-threaded server environment, guaranteeing absolute accuracy under high concurrent traffic.
* **Self-Destruction (Burn-After-Reading):** If `downloadsUsed >= downloadLimit`, the API immediately triggers a cascade deletion—erasing the encrypted record from MongoDB and calling `cleanupFileKeys` to delete all keys from Redis.

---

## 🛡️ Rate Limiting Design

To protect the server from Denial of Service (DoS) and brute-force file scanning, rate limits are applied:
* **Upload Limits:** Max 10 uploads per IP per minute.
* **Download Limits:** Max 30 downloads per IP per minute.

### The Algorithm: Redis Fixed-Window Rate Limiter
The system applies rate limiting using an atomic multi-transaction (`multi()`) in Redis:
1. When a request arrives, the server checks the IP key: `rate_limit:{type}:{ip}`.
2. If the count exceeds the configured maximum, the server queries the key's TTL to find out when the block resets and responds with an `HTTP 429 Too Many Requests`.
3. If the limit is not exceeded, the count is incremented:
   ```typescript
   const multi = client.multi();
   multi.incr(key);
   if (count === 0) {
     multi.expire(key, 60); // 1-minute window
   }
   await multi.exec();
   ```
4. **RFC Compliant Headers** are injected into the HTTP response:
   * `X-RateLimit-Limit`: Maximum requests allowed per window.
   * `X-RateLimit-Remaining`: Requests left in the current window.
   * `X-RateLimit-Reset`: UNIX epoch time when the rate limiter resets.

---

## 🛠️ Resilience & Fallback Architecture

A standout engineering feature of VaultShare is its **resilience against downstream service outages**. Both MongoDB and Redis have robust in-memory fallbacks:
* **MongoDB Fallback (`inMemoryDB`):** If the MongoDB URI is not set, or the database connection times out, the `FileProxy` intercepts the requests and routes them to a local JS `Map` storage. It wraps plain JS objects with a `.save()` method to mimic Mongoose behavior seamlessly.
* **Redis Fallback (`inMemoryRedis`):** If the Redis server is unavailable, the application falls back to an in-memory mock class that replicates Redis's interface (`set`, `get`, `incr`, `exists`, `del`, `ttl`, `multi`, `expire`) using node `setTimeout` and JS maps to handle key expirations.

---

## ⚙️ Challenges Resolved (Real-world Engineering)

During development, several complex issues were identified and successfully resolved:

1. **Next.js Hydration vs. Hash Fragment Retrieval**
   * *Problem:* Next.js uses server-side rendering (SSR). The browser's URL hash (anything after `#`) is never sent to the server. Attempting to read `window.location.hash` during initial server render throws errors or returns empty strings.
   * *Solution:* Wrapped key extraction in client-side React `useEffect` hooks, registered a `hashchange` listener, and implemented a short hydration delay fallback (150ms timeout) to ensure the client-side router has completed binding.

2. **Base64 Encoding Performance for Binary Files**
   * *Problem:* Standard conversion of large binary files using string concatenation inside loops causes memory spikes and stack-overflow exceptions on larger files.
   * *Solution:* Developed highly optimized Base64 helpers (`arrayBufferToBase64` and `base64ToArrayBuffer`) using typed `Uint8Array` allocations and standard browser API (`btoa`/`atob`) mappings, keeping memory consumption low.

3. **Atomic State Synchronization**
   * *Problem:* If Redis fell out of sync or went offline, download counters could lock users out of files or fail to delete them when limits were met.
   * *Solution:* Structured a dual-verification sync where MongoDB stores the source of truth, and Redis acts as the high-speed caching accelerator. Fallbacks gracefully check DB values if Redis returns default indicators.

---

## 🧪 Testing & Verification

VaultShare includes an automated end-to-end integration test suite (`src/scripts/test-end-to-end.ts`) that verifies:
1. Generation of cryptographic keys.
2. Client-side file and metadata encryption.
3. API route upload mapping.
4. Redis key generation and expiry verification.
5. Server response headers (e.g., retrieving the IV via `X-File-IV`).
6. Client-side decryption and exact verification against the source file.

To run the end-to-end test suite:
```bash
# Start the development server
npm run dev

# Run the integration test suite
npx ts-node -r tsconfig-paths/register src/scripts/test-end-to-end.ts
```

---

## ❓ Interview Q&A Cheatsheet

### Q1: How does VaultShare guarantee that the server never sees the decryption keys?
> **Answer:** We place the decryption key inside the **URL fragment (the hash '#')** rather than query parameters. The HTTP specification (RFC 3986) dictates that browsers must strip out the hash fragment before sending requests to the server. The server receives the path `/f/fileId` but never sees `#key=...`. The key is read and processed purely in the browser's JavaScript execution environment.

### Q2: What is the benefit of AES-GCM over AES-CBC?
> **Answer:** AES-GCM is an **authenticated encryption (AEAD)** mode. It provides both encryption and integrity checking by generating an authentication tag. AES-CBC only provides encryption and requires a secondary system (like HMAC) to verify the data hasn't been tampered with. If a file encrypted with AES-GCM is modified on the server, the client decryption fails immediately, preventing modified file execution attacks.

### Q3: Why is Redis necessary for rate-limiting and link expiration instead of just MongoDB?
> **Answer:** 
> 1. **Performance:** Redis stores data in memory, giving sub-millisecond lookups. Querying MongoDB on every page load to check expiry and rate limits adds heavy disk I/O.
> 2. **Native Expiry:** Redis automatically evicts keys using TTL. We don't need cron jobs or background database sweepers to clean up expired links.
> 3. **Atomicity:** Redis operations are atomic. Using `INCR` avoids race conditions where two concurrent requests try to update the download limit at the exact same millisecond.

### Q4: What happens if two people download the last file at the same time?
> **Answer:** Because we use Redis's atomic `INCR` operation, the requests are queued sequentially at the memory level. One user will get count $N-1$ and successfully receive the file, while the next user's increment immediately bumps the count to $N$, triggering the automatic self-destruction (deletion) cascade. Only one user will get the final slot.

### Q5: How does your application recover if Redis crashes?
> **Answer:** The application uses a custom **Fail-Soft Architecture**. The Redis connection client catches errors and falls back to an in-memory caching mock. While the high-speed caching is lost, the application remains fully functional, falling back to MongoDB's database counts and localized key tracking.
