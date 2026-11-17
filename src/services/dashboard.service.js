import database from '../config/database.js';

function databaseError(operation, cause) {
    console.error(`Dashboard database ${operation} failed.`, cause);
    const error = new Error('Dashboard service error.');
    error.status = 500;
    return error;
}

function toStockLevel(product) {
    return {
        id: product.Id,
        name: product.Name,
        sku: product.SKU,
        categoryName: product.CategoryName,
        quantity: product.Quantity,
        reorderLevel: product.ReorderLevel,
    };
}

function toLowStockProduct(product) {
    return {
        id: product.Id,
        name: product.Name,
        sku: product.SKU,
        quantity: product.Quantity,
        reorderLevel: product.ReorderLevel,
    };
}

function toRecentTransaction(transaction) {
    return {
        id: transaction.Id,
        product: {
            id: transaction.ProductId,
            name: transaction.ProductName,
            sku: transaction.ProductSKU,
        },
        type: transaction.Type,
        quantity: transaction.Quantity,
        user: {
            id: transaction.UserId,
            name: transaction.UserName,
        },
        createdAt: transaction.CreatedAt,
    };
}

export function getSummary() {
    try {
        const summary = database.prepare(`
            SELECT
                (SELECT COUNT(*) FROM Products) AS TotalProducts,
                (SELECT COUNT(*) FROM Products WHERE IsActive = 1) AS ActiveProducts,
                (SELECT COUNT(*) FROM Products WHERE IsActive = 0) AS InactiveProducts,
                (SELECT COUNT(*) FROM Categories) AS TotalCategories,
                (SELECT COUNT(*) FROM Suppliers) AS TotalSuppliers,
                (SELECT COALESCE(SUM(Quantity), 0) FROM Products) AS TotalInventoryQuantity,
                (
                    SELECT COUNT(*)
                    FROM Products
                    WHERE Quantity <= ReorderLevel
                ) AS LowStockProductCount
        `).get();

        return {
            totalProducts: summary.TotalProducts,
            activeProducts: summary.ActiveProducts,
            inactiveProducts: summary.InactiveProducts,
            totalCategories: summary.TotalCategories,
            totalSuppliers: summary.TotalSuppliers,
            totalInventoryQuantity: summary.TotalInventoryQuantity,
            lowStockProductCount: summary.LowStockProductCount,
        };
    } catch (error) {
        throw databaseError('summary query', error);
    }
}

export function listStockLevels(filters) {
    const conditions = [];
    const parameters = [];

    if (filters.search) {
        const pattern = `%${filters.search}%`;
        conditions.push(
            '(p.Name LIKE ? COLLATE NOCASE OR p.SKU LIKE ? COLLATE NOCASE)',
        );
        parameters.push(pattern, pattern);
    }

    if (filters.categoryId) {
        conditions.push('p.CategoryId = ?');
        parameters.push(filters.categoryId);
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
                    FROM Products p
                    ${whereClause}
                `)
                .get(...parameters).total;
            const products = database
                .prepare(`
                    SELECT
                        p.Id,
                        p.Name,
                        p.SKU,
                        c.Name AS CategoryName,
                        p.Quantity,
                        p.ReorderLevel
                    FROM Products p
                    JOIN Categories c ON c.Id = p.CategoryId
                    ${whereClause}
                    ORDER BY p.Name COLLATE NOCASE, p.Id
                    LIMIT ? OFFSET ?
                `)
                .all(...parameters, filters.limit, offset)
                .map(toStockLevel);

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
        throw databaseError('stock-level query', error);
    }
}

export function listLowStock(filters) {
    const offset = (filters.page - 1) * filters.limit;

    try {
        return database.transaction(() => {
            const total = database
                .prepare(`
                    SELECT COUNT(*) AS total
                    FROM Products
                    WHERE Quantity <= ReorderLevel
                `)
                .get().total;
            const products = database
                .prepare(`
                    SELECT Id, Name, SKU, Quantity, ReorderLevel
                    FROM Products
                    WHERE Quantity <= ReorderLevel
                    ORDER BY Quantity ASC, Name COLLATE NOCASE, Id
                    LIMIT ? OFFSET ?
                `)
                .all(filters.limit, offset)
                .map(toLowStockProduct);

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
        throw databaseError('low-stock query', error);
    }
}

export function listRecentTransactions({ limit }) {
    try {
        const transactions = database
            .prepare(`
                SELECT
                    t.Id,
                    t.ProductId,
                    p.Name AS ProductName,
                    p.SKU AS ProductSKU,
                    t.Type,
                    t.Quantity,
                    t.UserId,
                    u.FirstName || ' ' || u.LastName AS UserName,
                    t.CreatedAt
                FROM InventoryTransactions t
                JOIN Products p ON p.Id = t.ProductId
                JOIN Users u ON u.Id = t.UserId
                ORDER BY t.CreatedAt DESC, t.Id DESC
                LIMIT ?
            `)
            .all(limit)
            .map(toRecentTransaction);

        return { transactions };
    } catch (error) {
        throw databaseError('recent-transactions query', error);
    }
}

export function listTopProducts({ limit }) {
    try {
        const products = database
            .prepare(`
                SELECT
                    p.Id,
                    p.Name,
                    p.SKU,
                    SUM(t.Quantity) AS TotalQuantityMoved,
                    COUNT(t.Id) AS TransactionCount
                FROM InventoryTransactions t
                JOIN Products p ON p.Id = t.ProductId
                GROUP BY p.Id, p.Name, p.SKU
                ORDER BY TotalQuantityMoved DESC, p.Name COLLATE NOCASE, p.Id
                LIMIT ?
            `)
            .all(limit)
            .map((product) => ({
                id: product.Id,
                name: product.Name,
                sku: product.SKU,
                totalQuantityMoved: product.TotalQuantityMoved,
                transactionCount: product.TransactionCount,
            }));

        return {
            rankingMetric:
                'Sum of transaction quantities across StockIn, StockOut, and Adjustment records; adjustment quantity is the absolute stock difference.',
            products,
        };
    } catch (error) {
        throw databaseError('top-products query', error);
    }
}

export function getInventoryValue() {
    try {
        const values = database.prepare(`
            SELECT
                COALESCE(SUM(Quantity * CostPrice), 0) AS TotalCostValue,
                COALESCE(SUM(Quantity * SellingPrice), 0) AS TotalPotentialSellingValue
            FROM Products
        `).get();

        return {
            totalCostValue: values.TotalCostValue,
            totalPotentialSellingValue: values.TotalPotentialSellingValue,
        };
    } catch (error) {
        throw databaseError('inventory-value query', error);
    }
}
