import { Router } from 'express';
import * as inventoryController from '../controllers/inventory.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/authorize-roles.middleware.js';
import {
    validateAdjustment,
    validateListTransactions,
    validateStockIn,
    validateStockOut,
    validateTransactionId,
} from '../validators/inventory.validator.js';

const router = Router();
const adminAndManager = authorizeRoles('Admin', 'Manager');
const adminOnly = authorizeRoles('Admin');

router.get(
    '/transactions',
    authenticateToken,
    adminAndManager,
    validateListTransactions,
    inventoryController.listTransactions,
);
router.get(
    '/transactions/:id',
    authenticateToken,
    adminAndManager,
    validateTransactionId,
    inventoryController.getTransactionById,
);
router.post(
    '/stock-in',
    authenticateToken,
    adminAndManager,
    validateStockIn,
    inventoryController.stockIn,
);
router.post(
    '/stock-out',
    authenticateToken,
    adminAndManager,
    validateStockOut,
    inventoryController.stockOut,
);
router.post(
    '/adjustments',
    authenticateToken,
    adminOnly,
    validateAdjustment,
    inventoryController.adjustStock,
);

export default router;
