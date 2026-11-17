export function authorizeRoles(...allowedRoles) {
    const roleSet = new Set(allowedRoles);

    return function requireAuthorizedRole(req, res, next) {
        if (!req.auth || !roleSet.has(req.auth.role)) {
            const error = new Error('You do not have permission to perform this action.');
            error.status = 403;
            return next(error);
        }

        return next();
    };
}
