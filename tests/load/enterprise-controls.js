import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    steady: { executor: 'ramping-arrival-rate', startRate: 5, timeUnit: '1s', preAllocatedVUs: 30, maxVUs: 200,
      stages: [{ target: 25, duration: '2m' }, { target: 50, duration: '5m' }, { target: 0, duration: '1m' }] },
  },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<750', 'p(99)<1500'] },
};

const base = __ENV.FPIP_API_URL || 'http://localhost:8000';
const token = __ENV.FPIP_ACCESS_TOKEN || '';

export default function () {
  const headers = { 'Content-Type': 'application/json', 'X-Request-ID': `k6-${__VU}-${__ITER}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = http.post(`${base}/controls/fraud/assess`, JSON.stringify({
    transaction_id: `LOAD-${__VU}-${__ITER}`, amount: 2500000, duplicate_invoice: false,
    bank_account_changed_recently: false, requestor_is_approver: false, supplier_country_risk: 'normal',
  }), { headers });
  check(response, { 'accepted or deliberately throttled': (r) => r.status === 200 || r.status === 429 });
  sleep(0.1);
}
