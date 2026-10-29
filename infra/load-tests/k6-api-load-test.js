import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const searchLatency = new Trend('search_latency_ms');
const queueLatency = new Trend('verification_queue_latency_ms');
const errorRate = new Rate('error_rate');

export const options = {
  stages: [
    { duration: '30s', target: 25 },   // Ramp-up to 25 VUs
    { duration: '1m', target: 100 },   // Stress at 100 VUs
    { duration: '30s', target: 200 },  // Peak spike at 200 VUs
    { duration: '30s', target: 0 },    // Ramp-down to 0
  ],
  thresholds: {
    http_req_duration: ['p(50)<50', 'p(95)<150', 'p(99)<300'], // Latency targets
    error_rate: ['rate<0.01'],                                  // < 1% error rate
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001/api/v1';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${__ENV.TEST_JWT_TOKEN || 'mock-admin-token'}`,
  };

  // 1. Query Hot Cases List (Cached via Redis)
  const casesRes = http.get(`${BASE_URL}/cases`, { headers });
  const casesOk = check(casesRes, {
    'GET /cases status 200': (r) => r.status === 200,
  });
  if (!casesOk) errorRate.add(1);

  // 2. Query Prioritized Verification Queue
  const t0 = Date.now();
  const queueRes = http.get(`${BASE_URL}/verification/queue?limit=25`, { headers });
  queueLatency.add(Date.now() - t0);

  const queueOk = check(queueRes, {
    'GET /verification/queue status 200': (r) => r.status === 200,
  });
  if (!queueOk) errorRate.add(1);

  // 3. Trigger AI Search Job (Asynchronous Sharded Pipeline)
  if (Math.random() < 0.2) {
    const tSearch = Date.now();
    const searchPayload = JSON.stringify({
      caseId: 'case_crit_01',
      cameraIds: ['cam_001', 'cam_003', 'cam_007'],
      timeRange: {
        from: '2026-10-28T09:00:00Z',
        to: '2026-10-28T10:00:00Z',
      },
      minConfidence: 0.70,
    });

    const searchRes = http.post(`${BASE_URL}/search-jobs`, searchPayload, { headers });
    searchLatency.add(Date.now() - tSearch);

    const searchOk = check(searchRes, {
      'POST /search-jobs status 201': (r) => r.status === 201 || r.status === 200,
    });
    if (!searchOk) errorRate.add(1);
  }

  sleep(0.5);
}
