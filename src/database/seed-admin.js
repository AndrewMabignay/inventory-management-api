import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import database from '../config/database.js';

const BCRYPT_SALT_ROUNDS = 12;

const initialAdminConfigSchema = z.object({
    ADMIN_FIRST_NAME: z.string().trim().min(1),
    ADMIN_LAST_NAME: z.string().trim().min(1),
    ADMIN_EMAIL: z.string().trim().email(),
    ADMIN_PASSWORD: z.string().min(1),
});

function getInitialAdminConfig() {
    const result = initialAdminConfigSchema.safeParse({
        ADMIN_FIRST_NAME: process.env.ADMIN_FIRST_NAME,
        ADMIN_LAST_NAME: process.env.ADMIN_LAST_NAME,
        ADMIN_EMAIL: process.env.ADMIN_EMAIL,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    });

    if (!result.success) {
        const issues = result.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');

        throw new Error(
            `Invalid initial Admin environment configuration: ${issues}`,
        );
    }

    return {
        firstName: result.data.ADMIN_FIRST_NAME,
        lastName: result.data.ADMIN_LAST_NAME,
        email: result.data.ADMIN_EMAIL,
        password: result.data.ADMIN_PASSWORD,
    };
}

export async function ensureInitialAdmin() {
    const findAdmin = database.prepare(
        'SELECT 1 FROM Users WHERE Role = ? LIMIT 1',
    );

    if (findAdmin.get('Admin')) {
        return false;
    }

    const config = getInitialAdminConfig();
    const passwordHash = await bcrypt.hash(config.password, BCRYPT_SALT_ROUNDS);
    const timestamp = new Date().toISOString();
    const insertAdmin = database.prepare(`
    INSERT INTO Users (
      Id,
      FirstName,
      LastName,
      Email,
      PasswordHash,
      Role,
      IsActive,
      CreatedAt,
      UpdatedAt
    ) VALUES (?, ?, ?, ?, ?, 'Admin', 1, ?, ?)
  `);
    const createAdminTransaction = database.transaction((admin) => {
        if (findAdmin.get('Admin')) {
            return false;
        }

        insertAdmin.run(
            admin.id,
            admin.firstName,
            admin.lastName,
            admin.email,
            admin.passwordHash,
            admin.createdAt,
            admin.updatedAt,
        );

        return true;
    });

    try {
        return createAdminTransaction.immediate({
            id: randomUUID(),
            firstName: config.firstName,
            lastName: config.lastName,
            email: config.email,
            passwordHash,
            createdAt: timestamp,
            updatedAt: timestamp,
        });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            throw new Error(
                'Cannot create the initial Admin: ADMIN_EMAIL is already assigned to an existing account.',
                { cause: error },
            );
        }

        throw new Error('Failed to create the initial Admin account.', {
            cause: error,
        });
    }
}
