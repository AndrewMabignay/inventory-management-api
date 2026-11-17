import database from './database.js';

const schema = `
    CREATE TABLE IF NOT EXISTS Categories (
        Id TEXT PRIMARY KEY NOT NULL,
        Name TEXT NOT NULL,
        Description TEXT,
        CreatedAt TEXT NOT NULL,
        UpdatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Suppliers (
        Id TEXT PRIMARY KEY NOT NULL,
        Name TEXT NOT NULL,
        ContactPerson TEXT,
        Email TEXT,
        Phone TEXT,
        Address TEXT,
        CreatedAt TEXT NOT NULL,
        UpdatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Users (
        Id TEXT PRIMARY KEY NOT NULL,
        FirstName TEXT NOT NULL,
        LastName TEXT NOT NULL,
        Email TEXT NOT NULL,
        PasswordHash TEXT NOT NULL,
        Role TEXT NOT NULL CHECK (Role IN ('Admin', 'Manager', 'Staff')),
        IsActive INTEGER NOT NULL DEFAULT 1
        CHECK (typeof(IsActive) = 'integer' AND IsActive IN (0, 1)),
        CreatedAt TEXT NOT NULL,
        UpdatedAt TEXT NOT NULL,
        CONSTRAINT UQ_Users_Email UNIQUE (Email)
    );

    CREATE TABLE IF NOT EXISTS RevokedTokens (
        Id TEXT PRIMARY KEY NOT NULL,
        TokenId TEXT NOT NULL UNIQUE,
        UserId TEXT NOT NULL REFERENCES Users(Id) ON DELETE CASCADE,
        ExpiresAt TEXT NOT NULL,
        CreatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Products (
        Id TEXT PRIMARY KEY NOT NULL,
        CategoryId TEXT NOT NULL REFERENCES Categories(Id),
        SupplierId TEXT NOT NULL REFERENCES Suppliers(Id),
        SKU TEXT NOT NULL UNIQUE,
        Name TEXT NOT NULL,
        Description TEXT,
        CostPrice REAL NOT NULL CHECK (CostPrice >= 0),
        SellingPrice REAL NOT NULL CHECK (SellingPrice >= 0),
        Quantity INTEGER NOT NULL DEFAULT 0
        CHECK (typeof(Quantity) = 'integer' AND Quantity >= 0),
        ReorderLevel INTEGER NOT NULL DEFAULT 10
        CHECK (typeof(ReorderLevel) = 'integer' AND ReorderLevel >= 0),
        IsActive INTEGER NOT NULL DEFAULT 1
        CHECK (typeof(IsActive) = 'integer' AND IsActive IN (0, 1)),
        CreatedAt TEXT NOT NULL,
        UpdatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS InventoryTransactions (
        Id TEXT PRIMARY KEY NOT NULL,
        ProductId TEXT NOT NULL REFERENCES Products(Id),
        UserId TEXT NOT NULL REFERENCES Users(Id),
        Type TEXT NOT NULL CHECK (Type IN ('StockIn', 'StockOut', 'Adjustment')),
        Quantity INTEGER NOT NULL CHECK (
            typeof(Quantity) = 'integer' AND
            Quantity >= 0 AND
            (Type = 'Adjustment' OR Quantity > 0)
        ),
        PreviousQuantity INTEGER NOT NULL
            CHECK (typeof(PreviousQuantity) = 'integer' AND PreviousQuantity >= 0),
        NewQuantity INTEGER NOT NULL
            CHECK (typeof(NewQuantity) = 'integer' AND NewQuantity >= 0),
        Reason TEXT,
        ReferenceNumber TEXT,
        CreatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_categories_name ON Categories(Name);
    CREATE INDEX IF NOT EXISTS idx_suppliers_name ON Suppliers(Name);
    CREATE INDEX IF NOT EXISTS idx_users_email ON Users(Email);
    CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user_id ON RevokedTokens(UserId);
    CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON RevokedTokens(ExpiresAt);
    CREATE INDEX IF NOT EXISTS idx_products_category_id ON Products(CategoryId);
    CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON Products(SupplierId);
    CREATE INDEX IF NOT EXISTS idx_products_name ON Products(Name);
    CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product_created
        ON InventoryTransactions(ProductId, CreatedAt);
    CREATE INDEX IF NOT EXISTS idx_inventory_transactions_user_id
        ON InventoryTransactions(UserId);
    CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type_created
        ON InventoryTransactions(Type, CreatedAt);
`;

export function initializeSchema() {
    try {
        database.transaction(() => {
            database.exec(schema);

            const productColumns = database.pragma("table_info('Products')");
            if (!productColumns.some((column) => column.name === 'IsActive')) {
                database.exec(`
                    ALTER TABLE Products
                    ADD COLUMN IsActive INTEGER NOT NULL DEFAULT 1
                    CHECK (typeof(IsActive) = 'integer' AND IsActive IN (0, 1))
                `);
            }

            database.exec(
                'CREATE INDEX IF NOT EXISTS idx_products_is_active ON Products(IsActive)',
            );
        })();
    } catch (error) {
        throw new Error('Failed to initialize the database schema.', {
            cause: error,
        });
    }
}
