/**
 * Day 21 — HybridCache load test
 *
 * Two scenarios:
 *   baseline   — warm the API with no cache benefit (first hit on each ID)
 *   hot_read   — 50 VUs hammering the same small set of IDs; expects high cache-hit rate
 *
 * Run baseline:
 *   k6 run --insecure-skip-tls-verify --env SCENARIO=baseline load-test.k6.js
 *
 * Run hot-read (default):
 *   k6 run --insecure-skip-tls-verify load-test.k6.js
 *
 * With Redis:
 *   k6 run --insecure-skip-tls-verify --env REDIS=1 load-test.k6.js
 *
 * Key metrics to watch:
 *   http_req_duration{p(95), p(99)} — latency percentiles
 *   cache_hit_rate                  — fraction of requests served < 50 ms
 *   http_reqs                       — throughput (req/s in summary)
 *   db_fetches                      — increments each time the factory ran (miss)
 */

import http from 'k6/http';
import { sleep, check } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

// Rate: 1 = likely cache hit (< 50 ms), 0 = likely miss or DB call
const cacheHitRate = new Rate('cache_hit_rate');

// Trend: raw quote-endpoint durations isolated from other request types
const quoteDuration = new Trend('quote_duration_ms', true);

// Counter: increments whenever the response time suggests a DB fetch (> 100 ms)
const dbFetches = new Counter('db_fetches');

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'https://localhost:5032';
const SCENARIO = __ENV.SCENARIO || 'hot_read';

export const options = {
  scenarios: {
    hot_read: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
      // Skip this scenario if user chose baseline
      exec: SCENARIO === 'baseline' ? 'baselineDefault' : 'hotReadDefault',
    },
  },

  thresholds: {
    // After warmup the cache should absorb > 80 % of requests sub-50 ms
    cache_hit_rate:    ['rate>0.80'],
    // p95 must be under 200 ms even before cache warmup
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    // Error rate must stay below 1 %
    http_req_failed:   ['rate<0.01'],
  },

  insecureSkipTLSVerify: true,
};

// ---------------------------------------------------------------------------
// Setup: log in once and share the access token across all VUs
// ---------------------------------------------------------------------------

export function setup() {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: 'admin@example.com', password: 'password123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (!check(res, { 'login 200': r => r.status === 200 })) {
    throw new Error(`Login failed: HTTP ${res.status} — ${res.body}`);
  }

  const token = res.json('access_token');
  if (!token) throw new Error('access_token missing from login response');

  console.log(`[setup] Login OK. Token expires in ${res.json('expires_in')} s`);
  return { token };
}

// ---------------------------------------------------------------------------
// Hot-read scenario: 50 VUs, fixed ID pool [1-10]
//
// Concentrating traffic on 10 IDs means every VU re-uses a key that was
// already warmed by another VU. After the first round-trip per key (cache
// miss → DB fetch), HybridCache serves all subsequent requests from L1
// (in-process) memory — response times drop to < 5 ms.
//
// Stampede proof: start the API cold, send 50 concurrent requests for ID=1.
// Check the console logs: "Cache miss — fetching quote:1 from database."
// appears exactly once regardless of concurrency.
// ---------------------------------------------------------------------------

export function hotReadDefault(data) {
  // Spread 50 VUs evenly over IDs 1-10
  const id = ((__VU - 1) % 10) + 1;

  const res = http.get(`${BASE_URL}/api/quotes/${id}`, {
    headers: { Authorization: `Bearer ${data.token}` },
    tags:    { endpoint: 'quote_by_id' },
  });

  check(res, {
    'status 200':  r => r.status === 200,
    'has quote id': r => r.json('id') !== undefined,
  });

  quoteDuration.add(res.timings.duration, { id: String(id) });

  // L1 in-process hit: < 5 ms
  // L2 Redis hit:       5–30 ms
  // DB fetch (miss):  > 50 ms
  const likelyCacheHit = res.timings.duration < 50;
  cacheHitRate.add(likelyCacheHit);

  if (res.timings.duration > 100) {
    dbFetches.add(1, { id: String(id) });
  }

  sleep(0.05); // 50 ms think time → ~20 req/s per VU → ~1 000 req/s at 50 VUs
}

// ---------------------------------------------------------------------------
// Baseline scenario: each VU uses a unique ID so every request misses cache
// ---------------------------------------------------------------------------

export function baselineDefault(data) {
  // __VU is 1-indexed, __ITER is 0-indexed per VU
  // This creates a wide spread of IDs → near-zero cache benefit
  const id = ((__VU - 1) * 1000 + __ITER) % 500 + 1;

  const res = http.get(`${BASE_URL}/api/quotes/${id}`, {
    headers: { Authorization: `Bearer ${data.token}` },
    tags:    { endpoint: 'quote_by_id_baseline' },
  });

  check(res, {
    'status 200 or 404': r => r.status === 200 || r.status === 404,
  });

  quoteDuration.add(res.timings.duration, { scenario: 'baseline' });
  cacheHitRate.add(res.timings.duration < 50);

  sleep(0.05);
}

// ---------------------------------------------------------------------------
// Stampede demo: call this with k6 run --vus 50 --iterations 50 to send
// exactly 50 simultaneous requests for ID 1 and observe a single DB log line.
// ---------------------------------------------------------------------------
export function stampedeProof(data) {
  const res = http.get(`${BASE_URL}/api/quotes/1`, {
    headers: { Authorization: `Bearer ${data.token}` },
    tags:    { endpoint: 'stampede_test' },
  });

  check(res, { 'status 200': r => r.status === 200 });
  quoteDuration.add(res.timings.duration);
  cacheHitRate.add(res.timings.duration < 50);
}

// Default export delegates to the correct function based on SCENARIO env var
export default hotReadDefault;
