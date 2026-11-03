import { useEffect, useState } from 'react';
import { createProduct, deleteProduct, listProducts, updateProduct } from './api/products.js';
import ProductForm from './components/ProductForm.jsx';
import ProductTable from './components/ProductTable.jsx';

export default function App() {
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  async function refreshProducts() {
    try {
      setProducts(await listProducts());
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(`No se pudieron cargar los productos: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshProducts();
  }, []);

  async function handleSubmit(product) {
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, product);
        setEditingProduct(null);
      } else {
        await createProduct(product);
      }
      await refreshProducts();
      return true;
    } catch (error) {
      setErrorMessage(`No se pudo guardar: ${error.message}`);
      return false;
    }
  }

  async function handleDelete(product) {
    if (!window.confirm(`¿Eliminar "${product.name}"?`)) {
      return;
    }
    try {
      await deleteProduct(product.id);
      if (editingProduct?.id === product.id) {
        setEditingProduct(null);
      }
      await refreshProducts();
    } catch (error) {
      setErrorMessage(`No se pudo eliminar: ${error.message}`);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>Inventario KubeLab</h1>
        <p>Grupo 6 · Kubernetes sobre Proxmox con GitOps</p>
      </header>

      {errorMessage && (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      )}

      <section className="layout">
        <ProductForm
          editingProduct={editingProduct}
          onSubmit={handleSubmit}
          onCancel={() => setEditingProduct(null)}
        />
        <div className="products">
          <h2>Productos</h2>
          {isLoading ? (
            <p className="empty-state">Cargando…</p>
          ) : (
            <ProductTable products={products} onEdit={setEditingProduct} onDelete={handleDelete} />
          )}
        </div>
      </section>
    </main>
  );
}
