import * as supplierService from '../services/supplier.service.js';

export function listSuppliers(req, res) {
    return res
        .status(200)
        .json(supplierService.listSuppliers(req.validatedQuery));
}

export function getSupplierById(req, res) {
    const supplier = supplierService.getSupplierById(req.validatedParams.id);
    return res.status(200).json({ supplier });
}

export function createSupplier(req, res) {
    const supplier = supplierService.createSupplier(req.validatedBody);
    return res.status(201).json({ supplier });
}

export function updateSupplier(req, res) {
    const supplier = supplierService.updateSupplier(
        req.validatedParams.id,
        req.validatedBody,
    );
    return res.status(200).json({ supplier });
}

export function deleteSupplier(req, res) {
    supplierService.deleteSupplier(req.validatedParams.id);
    return res.status(204).end();
}
