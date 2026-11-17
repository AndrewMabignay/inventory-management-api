import * as productService from '../services/product.service.js';

export function listProducts(req, res) {
    return res.status(200).json(productService.listProducts(req.validatedQuery));
}

export function getProductById(req, res) {
    const product = productService.getProductById(req.validatedParams.id);
    return res.status(200).json({ product });
}

export function createProduct(req, res) {
    const product = productService.createProduct(req.validatedBody);
    return res.status(201).json({ product });
}

export function updateProduct(req, res) {
    const product = productService.updateProduct(
        req.validatedParams.id,
        req.validatedBody,
    );
    return res.status(200).json({ product });
}

export function updateProductStatus(req, res) {
    const product = productService.updateProductStatus(
        req.validatedParams.id,
        req.validatedBody.isActive,
    );
    return res.status(200).json({ product });
}
