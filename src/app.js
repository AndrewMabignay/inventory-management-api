import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    const status =
        Number.isInteger(err.status) && err.status >= 400 && err.status < 600
            ? err.status
            : 500;
    const message =
        status === 500 && process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message || 'Internal server error';

    res.status(status).json({ error: message });
});

export default app;
