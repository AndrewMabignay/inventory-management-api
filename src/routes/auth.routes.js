import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateLogin } from '../validators/auth.validator.js';

const router = Router();

router.post('/login', validateLogin, authController.login);
router.get('/me', authenticateToken, authController.getMe);
router.post('/logout', authenticateToken, authController.logout);

export default router;
