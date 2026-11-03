import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createInMemoryProductsRepository } from './support/in-memory-products-repository.js';

const keyboard = { name: 'Keyboard', quantity: 10, price: 25.5 };

function buildApp({ databaseUp = true } = {}) {
  return createApp({
    productsRepository: createInMemoryProductsRepository(),
    checkDatabase: async () => {
      if (!databaseUp) {
        throw new Error('database down');
      }
    },
  });
}

describe('health endpoints', () => {
  it('reports ok when the database answers', async () => {
    const response = await request(buildApp()).get('/health');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { status: 'ok', database: 'ok' });
  });

  it('reports 503 when the database is unreachable', async () => {
    const response = await request(buildApp({ databaseUp: false })).get('/health');
    assert.equal(response.status, 503);
  });

  it('keeps liveness independent from the database', async () => {
    const response = await request(buildApp({ databaseUp: false })).get('/health/live');
    assert.equal(response.status, 200);
  });
});

describe('products crud', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  it('creates and lists products', async () => {
    const created = await request(app).post('/api/products').send(keyboard);
    assert.equal(created.status, 201);
    assert.equal(created.body.name, 'Keyboard');

    const list = await request(app).get('/api/products');
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);
  });

  it('gets, updates and deletes a product', async () => {
    const { body: product } = await request(app).post('/api/products').send(keyboard);

    const fetched = await request(app).get(`/api/products/${product.id}`);
    assert.equal(fetched.body.price, 25.5);

    const updated = await request(app)
      .put(`/api/products/${product.id}`)
      .send({ ...keyboard, quantity: 3 });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.quantity, 3);

    const deleted = await request(app).delete(`/api/products/${product.id}`);
    assert.equal(deleted.status, 204);

    const missing = await request(app).get(`/api/products/${product.id}`);
    assert.equal(missing.status, 404);
  });

  it('rejects invalid products', async () => {
    const response = await request(app).post('/api/products').send({ name: ' ', quantity: -1, price: 'free' });
    assert.equal(response.status, 400);
    assert.equal(response.body.errors.length, 3);
  });

  it('rejects malformed json', async () => {
    const response = await request(app)
      .post('/api/products')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    assert.equal(response.status, 400);
  });

  it('returns 404 for unknown or invalid ids', async () => {
    assert.equal((await request(app).get('/api/products/999')).status, 404);
    assert.equal((await request(app).get('/api/products/abc')).status, 404);
    assert.equal((await request(app).put('/api/products/999').send(keyboard)).status, 404);
    assert.equal((await request(app).delete('/api/products/abc')).status, 404);
  });
});

describe('metrics endpoint', () => {
  it('exposes request counters labelled by route pattern', async () => {
    const app = buildApp();
    await request(app).get('/api/products/42');

    const response = await request(app).get('/metrics');
    assert.equal(response.status, 200);
    assert.match(response.text, /http_requests_total\{method="GET",route="\/api\/products\/:id",status_code="404"\} 1/);
  });
});
