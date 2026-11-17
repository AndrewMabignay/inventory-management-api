import { z } from 'zod';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const supplierIdSchema = z.object({
    id: z.string().regex(UUID_PATTERN),
});

const listSuppliersSchema = z.object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(100).optional(),
});

const supplierFields = {
    name: z.string().trim().min(1).max(150),
    contactPerson: z.string().trim().max(150).nullable().optional(),
    email: z
        .string()
        .trim()
        .email()
        .max(254)
        .transform((value) => value.toLowerCase())
        .nullable()
        .optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    address: z.string().trim().max(1000).nullable().optional(),
};

const createSupplierSchema = z.object(supplierFields);
const updateSupplierSchema = z.object(supplierFields);

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

export const validateSupplierId = validate(
    supplierIdSchema,
    'params',
    'validatedParams',
    'Invalid supplier ID.',
);

export const validateListSuppliers = validate(
    listSuppliersSchema,
    'query',
    'validatedQuery',
    'Invalid supplier query.',
);

export const validateCreateSupplier = validate(
    createSupplierSchema,
    'body',
    'validatedBody',
    'Invalid supplier data.',
);

export const validateUpdateSupplier = validate(
    updateSupplierSchema,
    'body',
    'validatedBody',
    'Invalid supplier data.',
);
