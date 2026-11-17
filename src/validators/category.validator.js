import { z } from 'zod';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const categoryIdSchema = z.object({
    id: z.string().regex(UUID_PATTERN),
});

const listCategoriesSchema = z.object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(100).optional(),
});

const categoryFields = {
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(1000).nullable().optional(),
};

const createCategorySchema = z.object(categoryFields);
const updateCategorySchema = z.object(categoryFields);

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

export const validateCategoryId = validate(
    categoryIdSchema,
    'params',
    'validatedParams',
    'Invalid category ID.',
);

export const validateListCategories = validate(
    listCategoriesSchema,
    'query',
    'validatedQuery',
    'Invalid category query.',
);

export const validateCreateCategory = validate(
    createCategorySchema,
    'body',
    'validatedBody',
    'Invalid category data.',
);

export const validateUpdateCategory = validate(
    updateCategorySchema,
    'body',
    'validatedBody',
    'Invalid category data.',
);
