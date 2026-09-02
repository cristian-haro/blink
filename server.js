require('dotenv').config();
const express = require('express');
const Redis = require('ioredis');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const path = require('path');
const helmet = require('helmet');

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
        return Math.min(times * 1000, 5000);
    }
});

redis.on('connect', () => {
    console.log('Connected to Redis');
});

let lastWarned = 0;
redis.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
        const now = Date.now();
        if (now - lastWarned > 10000) {
            console.warn(`[Redis] No se puede conectar a Redis en ${process.env.REDIS_URL || 'localhost:6379'} (ECONNREFUSED). Asegúrate de que Redis o Docker Desktop esté iniciado.`);
            lastWarned = now;
        }
    } else {
        console.error('Redis error:', err.message);
    }
});

app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(cors());
app.use(bodyParser.json({ limit: process.env.MAX_BODY_SIZE || '50mb' }));
app.use(express.static('public'));

app.get('/view', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'view.html'));
});

// Rate Limiter: Aumentado para pruebas
const createStartLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.post('/api/store', createStartLimiter, async (req, res) => {
    // console.log(`[API] Solicitud POST /api/store desde IP: ${req.ip}`);
    try {
        const { encryptedData, iv, ttl, maxUses, encryptedFile, fileName, fileType, salt, authType } = req.body;

        if (!encryptedData || !iv) {
            console.error('[API] Error: Faltan datos en la solicitud');
            return res.status(400).json({ error: 'Faltan datos' });
        }

        const ttlInt = parseInt(ttl);
        const maxUsesInt = parseInt(maxUses);

        if (isNaN(ttlInt) || ttlInt < 60 || ttlInt > 604800) {
            return res.status(400).json({ error: 'TTL inválido' });
        }

        const id = uuidv4();
        const key = `msg:${id}`;

        const data = {
            encryptedData,
            iv,
            maxUses: maxUsesInt || 1,
            views: 0,
            encryptedFile,
            fileName,
            fileType,
            salt,
            authType: authType || 'link'
        };

        const ttlSeconds = ttlInt || 3600;
        await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);

        // console.log(`[API] Secreto guardado con ID: ${id}`);
        res.json({ id });
    } catch (error) {
        console.error('[API] Error al guardar mensaje:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

app.get('/api/retrieve/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const key = `msg:${id}`;

        const rawData = await redis.get(key);

        if (!rawData) {
            return res.status(404).json({ error: 'Mensaje no encontrado o expirado' });
        }

        const data = JSON.parse(rawData);

        if (data.views >= data.maxUses) {
            await redis.del(key);
            return res.status(410).json({ error: 'El mensaje ha sido eliminado' });
        }

        data.views += 1;

        if (data.views >= data.maxUses) {
            await redis.del(key);
        } else {
            await redis.set(key, JSON.stringify(data), 'KEEPTTL');
        }

        res.json({
            encryptedData: data.encryptedData,
            iv: data.iv,
            encryptedFile: data.encryptedFile,
            fileName: data.fileName,
            fileType: data.fileType,
            salt: data.salt,
            authType: data.authType
        });

    } catch (error) {
        console.error('Error retrieving message:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});