# Hosting Cost Estimate 002: Infrastructure Costs at Scale

**Date:** 2026-03-09
**Scope:** Hosted service infrastructure cost projections across user tiers and providers
**Methodology:** Architecture analysis of all ADRs, planning docs, and feature specs; mapped to current provider pricing

---

## Architecture Summary

The hosted service requires these infrastructure components:

| Component              | Technology                | Scaling Driver                                      |
| ---------------------- | ------------------------- | --------------------------------------------------- |
| **API Server**         | Bun/Hono                  | Concurrent connections, WebSocket count             |
| **Database**           | PostgreSQL (Drizzle)      | Row count, query volume, encrypted blob metadata    |
| **Cache/PubSub/Jobs**  | Valkey (Redis-compatible) | WebSocket fanout, BullMQ job queue depth            |
| **Object Storage**     | S3-compatible             | Encrypted media blobs (avatars, galleries, imports) |
| **Push Notifications** | FCM/APNs                  | Switch events x friend count                        |

### Key Scaling Characteristics

- **Server is a "dumb relay"** — stores ciphertext only, no server-side content processing. This _reduces_ CPU needs but _increases_ per-user storage.
- **CRDT sync** — encrypted Automerge operations flow through the server via WebSocket. Higher bandwidth per user than a traditional REST API.
- **WebSocket connections** — every active client holds a persistent connection for real-time sync + chat + fronting updates.
- **Media is client-encrypted** — no server-side transcoding, but thumbnails are separate blobs (2x blob count per image).
- **Privacy bucket key grants** — ~128 bytes each, negligible storage even at 500K users (~320MB total).

### Usage Assumptions

| Metric                   | Estimate                                              |
| ------------------------ | ----------------------------------------------------- |
| Members per system       | ~15 avg, ~200 max                                     |
| Fronting sessions/day    | 3-5 per active user                                   |
| Chat messages/day        | ~20 per active system                                 |
| Media per user           | ~50MB avg (avatars + gallery)                         |
| Concurrent rate          | ~10-15% of registered users                           |
| WebSocket connections    | 1.3 per concurrent user (some multi-device)           |
| API requests/user/day    | ~200 (sync ops, CRUD, polling)                        |
| DB rows per user         | ~2000 (members + fields + fronting + chat + metadata) |
| Bandwidth per user/month | ~150MB (sync + API + media)                           |

---

## Provider Recommendations

Given this architecture (sensitive psychiatric data, E2E encrypted, AGPL, self-hostable, needs WebSocket support), five providers were evaluated:

1. **Hetzner** — Best price/performance, EU-based (GDPR native), bare metal and cloud
2. **DigitalOcean** — Simple managed services, predictable pricing, good middle ground
3. **Fly.io** — Edge deployment, great WebSocket support, per-region scaling
4. **Railway** — Developer-friendly PaaS, easy to start, scales reasonably
5. **AWS** — Enterprise scale ceiling, most services, but complex/expensive

---

## Cost Estimates by User Count

### 1 User (Development / Personal)

| Component      | Hetzner                     | DigitalOcean | Fly.io              | Railway    | AWS          |
| -------------- | --------------------------- | ------------ | ------------------- | ---------- | ------------ |
| Compute        | CX22 $4                     | Droplet $6   | shared-1x $5        | Starter $5 | t4g.micro $7 |
| Database       | Self-managed on same box $0 | --           | --                  | --         | --           |
| Valkey         | Self-managed $0             | --           | --                  | --         | --           |
| Object Storage | 50MB Storage Box $4\*       | Spaces $5\*  | Tigris free tier $0 | --         | S3 ~$0.01    |
| **Total**      | **~$4/mo**                  | **~$6/mo**   | **~$5/mo**          | **~$5/mo** | **~$7/mo**   |

_\* Minimum plan pricing applies; actual usage is negligible._

At 1 user, everything runs on a single small instance. No managed database needed — self-host PostgreSQL + Valkey on the same box. Realistically, the minimal self-hosted tier (single Bun binary + SQLite) is the right answer here — **$0 beyond the machine**.

### 50 Users

