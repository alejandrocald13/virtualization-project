const PRODUCT_COLUMNS = 'id, name, quantity, price, created_at, updated_at';

function toProduct(row) {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    // NUMERIC arrives as a string from pg to avoid precision loss; prices fit in a JS number.
    price: Number(row.price),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createProductsRepository(pool) {
  return {
    async list() {
      const { rows } = await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY id`);
      return rows.map(toProduct);
    },

    async get(id) {
      const { rows } = await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = $1`, [id]);
      return rows[0] ? toProduct(rows[0]) : null;
    },

    async create({ name, quantity, price }) {
      const { rows } = await pool.query(
        `INSERT INTO products (name, quantity, price) VALUES ($1, $2, $3) RETURNING ${PRODUCT_COLUMNS}`,
        [name, quantity, price],
      );
      return toProduct(rows[0]);
    },

    async update(id, { name, quantity, price }) {
      const { rows } = await pool.query(
        `UPDATE products SET name = $2, quantity = $3, price = $4, updated_at = now()
         WHERE id = $1 RETURNING ${PRODUCT_COLUMNS}`,
        [id, name, quantity, price],
      );
      return rows[0] ? toProduct(rows[0]) : null;
    },

    async remove(id) {
      const { rowCount } = await pool.query('DELETE FROM products WHERE id = $1', [id]);
      return rowCount > 0;
    },
  };
}

export function createDatabaseCheck(pool) {
  return async () => {
    await pool.query('SELECT 1');
  };
}
