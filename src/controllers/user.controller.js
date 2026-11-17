import * as userService from '../services/user.service.js';

export function listUsers(req, res) {
    return res.status(200).json(userService.listUsers(req.validatedQuery));
}

export function getUserById(req, res) {
    const user = userService.getUserById(req.validatedParams.id);
    return res.status(200).json({ user });
}

export async function createUser(req, res) {
    const user = await userService.createUser(req.validatedBody);
    return res.status(201).json({ user });
}

export function updateUser(req, res) {
    const user = userService.updateUser(
        req.validatedParams.id,
        req.validatedBody,
    );
    return res.status(200).json({ user });
}

export function updateUserStatus(req, res) {
    const user = userService.updateUserStatus(
        req.validatedParams.id,
        req.validatedBody.isActive,
        req.auth.userId,
    );
    return res.status(200).json({ user });
}
