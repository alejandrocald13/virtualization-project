export function createInMemoryProductsRepository() {
  const products = new Map();
  let nextId = 1;

  return {
    async list() {
      return [...products.values()];
    },

    async get(id) {
      return products.get(id) ?? null;
    },

    async create(data) {
      const now = new Date().toISOString();
      const product = { id: nextId++, ...data, createdAt: now, updatedAt: now };
      products.set(product.id, product);
      return product;
    },

    async update(id, data) {
      const current = products.get(id);
      if (!current) {
        return null;
      }
      const updated = { ...current, ...data, updatedAt: new Date().toISOString() };
      products.set(id, updated);
      return updated;
    },

    async remove(id) {
      return products.delete(id);
    },
  };
}
