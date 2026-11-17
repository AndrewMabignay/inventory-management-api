import { Router } from 'express';
import * as productController from '../controllers/product.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/authorize-roles.middleware.js';
import {
    validateCreateProduct,
    validateListProducts,
    validateProductId,
    validateUpdateProduct,
    validateUpdateProductStatus,
} from '../validators/product.validator.js';

const router = Router();
const canReadProducts = authorizeRoles('Admin', 'Manager', 'Staff');
const adminOnly = authorizeRoles('Admin');

router.get(
    '/',
    authenticateToken,
    canReadProducts,
    validateListProducts,
    productController.listProducts,
);
router.get(
    '/:id',
    authenticateToken,
    canReadProducts,
    validateProductId,
    productController.getProductById,
);
router.post(
    '/',
    authenticateToken,
    adminOnly,
    validateCreateProduct,
    productController.createProduct,
);
router.put(
    '/:id',
    authenticateToken,
    adminOnly,
    validateProductId,
    validateUpdateProduct,
    productController.updateProduct,
);
router.patch(
    '/:id/status',
    authenticateToken,
    adminOnly,
    validateProductId,
    validateUpdateProductStatus,
    productController.updateProductStatus,
);

export default router;
