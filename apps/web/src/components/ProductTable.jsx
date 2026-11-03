const priceFormatter = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

export default function ProductTable({ products, onEdit, onDelete }) {
  if (products.length === 0) {
    return <p className="empty-state">Todavía no hay productos. Agrega el primero con el formulario.</p>;
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Nombre</th>
            <th scope="col" className="numeric">Cantidad</th>
            <th scope="col" className="numeric">Precio</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>{product.id}</td>
              <td>{product.name}</td>
              <td className="numeric">{product.quantity}</td>
              <td className="numeric">{priceFormatter.format(product.price)}</td>
              <td className="row-actions">
                <button type="button" className="secondary" onClick={() => onEdit(product)}>
                  Editar
                </button>
                <button type="button" className="danger" onClick={() => onDelete(product)}>
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
