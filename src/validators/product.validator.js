import { z } from 'zod';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const productIdSchema = z.object({
    id: z.string().regex(UUID_PATTERN),
});

const listProductsSchema = z.object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(100).optional(),
    categoryId: z.string().regex(UUID_PATTERN).optional(),
    supplierId: z.string().regex(UUID_PATTERN).optional(),
    isActive: z
        .enum(['true', 'false'])
        .transform((value) => value === 'true')
        .optional(),
});

const productFields = {
    categoryId: z.string().regex(UUID_PATTERN),
    supplierId: z.string().regex(UUID_PATTERN),
    sku: z.string().trim().min(1).max(64).transform((value) => value.toUpperCase()),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).nullable().optional(),
    costPrice: z.number().finite().min(0),
    sellingPrice: z.number().finite().min(0),
    reorderLevel: z.number().int().min(0).optional(),
};

function productSchema(fields) {
    return z.object(fields).strict().refine(
        (product) => product.sellingPrice >= product.costPrice,
        {
            message: 'Selling price must not be lower than cost price.',
            path: ['sellingPrice'],
        },
    );
}

const createProductSchema = productSchema(productFields);
const updateProductSchema = productSchema(productFields);

const updateProductStatusSchema = z.object({
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

export const validateProductId = validate(
    productIdSchema,
    'params',
    'validatedParams',
    'Invalid product ID.',
);

export const validateListProducts = validate(
    listProductsSchema,
    'query',
    'validatedQuery',
    'Invalid product query.',
);

export const validateCreateProduct = validate(
    createProductSchema,
    'body',
    'validatedBody',
    'Invalid product data.',
);

export const validateUpdateProduct = validate(
    updateProductSchema,
    'body',
    'validatedBody',
    'Invalid product data.',
);

export const validateUpdateProductStatus = validate(
    updateProductStatusSchema,
    'body',
    'validatedBody',
    'Invalid product status.',
);
