import { z } from 'zod';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRANSACTION_TYPES = ['StockIn', 'StockOut', 'Adjustment'];

const transactionIdSchema = z.object({
    id: z.string().regex(UUID_PATTERN),
});

const listTransactionsSchema = z
    .object({
        page: z.coerce.number().int().min(1).max(1_000_000).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(10),
        productId: z.string().regex(UUID_PATTERN).optional(),
        type: z.enum(TRANSACTION_TYPES).optional(),
        startDate: z
            .string()
            .datetime({ offset: true })
            .transform((value) => new Date(value).toISOString())
            .optional(),
        endDate: z
            .string()
            .datetime({ offset: true })
            .transform((value) => new Date(value).toISOString())
            .optional(),
    })
    .refine(
        (filters) =>
            !filters.startDate ||
            !filters.endDate ||
            filters.startDate <= filters.endDate,
        {
            message: 'endDate must not be earlier than startDate.',
            path: ['endDate'],
        },
    );

const positiveQuantity = z.number().int().positive();
const optionalReason = z.string().trim().max(500).nullable().optional();

const stockInSchema = z.object({
    productId: z.string().regex(UUID_PATTERN),
    quantity: positiveQuantity,
    reason: optionalReason,
    referenceNumber: z.string().trim().max(100).nullable().optional(),
}).strict();

const stockOutSchema = z.object({
    productId: z.string().regex(UUID_PATTERN),
    quantity: positiveQuantity,
    reason: optionalReason,
}).strict();

const adjustmentSchema = z.object({
    productId: z.string().regex(UUID_PATTERN),
    newQuantity: z.number().int().nonnegative(),
    reason: z.string().trim().min(1).max(500),
}).strict();

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

export const validateTransactionId = validate(
    transactionIdSchema,
    'params',
    'validatedParams',
    'Invalid transaction ID.',
);

export const validateListTransactions = validate(
    listTransactionsSchema,
    'query',
    'validatedQuery',
    'Invalid transaction query.',
);

export const validateStockIn = validate(
    stockInSchema,
    'body',
    'validatedBody',
    'Invalid stock-in request.',
);

export const validateStockOut = validate(
    stockOutSchema,
    'body',
    'validatedBody',
    'Invalid stock-out request.',
);

export const validateAdjustment = validate(
    adjustmentSchema,
    'body',
    'validatedBody',
    'Invalid inventory adjustment.',
);
