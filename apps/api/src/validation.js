const MAX_NAME_LENGTH = 120;
const MAX_PRICE = 99999999.99;
const MAX_ID = 2147483647;

export function validateProduct(body) {
  const errors = [];
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const quantity = body?.quantity ?? 0;
  const price = body?.price ?? 0;

  if (!name) {
    errors.push('name is required');
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.push(`name must be at most ${MAX_NAME_LENGTH} characters`);
  }

  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_ID) {
    errors.push('quantity must be a non-negative integer');
  }

  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
    errors.push(`price must be a number between 0 and ${MAX_PRICE}`);
  }

  return { errors, product: { name, quantity, price } };
}

export function parseProductId(value) {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const id = Number(value);
  return id >= 1 && id <= MAX_ID ? id : null;
}
