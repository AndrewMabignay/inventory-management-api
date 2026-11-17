import { Router } from 'express';
import * as categoryController from '../controllers/category.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/authorize-roles.middleware.js';
import {
    validateCategoryId,
    validateCreateCategory,
    validateListCategories,
    validateUpdateCategory,
} from '../validators/category.validator.js';

const router = Router();
const canReadCategories = authorizeRoles('Admin', 'Manager');
const adminOnly = authorizeRoles('Admin');

router.get(
    '/',
    authenticateToken,
    canReadCategories,
    validateListCategories,
    categoryController.listCategories,
);
router.get(
    '/:id',
    authenticateToken,
    canReadCategories,
    validateCategoryId,
    categoryController.getCategoryById,
);
router.post(
    '/',
    authenticateToken,
    adminOnly,
    validateCreateCategory,
    categoryController.createCategory,
);
router.put(
    '/:id',
    authenticateToken,
    adminOnly,
    validateCategoryId,
    validateUpdateCategory,
    categoryController.updateCategory,
);
router.delete(
    '/:id',
    authenticateToken,
    adminOnly,
    validateCategoryId,
    categoryController.deleteCategory,
);

export default router;
