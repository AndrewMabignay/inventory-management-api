import { z } from 'zod';

const loginSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(1),
});

export function validateLogin(req, res, next) {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
        const error = new Error('Invalid login request.');
        error.status = 400;
        return next(error);
    }

    req.validatedBody = result.data;
    return next();
}