| Component      | Hetzner         | DigitalOcean | Fly.io           | Railway     | AWS                       |
| -------------- | --------------- | ------------ | ---------------- | ----------- | ------------------------- |
| Compute (1x)   | CX22 $4         | Basic $12    | shared-2x $12    | Pro $20     | t4g.small $15             |
| PostgreSQL     | Self-managed $0 | Managed $15  | Supabase free $0 | Plugin $10  | RDS t4g.micro $13         |
| Valkey         | Self-managed $0 | Managed $15  | Upstash free $0  | Plugin $10  | ElastiCache t4g.micro $12 |
| Object Storage | 2.5GB $4        | Spaces $5    | Tigris $0.50     | --          | S3 $0.06                  |
| Bandwidth      | ~7.5GB included | included     | ~$1              | included    | ~$1                       |
| **Total**      | **~$8/mo**      | **~$47/mo**  | **~$14/mo**      | **~$40/mo** | **~$41/mo**               |

Hetzner wins by a mile here because you self-manage services on cheap VPSes. 5-8 concurrent users is easily handled by a single small box.

### 100 Users

| Component      | Hetzner         | DigitalOcean | Fly.io         | Railway     | AWS               |
| -------------- | --------------- | ------------ | -------------- | ----------- | ----------------- |
| Compute (1x)   | CX32 $8         | Basic $24    | shared-4x $24  | Pro $20     | t4g.medium $30    |
| PostgreSQL     | Self-managed $0 | Managed $15  | Neon free->$19 | Plugin $20  | RDS t4g.small $26 |
| Valkey         | Self-managed $0 | Managed $15  | Upstash $10    | Plugin $10  | ElastiCache $12   |
| Object Storage | 5GB $4          | Spaces $5    | Tigris $1      | S3 $1       | S3 $0.12          |
| Bandwidth      | ~15GB included  | included     | ~$2            | included    | ~$1.50            |
| **Total**      | **~$12/mo**     | **~$59/mo**  | **~$56/mo**    | **~$51/mo** | **~$70/mo**       |

Still comfortable on a single compute instance. ~10-15 concurrent WebSocket connections is trivial.

### 1,000 Users

| Component      | Hetzner               | DigitalOcean | Fly.io       | Railway      | AWS                |
| -------------- | --------------------- | ------------ | ------------ | ------------ | ------------------ |
| Compute (1x)   | CX42 $16              | Premium $48  | perf-2x $47  | Pro $50      | t4g.large $60      |
| PostgreSQL     | Managed (basic) $10\* | Managed $30  | Neon $19     | Plugin $30   | RDS t4g.medium $52 |
| Valkey         | Self-managed $0       | Managed $20  | Upstash $20  | Plugin $15   | ElastiCache $24    |
| Object Storage | 50GB $4               | Spaces $5    | Tigris $5    | S3 $5        | S3 $1.15           |
| Bandwidth      | ~150GB included       | included     | ~$12         | included     | ~$13               |
| **Total**      | **~$30/mo**           | **~$103/mo** | **~$103/mo** | **~$100/mo** | **~$150/mo**       |

_\* Hetzner managed DB is newer; alternatively self-manage PG on a dedicated CX22 for $4._

~100-150 concurrent connections, ~200K API requests/day. Single beefy instance or start considering a second for redundancy.

### 5,000 Users

| Component      | Hetzner           | DigitalOcean   | Fly.io         | Railway      | AWS                        |
| -------------- | ----------------- | -------------- | -------------- | ------------ | -------------------------- |
| Compute (2x)   | 2x CX42 $32       | 2x Premium $96 | 2x perf-2x $94 | 2x Pro $100  | 2x t4g.large $120          |
| PostgreSQL     | Dedicated CX32 $8 | Managed $60    | Neon $69       | Plugin $60   | RDS m7g.large $135         |
| Valkey         | Dedicated CX22 $4 | Managed $40    | Upstash $40    | Plugin $30   | ElastiCache m7g.large $110 |
| Object Storage | 250GB $8          | Spaces $7      | Tigris $22     | S3 $22       | S3 $5.75                   |
| Bandwidth      | ~750GB incl       | included       | ~$55           | included     | ~$65                       |
| Load Balancer  | LB $6             | LB $12         | Anycast incl   | incl         | ALB $22                    |
| **Total**      | **~$58/mo**       | **~$215/mo**   | **~$280/mo**   | **~$212/mo** | **~$458/mo**               |

