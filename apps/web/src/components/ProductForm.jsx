import { useEffect, useState } from 'react';

const EMPTY_FORM = { name: '', quantity: '0', price: '0' };

function toFormValues(product) {
  return product
    ? { name: product.name, quantity: String(product.quantity), price: String(product.price) }
    : EMPTY_FORM;
}

export default function ProductForm({ editingProduct, onSubmit, onCancel }) {
  const [values, setValues] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setValues(toFormValues(editingProduct));
  }, [editingProduct]);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    const saved = await onSubmit({
      name: values.name.trim(),
      quantity: Number(values.quantity),
      price: Number(values.price),
    });
    setIsSaving(false);
    if (saved && !editingProduct) {
      setValues(EMPTY_FORM);
    }
  }

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <h2>{editingProduct ? `Editar producto #${editingProduct.id}` : 'Nuevo producto'}</h2>

      <label>
        Nombre
        <input name="name" value={values.name} onChange={handleChange} maxLength={120} required />
      </label>

      <label>
        Cantidad
        <input name="quantity" type="number" min="0" step="1" value={values.quantity} onChange={handleChange} required />
      </label>

      <label>
        Precio (Q)
        <input name="price" type="number" min="0" step="0.01" value={values.price} onChange={handleChange} required />
      </label>

      <div className="form-actions">
        <button type="submit" disabled={isSaving}>
          {editingProduct ? 'Guardar cambios' : 'Agregar'}
        </button>
        {editingProduct && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
