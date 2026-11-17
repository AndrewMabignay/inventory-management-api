import { randomUUID } from 'node:crypto';
import database from '../config/database.js';

const PRODUCT_SELECT = `
    SELECT
        p.Id,
        p.CategoryId,
        c.Name AS CategoryName,
        p.SupplierId,
        s.Name AS SupplierName,
        p.SKU,
        p.Name,
        p.Description,
        p.CostPrice,
        p.SellingPrice,
        p.Quantity,
        p.ReorderLevel,
        p.IsActive,
        p.CreatedAt,
        p.UpdatedAt
    FROM Products p
    JOIN Categories c ON c.Id = p.CategoryId
    JOIN Suppliers s ON s.Id = p.SupplierId
`;

let findProductByIdStatement;

function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function databaseError(operation, cause) {
    console.error(`Product database ${operation} failed.`, cause);
    return httpError(500, 'Product service error.');
}

function throwDatabaseOrProductError(operation, error) {
    if (Number.isInteger(error.status)) {
        throw error;
    }

    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw httpError(409, 'A product with this SKU already exists.');
    }

    throw databaseError(operation, error);
}

function toProduct(product) {
    return {
        id: product.Id,
        categoryId: product.CategoryId,
        categoryName: product.CategoryName,
        supplierId: product.SupplierId,
        supplierName: product.SupplierName,
        sku: product.SKU,
        name: product.Name,
        description: product.Description,
        costPrice: product.CostPrice,
        sellingPrice: product.SellingPrice,
        quantity: product.Quantity,
        reorderLevel: product.ReorderLevel,
        isActive: Boolean(product.IsActive),
        createdAt: product.CreatedAt,
        updatedAt: product.UpdatedAt,
    };
}

function findProductById(id) {
    if (!findProductByIdStatement) {
        findProductByIdStatement = database.prepare(`
            ${PRODUCT_SELECT}
            WHERE p.Id = ?
        `);
    }

    return findProductByIdStatement.get(id);
}

function verifyReferences(categoryId, supplierId) {
    const categoryExists = database
        .prepare('SELECT 1 FROM Categories WHERE Id = ?')
        .get(categoryId);
    if (!categoryExists) {
        throw httpError(400, 'Category does not exist.');
    }

    const supplierExists = database
        .prepare('SELECT 1 FROM Suppliers WHERE Id = ?')
        .get(supplierId);
    if (!supplierExists) {
        throw httpError(400, 'Supplier does not exist.');
    }
}

function skuAlreadyExists(sku, excludedId) {
    if (excludedId) {
        return Boolean(
            database
                .prepare('SELECT 1 FROM Products WHERE SKU = ? COLLATE NOCASE AND Id <> ?')
                .get(sku, excludedId),
        );
    }

    return Boolean(
        database
            .prepare('SELECT 1 FROM Products WHERE SKU = ? COLLATE NOCASE')
            .get(sku),
    );
}

export function listProducts(filters) {
    const conditions = [];
    const parameters = [];

    if (filters.search) {
        const pattern = `%${filters.search}%`;
        conditions.push('(p.Name LIKE ? COLLATE NOCASE OR p.SKU LIKE ? COLLATE NOCASE)');
        parameters.push(pattern, pattern);
    }

    if (filters.categoryId) {
        conditions.push('p.CategoryId = ?');
        parameters.push(filters.categoryId);
    }

    if (filters.supplierId) {
        conditions.push('p.SupplierId = ?');
        parameters.push(filters.supplierId);
    }

    if (filters.isActive !== undefined) {
        conditions.push('p.IsActive = ?');
        parameters.push(filters.isActive ? 1 : 0);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';
    const offset = (filters.page - 1) * filters.limit;

    try {
        return database.transaction(() => {
            const total = database
                .prepare(`SELECT COUNT(*) AS total FROM Products p ${whereClause}`)
                .get(...parameters).total;
            const products = database
                .prepare(
                    `${PRODUCT_SELECT}
                     ${whereClause}
                     ORDER BY p.CreatedAt DESC, p.Id DESC
                     LIMIT ? OFFSET ?`,
                )
                .all(...parameters, filters.limit, offset)
                .map(toProduct);

            return {
                products,
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

export function getProductById(id) {
    try {
        const product = findProductById(id);
        if (!product) {
            throw httpError(404, 'Product not found.');
        }

        return toProduct(product);
    } catch (error) {
        throwDatabaseOrProductError('lookup', error);
    }
}

export function createProduct(input) {
    const product = {
        id: randomUUID(),
        ...input,
        description: input.description ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    try {
        return database.transaction(() => {
            verifyReferences(product.categoryId, product.supplierId);
            if (skuAlreadyExists(product.sku)) {
                throw httpError(409, 'A product with this SKU already exists.');
            }

            database
                .prepare(`
                    INSERT INTO Products (
                        Id, CategoryId, SupplierId, SKU, Name, Description,
                        CostPrice, SellingPrice, ReorderLevel, CreatedAt, UpdatedAt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `)
                .run(
                    product.id,
                    product.categoryId,
                    product.supplierId,
                    product.sku,
                    product.name,
                    product.description,
                    product.costPrice,
                    product.sellingPrice,
                    product.reorderLevel ?? 10,
                    product.createdAt,
                    product.updatedAt,
                );

            return toProduct(findProductById(product.id));
        }).immediate();
    } catch (error) {
        throwDatabaseOrProductError('create', error);
    }
}

export function updateProduct(id, input) {
    const updatedAt = new Date().toISOString();

    try {
        return database.transaction(() => {
            const existingProduct = findProductById(id);
            if (!existingProduct) {
                throw httpError(404, 'Product not found.');
            }

            verifyReferences(input.categoryId, input.supplierId);
            if (skuAlreadyExists(input.sku, id)) {
                throw httpError(409, 'A product with this SKU already exists.');
            }

            database
                .prepare(`
                    UPDATE Products
                    SET CategoryId = ?, SupplierId = ?, SKU = ?, Name = ?,
                        Description = ?, CostPrice = ?, SellingPrice = ?,
                        ReorderLevel = ?, UpdatedAt = ?
                    WHERE Id = ?
                `)
                .run(
                    input.categoryId,
                    input.supplierId,
                    input.sku,
                    input.name,
                    input.description ?? null,
                    input.costPrice,
                    input.sellingPrice,
                    input.reorderLevel ?? existingProduct.ReorderLevel,
                    updatedAt,
                    id,
                );

            return toProduct(findProductById(id));
        }).immediate();
    } catch (error) {
        throwDatabaseOrProductError('update', error);
    }
}

export function updateProductStatus(id, isActive) {
    const updatedAt = new Date().toISOString();

    try {
        return database.transaction(() => {
            if (!findProductById(id)) {
                throw httpError(404, 'Product not found.');
            }

            database
                .prepare('UPDATE Products SET IsActive = ?, UpdatedAt = ? WHERE Id = ?')
                .run(isActive ? 1 : 0, updatedAt, id);

            return toProduct(findProductById(id));
        }).immediate();
    } catch (error) {
        throwDatabaseOrProductError('status update', error);
    }
}
