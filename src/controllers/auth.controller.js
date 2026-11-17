import * as authService from '../services/auth.service.js';

export async function login(req, res) {
    const result = await authService.login(
        req.validatedBody.email,
        req.validatedBody.password,
    );

    if (!result) {
        return res.status(401).json({ error: 'Invalid email or password.' });
    }

    return res.status(200).json(result);
}

export function getMe(req, res) {
    const user = authService.getCurrentUser(req.auth.userId);

    if (!user) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    return res.status(200).json({ user });
}

export function logout(req, res) {
    authService.revokeToken({
        jti: req.auth.jti,
        userId: req.auth.userId,
        exp: req.auth.exp,
    });

    return res.status(200).json({
        message:
            'Logged out successfully. The access token is revoked; remove it from the client.',
    });
}
