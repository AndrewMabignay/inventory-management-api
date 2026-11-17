import { z } from 'zod';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const paginationFields = {
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
};

const stockLevelsSchema = z.object({
    ...paginationFields,
    search: z.string().trim().max(100).optional(),
    categoryId: z.string().regex(UUID_PATTERN).optional(),
});

const lowStockSchema = z.object(paginationFields);
const recentTransactionsSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(10),
});
const topProductsSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(10),
});

function validateQuery(schema, message) {
    return function validateDashboardQuery(req, res, next) {
        const result = schema.safeParse(req.query);

        if (!result.success) {
            const error = new Error(message);
            error.status = 400;
            return next(error);
        }

        req.validatedQuery = result.data;
        return next();
    };
}

export const validateStockLevels = validateQuery(
    stockLevelsSchema,
    'Invalid stock-level query.',
);

export const validateLowStock = validateQuery(
    lowStockSchema,
    'Invalid low-stock query.',
);

export const validateRecentTransactions = validateQuery(
    recentTransactionsSchema,
    'Invalid recent-transactions query.',
);

export const validateTopProducts = validateQuery(
    topProductsSchema,
    'Invalid top-products query.',
);
