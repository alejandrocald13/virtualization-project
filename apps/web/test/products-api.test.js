import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProduct, deleteProduct, listProducts, updateProduct } from '../src/api/products.js';

function mockFetch(status, body) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('products api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists products from the relative api path', async () => {
    const fetchMock = mockFetch(200, [{ id: 1, name: 'Keyboard' }]);
    await expect(listProducts()).resolves.toEqual([{ id: 1, name: 'Keyboard' }]);
    expect(fetchMock).toHaveBeenCalledWith('/api/products', expect.any(Object));
  });

  it('sends the product as json when creating', async () => {
    const fetchMock = mockFetch(201, { id: 1 });
    await createProduct({ name: 'Mouse', quantity: 1, price: 5 });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ name: 'Mouse', quantity: 1, price: 5 });
  });

  it('updates and deletes by id', async () => {
    const fetchMock = mockFetch(200, { id: 7 });
    await updateProduct(7, { name: 'Mouse', quantity: 2, price: 5 });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products/7');

    mockFetch(204, null);
    await expect(deleteProduct(7)).resolves.toBeNull();
  });

  it('turns validation errors into a readable message', async () => {
    mockFetch(400, { errors: ['name is required', 'price must be a number between 0 and 99999999.99'] });
    await expect(createProduct({})).rejects.toThrow('name is required, price must be');
  });
});
