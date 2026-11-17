import { z } from 'zod';

const USER_ROLES = ['Admin', 'Manager', 'Staff'];
const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const userIdSchema = z.object({
    id: z.string().regex(UUID_PATTERN),
});

const listUsersSchema = z.object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(100).optional(),
    role: z.enum(USER_ROLES).optional(),
    isActive: z
        .enum(['true', 'false'])
        .transform((value) => value === 'true')
        .optional(),
});

const userFields = {
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(254),
};

const createUserSchema = z.object({
    ...userFields,
    password: z
        .string()
        .min(1)
        .refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
    role: z.enum(USER_ROLES),
});

const updateUserSchema = z.object({
    ...userFields,
    role: z.enum(USER_ROLES),
});

const updateUserStatusSchema = z.object({
    isActive: z.boolean(),
});

function validate(schema, source, target, message) {
    return function validateRequest(req, res, next) {
        const result = schema.safeParse(req[source]);

        if (!result.success) {
            const error = new Error(message);
            error.status = 400;
            return next(error);
        }

        req[target] = result.data;
        return next();
    };
}

export const validateUserId = validate(
    userIdSchema,
    'params',
    'validatedParams',
    'Invalid user ID.',
);

export const validateListUsers = validate(
    listUsersSchema,
    'query',
    'validatedQuery',
    'Invalid user query.',
);

export const validateCreateUser = validate(
    createUserSchema,
    'body',
    'validatedBody',
    'Invalid user data.',
);

export const validateUpdateUser = validate(
    updateUserSchema,
    'body',
    'validatedBody',
    'Invalid user data.',
);

export const validateUpdateUserStatus = validate(
    updateUserStatusSchema,
    'body',
    'validatedBody',
    'Invalid user status.',
);
