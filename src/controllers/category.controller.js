import * as categoryService from '../services/category.service.js';

export function listCategories(req, res) {
    return res
        .status(200)
        .json(categoryService.listCategories(req.validatedQuery));
}

export function getCategoryById(req, res) {
    const category = categoryService.getCategoryById(req.validatedParams.id);
    return res.status(200).json({ category });
}

export function createCategory(req, res) {
    const category = categoryService.createCategory(req.validatedBody);
    return res.status(201).json({ category });
}

export function updateCategory(req, res) {
    const category = categoryService.updateCategory(
        req.validatedParams.id,
        req.validatedBody,
    );
    return res.status(200).json({ category });
}

export function deleteCategory(req, res) {
    categoryService.deleteCategory(req.validatedParams.id);
    return res.status(204).end();
}
