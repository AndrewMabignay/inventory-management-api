import * as dashboardService from '../services/dashboard.service.js';

export function getSummary(req, res) {
    return res.status(200).json({ summary: dashboardService.getSummary() });
}

export function listStockLevels(req, res) {
    return res
        .status(200)
        .json(dashboardService.listStockLevels(req.validatedQuery));
}

export function listLowStock(req, res) {
    return res
        .status(200)
        .json(dashboardService.listLowStock(req.validatedQuery));
}

export function listRecentTransactions(req, res) {
    return res
        .status(200)
        .json(dashboardService.listRecentTransactions(req.validatedQuery));
}

export function listTopProducts(req, res) {
    return res
        .status(200)
        .json(dashboardService.listTopProducts(req.validatedQuery));
}

export function getInventoryValue(req, res) {
    return res
        .status(200)
        .json({ inventoryValue: dashboardService.getInventoryValue() });
}
