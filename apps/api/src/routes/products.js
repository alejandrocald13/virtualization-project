import { Router } from 'express';
import { parseProductId, validateProduct } from '../validation.js';

const NOT_FOUND = { error: 'Product not found' };

export function createProductsRouter(productsRepository) {
  const router = Router();

  router.get('/', async (request, response) => {
    response.json(await productsRepository.list());
  });

  router.get('/:id', async (request, response) => {
    const id = parseProductId(request.params.id);
    const product = id && (await productsRepository.get(id));
    if (!product) {
      response.status(404).json(NOT_FOUND);
      return;
    }
    response.json(product);
  });

  router.post('/', async (request, response) => {
    const { errors, product } = validateProduct(request.body);
    if (errors.length > 0) {
      response.status(400).json({ errors });
      return;
    }
    response.status(201).json(await productsRepository.create(product));
  });

  router.put('/:id', async (request, response) => {
    const id = parseProductId(request.params.id);
    if (!id) {
      response.status(404).json(NOT_FOUND);
      return;
    }
    const { errors, product } = validateProduct(request.body);
    if (errors.length > 0) {
      response.status(400).json({ errors });
      return;
    }
    const updated = await productsRepository.update(id, product);
    if (!updated) {
      response.status(404).json(NOT_FOUND);
      return;
    }
    response.json(updated);
  });

  router.delete('/:id', async (request, response) => {
    const id = parseProductId(request.params.id);
    const removed = id && (await productsRepository.remove(id));
    if (!removed) {
      response.status(404).json(NOT_FOUND);
      return;
    }
    response.status(204).end();
  });

  return router;
}
