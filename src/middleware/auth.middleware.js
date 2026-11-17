import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import * as authService from '../services/auth.service.js';

const USER_ROLES = new Set(['Admin', 'Manager', 'Staff']);
const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unauthorizedError() {
    const error = new Error('Missing or invalid access token.');
    error.status = 401;
    return error;
}

export function authenticateToken(req, res, next) {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
        return next(unauthorizedError());
    }

    let claims;
    try {
        claims = jwt.verify(match[1], jwtConfig.secret, {
            algorithms: ['HS256'],
        });
    } catch {
        return next(unauthorizedError());
    }

    if (
        typeof claims !== 'object' ||
        typeof claims.sub !== 'string' ||
        !UUID_PATTERN.test(claims.sub) ||
        typeof claims.jti !== 'string' ||
        !UUID_PATTERN.test(claims.jti) ||
        !Number.isInteger(claims.exp) ||
        claims.exp <= Math.floor(Date.now() / 1000) ||
        !USER_ROLES.has(claims.role)
    ) {
        return next(unauthorizedError());
    }

    if (authService.isTokenRevoked(claims.jti)) {
        return next(unauthorizedError());
    }

    const user = authService.getCurrentUser(claims.sub);
    if (!user || user.role !== claims.role) {
        return next(unauthorizedError());
    }

    req.auth = {
        userId: user.id,
        role: user.role,
        jti: claims.jti,
        exp: claims.exp,
    };

    return next();
}
