const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações da API MOVTV
const API_BASE_URL = "http://api.movtv.co.mz";
const DEVICE_ID = "f30ec03a4e6a32c1b45efd7eb9c10854";
const MSISDN = "865446574";
const SECRET = "mCotB+*f>SYyO@8Em";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

// Parâmetros comuns
const commonParams = {
    os: 'android',
    language: 'pt',
    msisdn: MSISDN,
    did: DEVICE_ID,
    clientType: 'Android',
    revision: '173',
    languageCode: 'pt',
    countryCode: 'PT'
};

// Cache simples (5 minutos)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Log de requisições
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path}`);
    next();
});

// Funções auxiliares
function generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function generateHash(timestamp) {
    const hashString = `${timestamp}|${SECRET}|${MSISDN}|${DEVICE_ID}|android`;
    return crypto.createHash('sha256').update(hashString).digest('hex');
}

function fixVideoUrl(originalUrl) {
    if (!originalUrl) return '';
    let fixed = originalUrl.replace('30fc87ca.vws.vegacdn.vn', 'free-media.movtv.co.mz');
    if (!fixed.startsWith('http://') && !fixed.startsWith('https://')) {
        fixed = 'http://' + fixed;
    }
    return fixed;
}

async function callApi(endpoint, customParams = {}) {
    const timestamp = generateTimestamp();
    const hash = generateHash(timestamp);
    
    const allParams = {
        s: hash,
        t: timestamp,
        ...commonParams,
        ...customParams
    };
    
    const queryString = Object.entries(allParams)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
    
    const url = `${API_BASE_URL}/${endpoint}?${queryString}`;
    
    console.log(`[API] ${endpoint}`);
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'X-Api-Key': 'bigzun.com',
                'Device-Id': DEVICE_ID,
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(30000)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`[API Error] ${endpoint}:`, error.message);
        throw error;
    }
}

function getCached(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Cache] Hit: ${key}`);
        return cached.data;
    }
    return null;
}

function setCached(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
    console.log(`[Cache] Set: ${key}`);
}

// ============= ENDPOINTS =============

app.get('/api/categories', async (req, res) => {
    try {
        const cacheKey = 'categories';
        let cached = getCached(cacheKey);
        if (cached) return res.json(cached);
        
        const data = await callApi('partner/content/getFilmCategoryList');
        setCached(cacheKey, data);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar categorias' });
    }
});

app.get('/api/movies', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const cacheKey = `movies_${limit}_${offset}`;
        let cached = getCached(cacheKey);
        if (cached) return res.json(cached);
        
        const data = await callApi('partner/content/getAllFilms', { limit, offset });
        setCached(cacheKey, data);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar filmes' });
    }
});

app.get('/api/movies/category/:id', async (req, res) => {
    try {
        const categoryId = req.params.id;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const data = await callApi('partner/content/getFilmsByCategory', { 
            category_id: categoryId, limit, offset 
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar categoria' });
    }
});

app.get('/api/movie/:id', async (req, res) => {
    try {
        const filmId = req.params.id;
        const data = await callApi('partner/content/getFilmDetail', { film_id: filmId });
        
        // 🔥 CORREÇÃO: media_url (APK)
        if (data.data) {
            if (data.data.media_url) {
                data.data.media_url = fixVideoUrl(data.data.media_url);
            }
            if (data.data.video_url) {
                data.data.video_url = fixVideoUrl(data.data.video_url);
            }
        }
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar filme' });
    }
});

app.get('/api/tv', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 200;
        const offset = parseInt(req.query.offset) || 0;
        
        const cacheKey = `tv_${limit}_${offset}`;
        let cached = getCached(cacheKey);
        if (cached) return res.json(cached);
        
        const data = await callApi('partner/content/getAllTV', { limit, offset });
        setCached(cacheKey, data);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar TV' });
    }
});

app.get('/api/tv/play/:id', async (req, res) => {
    try {
        const tvId = req.params.id;
        const data = await callApi('partner/content/playTelevision', { tv_id: tvId });
        
        if (data.data && data.data.stream_url) {
            data.data.stream_url = fixVideoUrl(data.data.stream_url);
        }
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar stream' });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const keyword = req.query.q || '';
        const limit = parseInt(req.query.limit) || 100;
        
        if (!keyword) return res.json({ data: [] });
        
        const data = await callApi('app/search', { keyword, limit });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erro na busca' });
    }
});

// Rota catch-all para SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Exportar para Vercel ou iniciar servidor
if (process.env.VERCEL) {
    module.exports = app;
} else {
    app.listen(PORT, () => {
        console.log(`
        ╔══════════════════════════════════════════╗
        ║   🎬 MOVTV WEB PLAYER                    ║
        ║   📡 http://localhost:${PORT}              ║
        ╚══════════════════════════════════════════╝
        `);
    });
}

// Limpeza de cache
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            cache.delete(key);
        }
    }
}, 60000);