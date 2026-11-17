import { Router } from 'express';
import * as supplierController from '../controllers/supplier.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/authorize-roles.middleware.js';
import {
    validateCreateSupplier,
    validateListSuppliers,
    validateSupplierId,
    validateUpdateSupplier,
} from '../validators/supplier.validator.js';

const router = Router();
const canReadSuppliers = authorizeRoles('Admin', 'Manager');
const adminOnly = authorizeRoles('Admin');

router.get(
    '/',
    authenticateToken,
    canReadSuppliers,
    validateListSuppliers,
    supplierController.listSuppliers,
);
router.get(
    '/:id',
    authenticateToken,
    canReadSuppliers,
    validateSupplierId,
    supplierController.getSupplierById,
);
router.post(
    '/',
    authenticateToken,
    adminOnly,
    validateCreateSupplier,
    supplierController.createSupplier,
);
router.put(
    '/:id',
    authenticateToken,
    adminOnly,
    validateSupplierId,
    validateUpdateSupplier,
    supplierController.updateSupplier,
);
router.delete(
    '/:id',
    authenticateToken,
    adminOnly,
    validateSupplierId,
    supplierController.deleteSupplier,
);

export default router;
