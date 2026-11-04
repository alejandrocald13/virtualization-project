// k6 load test for the HPA demo: pushes the api above 60 % CPU so it scales from 2 towards 6 replicas.
//
// Run with Docker (10.60.129.240 is the Traefik LoadBalancer IP):
//   docker run --rm -i --add-host api.grupo6.lab:10.60.129.240 grafana/k6:1.8.2 run - < loadtest/api-load.js
//
// Watch the scaling in another terminal:
//   kubectl get hpa api -n kubelab -w
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://api.grupo6.lab';

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  const response = http.get(`${BASE_URL}/api/products`);
  check(response, { 'status is 200': (result) => result.status === 200 });
  sleep(0.1);
}
