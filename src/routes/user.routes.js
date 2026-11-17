import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/authorize-roles.middleware.js';
import {
    validateCreateUser,
    validateListUsers,
    validateUpdateUser,
    validateUpdateUserStatus,
    validateUserId,
} from '../validators/user.validator.js';

const router = Router();
const canReadUsers = authorizeRoles('Admin', 'Manager');
const adminOnly = authorizeRoles('Admin');

router.get(
    '/',
    authenticateToken,
    canReadUsers,
    validateListUsers,
    userController.listUsers,
);
router.get(
    '/:id',
    authenticateToken,
    canReadUsers,
    validateUserId,
    userController.getUserById,
);
router.post(
    '/',
    authenticateToken,
    adminOnly,
    validateCreateUser,
    userController.createUser,
);
router.put(
    '/:id',
    authenticateToken,
    adminOnly,
    validateUserId,
    validateUpdateUser,
    userController.updateUser,
);
router.patch(
    '/:id/status',
    authenticateToken,
    adminOnly,
    validateUserId,
    validateUpdateUserStatus,
    userController.updateUserStatus,
);

export default router;
