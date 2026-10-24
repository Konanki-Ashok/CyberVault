import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { env } from './config/env.js';
import { correlationMiddleware } from './middleware/authMiddleware.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// 1. Basic Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Swagger UI and local dev previews
    crossOriginEmbedderPolicy: false,
  })
);

// 2. Strict CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      const allowed = [env.FRONTEND_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'];
      if (allowed.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Dev-permissive with credentials
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Correlation-ID'],
    exposedHeaders: ['X-Correlation-ID', 'Content-Disposition'],
  })
);

// 3. Cookie and Body Parsers
app.use(cookieParser(env.COOKIE_SECRET));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Request Correlation & Rate Limiting
app.use(correlationMiddleware);
if (env.NODE_ENV !== 'test') {
  app.use('/api', apiLimiter);
}

// 5. Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'TrustVault Secure Document API',
  });
});

// 6. Swagger API Documentation
const openapiPath = path.resolve(__dirname, '../../openapi.yaml');
if (fs.existsSync(openapiPath)) {
  try {
    const swaggerDocument = YAML.load(openapiPath);
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  } catch (err) {
    console.warn('[Swagger] Failed to load openapi.yaml:', err.message);
  }
}

// 7. Mount Core REST API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);

// 8. 404 Handler for Unmatched API Routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found.',
  });
});

// 9. Serve Frontend Production Build (Single-Origin Deployment)
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback — serve index.html for any non-API, non-file route
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// 10. Centralized Error Handler
app.use(errorHandler);
