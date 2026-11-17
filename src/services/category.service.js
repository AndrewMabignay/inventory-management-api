import { randomUUID } from 'node:crypto';
import database from '../config/database.js';

const CATEGORY_COLUMNS = 'Id, Name, Description, CreatedAt, UpdatedAt';

let findCategoryByIdStatement;

function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function databaseError(operation, cause) {
    console.error(`Category database ${operation} failed.`, cause);
    return httpError(500, 'Category service error.');
}

function throwDatabaseOrConflictError(operation, error) {
    if (Number.isInteger(error.status)) {
        throw error;
    }

    throw databaseError(operation, error);
}

function toCategory(category) {
    return {
        id: category.Id,
        name: category.Name,
        description: category.Description,
        createdAt: category.CreatedAt,
        updatedAt: category.UpdatedAt,
    };
}

function findCategoryById(id) {
    if (!findCategoryByIdStatement) {
        findCategoryByIdStatement = database.prepare(`
            SELECT ${CATEGORY_COLUMNS}
            FROM Categories
            WHERE Id = ?
        `);
    }

    return findCategoryByIdStatement.get(id);
}

function categoryNameExists(name, excludedId) {
    if (excludedId) {
        return Boolean(
            database
                .prepare(
                    'SELECT 1 FROM Categories WHERE Name = ? COLLATE NOCASE AND Id <> ?',
                )
                .get(name, excludedId),
        );
    }

    return Boolean(
        database
            .prepare('SELECT 1 FROM Categories WHERE Name = ? COLLATE NOCASE')
            .get(name),
    );
}

export function listCategories(filters) {
    const conditions = [];
    const parameters = [];

    if (filters.search) {
        conditions.push('Name LIKE ? COLLATE NOCASE');
        parameters.push(`%${filters.search}%`);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';
    const offset = (filters.page - 1) * filters.limit;

    try {
        return database.transaction(() => {
            const total = database
                .prepare(`SELECT COUNT(*) AS total FROM Categories ${whereClause}`)
                .get(...parameters).total;
            const categories = database
                .prepare(
                    `SELECT ${CATEGORY_COLUMNS}
                     FROM Categories
                     ${whereClause}
                     ORDER BY CreatedAt DESC, Id DESC
                     LIMIT ? OFFSET ?`,
                )
                .all(...parameters, filters.limit, offset)
                .map(toCategory);

            return {
                categories,
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

export function getCategoryById(id) {
    try {
        const category = findCategoryById(id);
        if (!category) {
            throw httpError(404, 'Category not found.');
        }

        return toCategory(category);
    } catch (error) {
        throwDatabaseOrConflictError('lookup', error);
    }
}

export function createCategory(input) {
    const category = {
        id: randomUUID(),
        name: input.name,
        description: input.description ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    try {
        return database.transaction(() => {
            if (categoryNameExists(category.name)) {
                throw httpError(409, 'A category with this name already exists.');
            }

            database
                .prepare(`
                    INSERT INTO Categories (Id, Name, Description, CreatedAt, UpdatedAt)
                    VALUES (?, ?, ?, ?, ?)
                `)
                .run(
                    category.id,
                    category.name,
                    category.description,
                    category.createdAt,
                    category.updatedAt,
                );

            return toCategory(findCategoryById(category.id));
        }).immediate();
    } catch (error) {
        throwDatabaseOrConflictError('create', error);
    }
}

export function updateCategory(id, input) {
    const updatedAt = new Date().toISOString();

    try {
        return database.transaction(() => {
            if (!findCategoryById(id)) {
                throw httpError(404, 'Category not found.');
            }
            if (categoryNameExists(input.name, id)) {
                throw httpError(409, 'A category with this name already exists.');
            }

            database
                .prepare(`
                    UPDATE Categories
                    SET Name = ?, Description = ?, UpdatedAt = ?
                    WHERE Id = ?
                `)
                .run(input.name, input.description ?? null, updatedAt, id);

            return toCategory(findCategoryById(id));
        }).immediate();
    } catch (error) {
        throwDatabaseOrConflictError('update', error);
    }
}

export function deleteCategory(id) {
    try {
        return database.transaction(() => {
            if (!findCategoryById(id)) {
                throw httpError(404, 'Category not found.');
            }

            const productExists = database
                .prepare('SELECT 1 FROM Products WHERE CategoryId = ? LIMIT 1')
                .get(id);
            if (productExists) {
                throw httpError(409, 'Category is in use by one or more products.');
            }

            database.prepare('DELETE FROM Categories WHERE Id = ?').run(id);
        }).immediate();
    } catch (error) {
        throwDatabaseOrConflictError('delete', error);
    }
}
