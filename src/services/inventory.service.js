import { randomUUID } from 'node:crypto';
import database from '../config/database.js';

const TRANSACTION_SELECT = `
    SELECT
        t.Id,
        t.ProductId,
        p.Name AS ProductName,
        p.SKU AS ProductSKU,
        t.UserId,
        u.FirstName AS UserFirstName,
        u.LastName AS UserLastName,
        u.Role AS UserRole,
        t.Type,
        t.Quantity,
        t.PreviousQuantity,
        t.NewQuantity,
        t.Reason,
        t.ReferenceNumber,
        t.CreatedAt
    FROM InventoryTransactions t
    JOIN Products p ON p.Id = t.ProductId
    JOIN Users u ON u.Id = t.UserId
`;

let findProductForStockStatement;
let updateProductQuantityStatement;
let insertTransactionStatement;
let findTransactionByIdStatement;

function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function databaseError(operation, cause) {
    console.error(`Inventory database ${operation} failed.`, cause);
    return httpError(500, 'Inventory service error.');
}

function throwDatabaseOrBusinessError(operation, error) {
    if (Number.isInteger(error.status)) {
        throw error;
    }

    throw databaseError(operation, error);
}

function findProductForStock(id) {
    if (!findProductForStockStatement) {
        findProductForStockStatement = database.prepare(`
            SELECT Id, Quantity, IsActive
            FROM Products
            WHERE Id = ?
        `);
    }

    return findProductForStockStatement.get(id);
}

function updateProductQuantity(productId, quantity, updatedAt) {
    if (!updateProductQuantityStatement) {
        updateProductQuantityStatement = database.prepare(`
            UPDATE Products
            SET Quantity = ?, UpdatedAt = ?
            WHERE Id = ?
        `);
    }

    return updateProductQuantityStatement.run(quantity, updatedAt, productId);
}

function insertTransaction(transaction) {
    if (!insertTransactionStatement) {
        insertTransactionStatement = database.prepare(`
            INSERT INTO InventoryTransactions (
                Id, ProductId, UserId, Type, Quantity, PreviousQuantity,
                NewQuantity, Reason, ReferenceNumber, CreatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
    }

    return insertTransactionStatement.run(
        transaction.id,
        transaction.productId,
        transaction.userId,
        transaction.type,
        transaction.quantity,
        transaction.previousQuantity,
        transaction.newQuantity,
        transaction.reason,
        transaction.referenceNumber,
        transaction.createdAt,
    );
}

function findTransactionById(id) {
    if (!findTransactionByIdStatement) {
        findTransactionByIdStatement = database.prepare(`
            ${TRANSACTION_SELECT}
            WHERE t.Id = ?
        `);
    }

    return findTransactionByIdStatement.get(id);
}

function toTransaction(transaction) {
    return {
        id: transaction.Id,
        productId: transaction.ProductId,
        product: {
            id: transaction.ProductId,
            name: transaction.ProductName,
            sku: transaction.ProductSKU,
        },
        userId: transaction.UserId,
        user: {
            id: transaction.UserId,
            firstName: transaction.UserFirstName,
            lastName: transaction.UserLastName,
            role: transaction.UserRole,
        },
        type: transaction.Type,
        quantity: transaction.Quantity,
        previousQuantity: transaction.PreviousQuantity,
        newQuantity: transaction.NewQuantity,
        reason: transaction.Reason,
        referenceNumber: transaction.ReferenceNumber,
        createdAt: transaction.CreatedAt,
    };
}

function recordStockChange(input) {
    const transactionId = randomUUID();

    try {
        return database.transaction(() => {
            const product = findProductForStock(input.productId);
            if (!product) {
                throw httpError(404, 'Product not found.');
            }
            if (product.IsActive !== 1) {
                throw httpError(409, 'Cannot change stock for an inactive product.');
            }

            const previousQuantity = product.Quantity;
            let newQuantity;
            let transactionQuantity;

            if (input.type === 'StockIn') {
                newQuantity = previousQuantity + input.quantity;
                transactionQuantity = input.quantity;
                if (!Number.isSafeInteger(newQuantity)) {
                    throw httpError(409, 'Inventory quantity exceeds the supported range.');
                }
            } else if (input.type === 'StockOut') {
                if (input.quantity > previousQuantity) {
                    throw httpError(409, 'Insufficient inventory for this stock-out.');
                }
                newQuantity = previousQuantity - input.quantity;
                transactionQuantity = input.quantity;
            } else {
                newQuantity = input.newQuantity;
                transactionQuantity = Math.abs(newQuantity - previousQuantity);
            }

            const createdAt = new Date().toISOString();
            updateProductQuantity(input.productId, newQuantity, createdAt);
            insertTransaction({
                id: transactionId,
                productId: input.productId,
                userId: input.userId,
                type: input.type,
                quantity: transactionQuantity,
                previousQuantity,
                newQuantity,
                reason: input.reason ?? null,
                referenceNumber: input.referenceNumber ?? null,
                createdAt,
            });

            return toTransaction(findTransactionById(transactionId));
        }).immediate();
    } catch (error) {
        throwDatabaseOrBusinessError('stock change', error);
    }
}

export function listTransactions(filters) {
    const conditions = [];
    const parameters = [];

    if (filters.productId) {
        conditions.push('t.ProductId = ?');
        parameters.push(filters.productId);
    }
    if (filters.type) {
        conditions.push('t.Type = ?');
        parameters.push(filters.type);
    }
    if (filters.startDate) {
        conditions.push('t.CreatedAt >= ?');
        parameters.push(filters.startDate);
    }
    if (filters.endDate) {
        conditions.push('t.CreatedAt <= ?');
        parameters.push(filters.endDate);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';
    const offset = (filters.page - 1) * filters.limit;

    try {
        return database.transaction(() => {
            const total = database
                .prepare(`
                    SELECT COUNT(*) AS total
                    FROM InventoryTransactions t
                    ${whereClause}
                `)
                .get(...parameters).total;
            const transactions = database
                .prepare(`
                    ${TRANSACTION_SELECT}
                    ${whereClause}
                    ORDER BY t.CreatedAt DESC, t.Id DESC
                    LIMIT ? OFFSET ?
                `)
                .all(...parameters, filters.limit, offset)
                .map(toTransaction);

            return {
                transactions,
                pagination: {
                    page: filters.page,
                    limit: filters.limit,
                    total,
                    totalPages: Math.ceil(total / filters.limit),
                },
            };
        })();
    } catch (error) {
        throw databaseError('transaction list', error);
    }
}

export function getTransactionById(id) {
    try {
        const transaction = findTransactionById(id);
        if (!transaction) {
            throw httpError(404, 'Inventory transaction not found.');
        }

        return toTransaction(transaction);
    } catch (error) {
        throwDatabaseOrBusinessError('transaction lookup', error);
    }
}

export function stockIn(input, userId) {
    return recordStockChange({ ...input, type: 'StockIn', userId });
}

export function stockOut(input, userId) {
    return recordStockChange({ ...input, type: 'StockOut', userId });
}

export function adjustStock(input, userId) {
    return recordStockChange({ ...input, type: 'Adjustment', userId });
}
