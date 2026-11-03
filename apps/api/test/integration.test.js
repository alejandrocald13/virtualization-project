import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { createPool } from '../src/db.js';
import { createDatabaseCheck, createProductsRepository } from '../src/products-repository.js';

// Runs only where a real PostgreSQL is available (the CI pipeline sets DATABASE_URL).
const databaseUrl = process.env.DATABASE_URL;

describe('products repository against postgresql', { skip: !databaseUrl && 'DATABASE_URL is not set' }, () => {
  const pool = databaseUrl ? createPool(databaseUrl) : null;
  const repository = pool ? createProductsRepository(pool) : null;

  after(async () => {
    await pool?.end();
  });

  it('answers the health check', async () => {
    await createDatabaseCheck(pool)();
  });

  it('runs the full crud cycle', async () => {
    const created = await repository.create({ name: 'Integration product', quantity: 2, price: 9.99 });
    assert.equal(created.price, 9.99);

    const updated = await repository.update(created.id, { name: 'Integration product', quantity: 5, price: 9.99 });
    assert.equal(updated.quantity, 5);

    assert.equal(await repository.remove(created.id), true);
    assert.equal(await repository.get(created.id), null);
  });
});