~500-750 concurrent WebSocket connections. Two API instances behind a load balancer. Valkey pub/sub handles cross-instance WebSocket fanout. Database needs dedicated resources.

### 25,000 Users

| Component      | Hetzner               | DigitalOcean    | Fly.io          | Railway      | AWS                        |
| -------------- | --------------------- | --------------- | --------------- | ------------ | -------------------------- |
| Compute (4x)   | 4x CX42 $64           | 4x Premium $192 | 4x perf-4x $380 | 4x Pro $280  | 4x m7g.large $480          |
| PostgreSQL     | CCX33 (dedicated) $39 | Managed $120    | Neon $300       | Plugin $150  | RDS m7g.xlarge $270        |
| Valkey         | CX32 dedicated $8     | Managed $80     | Upstash $100    | Plugin $60   | ElastiCache m7g.large $110 |
| Object Storage | 1.25TB $20            | Spaces $15      | Tigris $100     | S3 $100      | S3 $29                     |
| Bandwidth      | ~3.75TB incl          | included        | ~$275           | included     | ~$335                      |
| Load Balancer  | LB $6                 | LB $12          | incl            | incl         | ALB $22                    |
| Monitoring     | $0 (self)             | $0              | $0              | $0           | CloudWatch $30             |
| **Total**      | **~$137/mo**          | **~$419/mo**    | **~$1,155/mo**  | **~$590/mo** | **~$1,276/mo**             |

~2,500-3,750 concurrent connections. Four API instances. Database needs 16GB+ RAM for connection pooling and query performance. Hetzner's advantage compounds at scale.

### 100,000 Users

| Component      | Hetzner                   | DigitalOcean    | Fly.io          | Railway        | AWS                          |
| -------------- | ------------------------- | --------------- | --------------- | -------------- | ---------------------------- |
| Compute (8x)   | 8x CX42 $128              | 8x Premium $384 | 8x perf-4x $760 | 8x $560        | 8x m7g.large $960            |
| PostgreSQL     | CCX53 + read replica $130 | Managed $250    | Neon $700       | $300           | RDS m7g.2xl + replica $1,080 |
| Valkey         | CCX23 cluster $26         | Managed $160    | Upstash $250    | $120           | ElastiCache m7g.xl $220      |
| Object Storage | 5TB $50                   | Spaces $25      | Tigris $400     | $400           | S3 $115                      |
| Bandwidth      | ~15TB incl                | included        | ~$1,100         | incl           | ~$1,350                      |
| Load Balancer  | LB $6                     | LB $12          | incl            | incl           | ALB $30                      |
| Backups        | $20                       | $50             | $50             | $50            | $100                         |
| **Total**      | **~$360/mo**              | **~$881/mo**    | **~$3,260/mo**  | **~$1,430/mo** | **~$3,855/mo**               |

~10,000-15,000 concurrent connections. Read replica for PostgreSQL. Valkey may need clustering. Bandwidth becomes a significant factor on metered providers.

### 500,000 Users

| Component         | Hetzner                           | DigitalOcean         | Fly.io      | AWS                             |
| ----------------- | --------------------------------- | -------------------- | ----------- | ------------------------------- |
| Compute (16-20x)  | 16x CX42 $256                     | 16x Premium $768     | Impractical | 16x m7g.xl $1,920               |
| PostgreSQL        | Dedicated CCX63 + 2 replicas $350 | Managed (maxed) $800 | --          | RDS m7g.4xl + 2 replicas $4,320 |
| Valkey            | CCX33 cluster $78                 | Managed $320         | --          | ElastiCache m7g.2xl $440        |
| Object Storage    | 25TB $120                         | Spaces $50           | --          | S3 $575                         |
| Bandwidth         | ~75TB incl                        | included             | --          | ~$6,750                         |
| Load Balancer     | LB $6                             | LB $12               | --          | ALB + NLB $60                   |
| Backups + DR      | $50                               | $100                 | --          | $300                            |
| PgBouncer/Pooling | $8                                | incl                 | --          | RDS Proxy $220                  |
| **Total**         | **~$868/mo**                      | **~$2,050/mo**       | **N/A**     | **~$14,585/mo**                 |

