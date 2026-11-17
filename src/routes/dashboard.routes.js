import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/authorize-roles.middleware.js';
import {
    validateLowStock,
    validateRecentTransactions,
    validateStockLevels,
    validateTopProducts,
} from '../validators/dashboard.validator.js';

const router = Router();
const canReadDashboard = authorizeRoles('Admin', 'Manager');

router.get(
    '/summary',
    authenticateToken,
    canReadDashboard,
    dashboardController.getSummary,
);
router.get(
    '/stock-levels',
    authenticateToken,
    canReadDashboard,
    validateStockLevels,
    dashboardController.listStockLevels,
);
router.get(
    '/low-stock',
    authenticateToken,
    canReadDashboard,
    validateLowStock,
    dashboardController.listLowStock,
);
router.get(
    '/recent-transactions',
    authenticateToken,
    canReadDashboard,
    validateRecentTransactions,
    dashboardController.listRecentTransactions,
);
router.get(
    '/top-products',
    authenticateToken,
    canReadDashboard,
    validateTopProducts,
    dashboardController.listTopProducts,
);
router.get(
    '/inventory-value',
    authenticateToken,
    canReadDashboard,
    dashboardController.getInventoryValue,
);

export default router;
