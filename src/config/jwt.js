import { z } from 'zod';

const jwtConfigSchema = z.object({
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().regex(/^\d+(?:\.\d+)?\s*(?:ms|s|m|h|d|w|y)$/),
});

const result = jwtConfigSchema.safeParse({
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
});

if (!result.success) {
    const issues = result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');

    throw new Error(`Invalid JWT environment configuration: ${issues}`);
}

export const jwtConfig = Object.freeze({
    secret: result.data.JWT_SECRET,
    expiresIn: result.data.JWT_EXPIRES_IN,
});