~50,000-75,000 concurrent connections. Multiple PostgreSQL read replicas. Valkey cluster for pub/sub fanout. At this scale, Fly.io and Railway are no longer appropriate — they're PaaS platforms not designed for this density. DigitalOcean reaches its managed service limits. Hetzner remains viable with self-managed infrastructure.

---

## Summary Table (Monthly USD)

|   Users | Hetzner | DigitalOcean | Fly.io | Railway |     AWS |
| ------: | ------: | -----------: | -----: | ------: | ------: |
|       1 |      $4 |           $6 |     $5 |      $5 |      $7 |
|      50 |      $8 |          $47 |    $14 |     $40 |     $41 |
|     100 |     $12 |          $59 |    $56 |     $51 |     $70 |
|   1,000 |     $30 |         $103 |   $103 |    $100 |    $150 |
|   5,000 |     $58 |         $215 |   $280 |    $212 |    $458 |
|  25,000 |    $137 |         $419 | $1,155 |    $590 |  $1,276 |
| 100,000 |    $360 |         $881 | $3,260 |  $1,430 |  $3,855 |
| 500,000 |    $868 |       $2,050 |    N/A |     N/A | $14,585 |

---

## Recommendations

### For launch through ~5,000 users: Hetzner Cloud

- 3-10x cheaper than alternatives at every tier
- EU-based (GDPR native) — critical for psychiatric health data
- Unmetered bandwidth eliminates the biggest cost surprise
- Trade-off: you self-manage PostgreSQL, Valkey, backups. More ops work.

### If you want managed services with less ops: DigitalOcean

- Good managed PostgreSQL and Redis/Valkey
- Predictable pricing, no bandwidth surprises
- Scales to ~100K before you outgrow their managed offerings

### For global low-latency from day one: Fly.io

- Best WebSocket support (edge termination, anycast)
- Gets expensive fast due to metered bandwidth — the CRDT sync traffic adds up
- Good for 50-5,000 users, reconsider after that

### At 500K: Hetzner dedicated + self-managed or AWS

- Hetzner: ~$870/mo but requires serious ops expertise
- AWS: ~$14,600/mo but fully managed, auto-scaling, multi-AZ
- Middle ground: Hetzner for compute + Cloudflare R2 for storage (no egress fees)

### Cost Per User Per Month

|   Users | Hetzner | DigitalOcean |    AWS |
| ------: | ------: | -----------: | -----: |
|      50 |   $0.16 |        $0.94 |  $0.82 |
|   1,000 |   $0.03 |        $0.10 |  $0.15 |
|   5,000 |  $0.012 |       $0.043 | $0.092 |
|  25,000 |  $0.005 |       $0.017 | $0.051 |
| 100,000 |  $0.004 |       $0.009 | $0.039 |
| 500,000 |  $0.002 |       $0.004 | $0.029 |

The E2E encryption architecture actually _helps_ hosting costs — the server does minimal computation (no content indexing, no image processing, no search). It's essentially a blob relay with metadata routing. The biggest cost drivers are **concurrent WebSocket connections** (determines compute instances) and **bandwidth** (CRDT sync operations).

### Bandwidth Note: Cloudflare R2

For object storage specifically, **Cloudflare R2** ($0.015/GB stored, **$0 egress**) is worth considering regardless of compute provider. At 500K users with 25TB stored, that's $375/mo with zero egress costs — compared to AWS S3 at $575 storage + $6,750 egress. This alone could save $6,000+/mo at scale.

---

## Caveats

- All prices are estimates based on March 2026 published pricing and may change
- Push notification costs (FCM/APNs) are not included — they are effectively free at all tiers
- Domain registration and SSL certificates are not included (~$15-50/year)
- Monitoring/observability costs (Grafana Cloud, Datadog, etc.) are not included — self-hosted alternatives exist
- Hetzner estimates assume self-managed services; add 20-40% if using their newer managed offerings
- Bandwidth estimates assume ~150MB/user/month; heavy media users or frequent CRDT sync could increase this
- These estimates do not include engineering time for infrastructure management
