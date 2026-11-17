import * as inventoryService from '../services/inventory.service.js';

export function listTransactions(req, res) {
    return res
        .status(200)
        .json(inventoryService.listTransactions(req.validatedQuery));
}

export function getTransactionById(req, res) {
    const transaction = inventoryService.getTransactionById(
        req.validatedParams.id,
    );
    return res.status(200).json({ transaction });
}

export function stockIn(req, res) {
    const transaction = inventoryService.stockIn(
        req.validatedBody,
        req.auth.userId,
    );
    return res.status(201).json({ transaction });
}

export function stockOut(req, res) {
    const transaction = inventoryService.stockOut(
        req.validatedBody,
        req.auth.userId,
    );
    return res.status(201).json({ transaction });
}

export function adjustStock(req, res) {
    const transaction = inventoryService.adjustStock(
        req.validatedBody,
        req.auth.userId,
    );
    return res.status(201).json({ transaction });
}
