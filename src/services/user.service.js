import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import database from '../config/database.js';

const SAFE_USER_COLUMNS =
    'Id, FirstName, LastName, Email, Role, IsActive, CreatedAt, UpdatedAt';
const BCRYPT_SALT_ROUNDS = 12;

let findUserByIdStatement;

function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function databaseError(operation, cause) {
    console.error(`User database ${operation} failed.`, cause);
    return httpError(500, 'User service error.');
}

function toSafeUser(user) {
    return {
        id: user.Id,
        firstName: user.FirstName,
        lastName: user.LastName,
        email: user.Email,
        role: user.Role,
        isActive: Boolean(user.IsActive),
        createdAt: user.CreatedAt,
        updatedAt: user.UpdatedAt,
    };
}

function findUserById(id) {
    if (!findUserByIdStatement) {
        findUserByIdStatement = database.prepare(`
            SELECT ${SAFE_USER_COLUMNS}
            FROM Users
            WHERE Id = ?
        `);
    }

    return findUserByIdStatement.get(id);
}

function throwDatabaseOrConflictError(operation, error) {
    if (Number.isInteger(error.status)) {
        throw error;
    }

    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw httpError(409, 'A user with this email already exists.');
    }

    throw databaseError(operation, error);
}

function emailAlreadyExists(email, excludedId) {
    if (excludedId) {
        return Boolean(
            database
                .prepare(
                    'SELECT 1 FROM Users WHERE Email = ? COLLATE NOCASE AND Id <> ?',
                )
                .get(email, excludedId),
        );
    }

    return Boolean(
        database
            .prepare('SELECT 1 FROM Users WHERE Email = ? COLLATE NOCASE')
            .get(email),
    );
}

export function listUsers(filters) {
    const conditions = [];
    const parameters = [];

    if (filters.search) {
        const pattern = `%${filters.search}%`;
        conditions.push(
            '(FirstName LIKE ? COLLATE NOCASE OR LastName LIKE ? COLLATE NOCASE OR Email LIKE ? COLLATE NOCASE)',
        );
        parameters.push(pattern, pattern, pattern);
    }

    if (filters.role) {
        conditions.push('Role = ?');
        parameters.push(filters.role);
    }

    if (filters.isActive !== undefined) {
        conditions.push('IsActive = ?');
        parameters.push(filters.isActive ? 1 : 0);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';
    const offset = (filters.page - 1) * filters.limit;

    try {
        return database.transaction(() => {
            const total = database
                .prepare(`SELECT COUNT(*) AS total FROM Users ${whereClause}`)
                .get(...parameters).total;
            const users = database
                .prepare(
                    `SELECT ${SAFE_USER_COLUMNS}
                     FROM Users
                     ${whereClause}
                     ORDER BY CreatedAt DESC, Id
                     LIMIT ? OFFSET ?`,
                )
                .all(...parameters, filters.limit, offset)
                .map(toSafeUser);

            return {
                users,
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

export function getUserById(id) {
    try {
        const user = findUserById(id);
        if (!user) {
            throw httpError(404, 'User not found.');
        }

        return toSafeUser(user);
    } catch (error) {
        throwDatabaseOrConflictError('lookup', error);
    }
}

export async function createUser(input) {
    let passwordHash;
    try {
        passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
    } catch (error) {
        console.error('User password hashing failed.', error);
        throw httpError(500, 'Unable to create user.');
    }

    const user = {
        id: randomUUID(),
        ...input,
        passwordHash,
        isActive: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    try {
        return database.transaction(() => {
            if (emailAlreadyExists(user.email)) {
                throw httpError(409, 'A user with this email already exists.');
            }

            database
                .prepare(`
                    INSERT INTO Users (
                        Id, FirstName, LastName, Email, PasswordHash, Role,
                        IsActive, CreatedAt, UpdatedAt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `)
                .run(
                    user.id,
                    user.firstName,
                    user.lastName,
                    user.email,
                    user.passwordHash,
                    user.role,
                    user.isActive,
                    user.createdAt,
                    user.updatedAt,
                );

            return toSafeUser(findUserById(user.id));
        }).immediate();
    } catch (error) {
        throwDatabaseOrConflictError('create', error);
    }
}

export function updateUser(id, input) {
    const updatedAt = new Date().toISOString();

    try {
        return database.transaction(() => {
            if (!findUserById(id)) {
                throw httpError(404, 'User not found.');
            }
            if (emailAlreadyExists(input.email, id)) {
                throw httpError(409, 'A user with this email already exists.');
            }

            database
                .prepare(`
                    UPDATE Users
                    SET FirstName = ?, LastName = ?, Email = ?, Role = ?, UpdatedAt = ?
                    WHERE Id = ?
                `)
                .run(
                    input.firstName,
                    input.lastName,
                    input.email,
                    input.role,
                    updatedAt,
                    id,
                );

            return toSafeUser(findUserById(id));
        }).immediate();
    } catch (error) {
        throwDatabaseOrConflictError('update', error);
    }
}

export function updateUserStatus(id, isActive, actorId) {
    if (id === actorId && !isActive) {
        throw httpError(403, 'You cannot deactivate your own account.');
    }

    const updatedAt = new Date().toISOString();
    try {
        return database.transaction(() => {
            if (!findUserById(id)) {
                throw httpError(404, 'User not found.');
            }

            database
                .prepare('UPDATE Users SET IsActive = ?, UpdatedAt = ? WHERE Id = ?')
                .run(isActive ? 1 : 0, updatedAt, id);

            return toSafeUser(findUserById(id));
        }).immediate();
    } catch (error) {
        throwDatabaseOrConflictError('status update', error);
    }
}
