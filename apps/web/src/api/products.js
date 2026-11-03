const PRODUCTS_URL = '/api/products';

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body.errors?.join(', ') ?? body.error ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.status === 204 ? null : response.json();
}

export function listProducts() {
  return request(PRODUCTS_URL);
}

export function createProduct(product) {
  return request(PRODUCTS_URL, { method: 'POST', body: JSON.stringify(product) });
}

export function updateProduct(id, product) {
  return request(`${PRODUCTS_URL}/${id}`, { method: 'PUT', body: JSON.stringify(product) });
}

export function deleteProduct(id) {
  return request(`${PRODUCTS_URL}/${id}`, { method: 'DELETE' });
}
