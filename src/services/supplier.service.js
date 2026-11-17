import { randomUUID } from 'node:crypto';
import database from '../config/database.js';

const SUPPLIER_COLUMNS =
    'Id, Name, ContactPerson, Email, Phone, Address, CreatedAt, UpdatedAt';

let findSupplierByIdStatement;

function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function databaseError(operation, cause) {
    console.error(`Supplier database ${operation} failed.`, cause);
    return httpError(500, 'Supplier service error.');
}

function throwDatabaseOrHttpError(operation, error) {
    if (Number.isInteger(error.status)) {
        throw error;
    }

    throw databaseError(operation, error);
}

function toSupplier(supplier) {
    return {
        id: supplier.Id,
        name: supplier.Name,
        contactPerson: supplier.ContactPerson,
        email: supplier.Email,
        phone: supplier.Phone,
        address: supplier.Address,
        createdAt: supplier.CreatedAt,
        updatedAt: supplier.UpdatedAt,
    };
}

function findSupplierById(id) {
    if (!findSupplierByIdStatement) {
        findSupplierByIdStatement = database.prepare(`
            SELECT ${SUPPLIER_COLUMNS}
            FROM Suppliers
            WHERE Id = ?
        `);
    }

    return findSupplierByIdStatement.get(id);
}

function toSupplierValues(input) {
    return {
        name: input.name,
        contactPerson: input.contactPerson ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
    };
}

export function listSuppliers(filters) {
    const conditions = [];
    const parameters = [];

    if (filters.search) {
        const pattern = `%${filters.search}%`;
        conditions.push(`(
            Name LIKE ? COLLATE NOCASE OR
            ContactPerson LIKE ? COLLATE NOCASE OR
            Email LIKE ? COLLATE NOCASE OR
            Phone LIKE ? COLLATE NOCASE
        )`);
        parameters.push(pattern, pattern, pattern, pattern);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';
    const offset = (filters.page - 1) * filters.limit;

    try {
        return database.transaction(() => {
            const total = database
                .prepare(`SELECT COUNT(*) AS total FROM Suppliers ${whereClause}`)
                .get(...parameters).total;
            const suppliers = database
                .prepare(
                    `SELECT ${SUPPLIER_COLUMNS}
                     FROM Suppliers
                     ${whereClause}
                     ORDER BY CreatedAt DESC, Id DESC
                     LIMIT ? OFFSET ?`,
                )
                .all(...parameters, filters.limit, offset)
                .map(toSupplier);

            return {
                suppliers,
                pagination: {
                    page: filters.page,
                    limit: filters.limit,
                    total,
                    totalPages: Math.ceil(total / filters.limit),
                },
            };
        })();
    } catch (error) {
        throw databaseError('list', error);
    }
}

export function getSupplierById(id) {
    try {
        const supplier = findSupplierById(id);
        if (!supplier) {
            throw httpError(404, 'Supplier not found.');
        }

        return toSupplier(supplier);
    } catch (error) {
        throwDatabaseOrHttpError('lookup', error);
    }
}

export function createSupplier(input) {
    const supplier = {
        id: randomUUID(),
        ...toSupplierValues(input),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    try {
        return database.transaction(() => {
            database
                .prepare(`
                    INSERT INTO Suppliers (
                        Id, Name, ContactPerson, Email, Phone, Address,
                        CreatedAt, UpdatedAt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `)
                .run(
                    supplier.id,
                    supplier.name,
                    supplier.contactPerson,
                    supplier.email,
                    supplier.phone,
                    supplier.address,
                    supplier.createdAt,
                    supplier.updatedAt,
                );

            return toSupplier(findSupplierById(supplier.id));
        }).immediate();
    } catch (error) {
        throwDatabaseOrHttpError('create', error);
    }
}

export function updateSupplier(id, input) {
    const supplier = toSupplierValues(input);
    const updatedAt = new Date().toISOString();

    try {
        return database.transaction(() => {
            if (!findSupplierById(id)) {
                throw httpError(404, 'Supplier not found.');
            }

            database
                .prepare(`
                    UPDATE Suppliers
                    SET Name = ?, ContactPerson = ?, Email = ?, Phone = ?,
                        Address = ?, UpdatedAt = ?
                    WHERE Id = ?
                `)
                .run(
                    supplier.name,
                    supplier.contactPerson,
                    supplier.email,
                    supplier.phone,
                    supplier.address,
                    updatedAt,
                    id,
                );

            return toSupplier(findSupplierById(id));
        }).immediate();
    } catch (error) {
        throwDatabaseOrHttpError('update', error);
    }
}

export function deleteSupplier(id) {
    try {
        return database.transaction(() => {
            if (!findSupplierById(id)) {
                throw httpError(404, 'Supplier not found.');
            }

            const productExists = database
                .prepare('SELECT 1 FROM Products WHERE SupplierId = ? LIMIT 1')
                .get(id);
            if (productExists) {
                throw httpError(409, 'Supplier is in use by one or more products.');
            }

            database.prepare('DELETE FROM Suppliers WHERE Id = ?').run(id);
        }).immediate();
    } catch (error) {
        throwDatabaseOrHttpError('delete', error);
    }
}
