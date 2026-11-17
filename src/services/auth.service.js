import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import database from '../config/database.js';
import { jwtConfig } from '../config/jwt.js';

const USER_ROLES = new Set(['Admin', 'Manager', 'Staff']);

let findUserByEmailStatement;
let findUserByIdStatement;
let findRevokedTokenStatement;
let insertRevokedTokenStatement;
let deleteExpiredRevokedTokensStatement;

function databaseError(operation, cause) {
    console.error(`Authentication database ${operation} failed.`, cause);
    const error = new Error('Authentication service error.', { cause });
    error.status = 500;
    return error;
}

function findUserByEmail(email) {
    if (!findUserByEmailStatement) {
        findUserByEmailStatement = database.prepare(`
      SELECT Id, FirstName, LastName, Email, PasswordHash, Role, IsActive,
             CreatedAt, UpdatedAt
      FROM Users
      WHERE Email = ?
    `);
    }

    return findUserByEmailStatement.get(email);
}

function findUserById(id) {
    if (!findUserByIdStatement) {
        findUserByIdStatement = database.prepare(`
      SELECT Id, FirstName, LastName, Email, Role, IsActive, CreatedAt, UpdatedAt
      FROM Users
      WHERE Id = ?
    `);
    }

    return findUserByIdStatement.get(id);
}

function findRevokedToken(tokenId) {
    if (!findRevokedTokenStatement) {
        findRevokedTokenStatement = database.prepare(
            'SELECT 1 FROM RevokedTokens WHERE TokenId = ?',
        );
    }

    return findRevokedTokenStatement.get(tokenId);
}

function insertRevokedToken(token) {
    if (!insertRevokedTokenStatement) {
        insertRevokedTokenStatement = database.prepare(`
      INSERT INTO RevokedTokens (Id, TokenId, UserId, ExpiresAt, CreatedAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(TokenId) DO NOTHING
    `);
    }

    return insertRevokedTokenStatement.run(
        randomUUID(),
        token.jti,
        token.userId,
        new Date(token.exp * 1000).toISOString(),
        new Date().toISOString(),
    );
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

function createAccessToken(user) {
    return jwt.sign({ role: user.Role, jti: randomUUID() }, jwtConfig.secret, {
        algorithm: 'HS256',
        expiresIn: jwtConfig.expiresIn,
        subject: user.Id,
    });
}

export async function login(email, password) {
    let user;
    try {
        user = findUserByEmail(email);
    } catch (error) {
        throw databaseError('user lookup', error);
    }

    if (!user) {
        return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.PasswordHash);
    if (!passwordMatches || user.IsActive !== 1) {
        return null;
    }

    return {
        accessToken: createAccessToken(user),
        tokenType: 'Bearer',
        expiresIn: jwtConfig.expiresIn,
        user: toSafeUser(user),
    };
}

export function getCurrentUser(id) {
    let user;
    try {
        user = findUserById(id);
    } catch (error) {
        throw databaseError('user lookup', error);
    }

    if (!user || user.IsActive !== 1 || !USER_ROLES.has(user.Role)) {
        return null;
    }

    return toSafeUser(user);
}

export function isTokenRevoked(tokenId) {
    try {
        return Boolean(findRevokedToken(tokenId));
    } catch (error) {
        throw databaseError('revocation lookup', error);
    }
}

export function revokeToken(token) {
    try {
        return insertRevokedToken(token);
    } catch (error) {
        throw databaseError('token revocation', error);
    }
}

export function cleanupExpiredRevokedTokens() {
    try {
        if (!deleteExpiredRevokedTokensStatement) {
            deleteExpiredRevokedTokensStatement = database.prepare(
                'DELETE FROM RevokedTokens WHERE ExpiresAt <= ?',
            );
        }

        return deleteExpiredRevokedTokensStatement.run(new Date().toISOString())
            .changes;
    } catch (error) {
        throw databaseError('expired-token cleanup', error);
    }
}
