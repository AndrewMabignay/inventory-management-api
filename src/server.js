import 'dotenv/config';
import app from './app.js';
import { initializeSchema } from './config/initialize-schema.js';
import { ensureInitialAdmin } from './database/seed-admin.js';
import { cleanupExpiredRevokedTokens } from './services/auth.service.js';

async function startServer() {
    initializeSchema();
    cleanupExpiredRevokedTokens();
    await ensureInitialAdmin();

    const port = process.env.PORT || 3000;

    app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
    });
}

startServer().catch((error) => {
    console.error('Failed to start server.', error);
    process.exitCode = 1;
});
