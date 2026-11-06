import assert from 'node:assert/strict';
import net from 'node:net';
import { afterEach, describe, it } from 'node:test';
import { createPool } from '../src/db.js';

// PostgreSQL wire protocol messages: AuthenticationOk and ReadyForQuery.
const HANDSHAKE = Buffer.from([0x52, 0, 0, 0, 8, 0, 0, 0, 0, 0x5a, 0, 0, 0, 5, 0x49]);

describe('database pool against a server that stops answering', () => {
  let server;
  let pool;
  const sockets = new Set();

  async function startServer(onData) {
    server = net.createServer((socket) => {
      sockets.add(socket);
      socket.on('error', () => {});
      socket.on('data', (data) => onData(socket, data));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    pool = createPool(`postgresql://user:password@127.0.0.1:${server.address().port}/kubelab`);
  }

  afterEach(async () => {
    sockets.forEach((socket) => socket.destroy());
    sockets.clear();
    await pool.end();
    await new Promise((resolve) => server.close(resolve));
  });

  it('fails instead of waiting forever for a connection', async () => {
    await startServer(() => {});

    const startedAt = Date.now();
    await assert.rejects(pool.query('SELECT 1'), /timeout/i);
    assert.ok(Date.now() - startedAt < 4500);
  });

  it('fails a stuck query and discards its connection', async () => {
    let connected = false;
    await startServer((socket) => {
      if (!connected) {
        connected = true;
        socket.write(HANDSHAKE);
      }
    });

    const startedAt = Date.now();
    await assert.rejects(pool.query('SELECT 1'), /timeout/i);
    assert.ok(Date.now() - startedAt < 6500);
    assert.equal(pool.totalCount, 0);
  });
});
