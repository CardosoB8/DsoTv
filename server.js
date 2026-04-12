const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const API_BASE_URL = "http://api.movtv.co.mz";
const DEVICE_ID = "f30ec03a4e6a32c1b45efd7eb9c10854";
const MSISDN = "865446574";
const SECRET = "mCotB+*f>SYyO@8Em";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

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

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

function fixVideoUrl(url) {
    if (!url) return '';
    let fixed = url.replace('30fc87ca.vws.vegacdn.vn', 'free-media.movtv.co.mz');
    if (!fixed.startsWith('http://') && !fixed.startsWith('https://')) {
        fixed = 'http://' + fixed;
    }
    return fixed;
}

async function callApi(endpoint, customParams = {}) {
    const timestamp = generateTimestamp();
    const hash = generateHash(timestamp);
    
    const allParams = { s: hash, t: timestamp, ...commonParams, ...customParams };
    const queryString = Object.entries(allParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const url = `${API_BASE_URL}/${endpoint}?${queryString}`;
    
    const response = await fetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'X-Api-Key': 'bigzun.com',
            'Device-Id': DEVICE_ID
        },
        signal: AbortSignal.timeout(30000)
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
}

// Cache
function getCached(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    return null;
}

function setCached(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

// ============= ENDPOINTS =============

// GET /api/filmes
app.get('/api/filmes', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const cacheKey = `filmes_${limit}_${offset}`;
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);
        
        const data = await callApi('partner/content/getAllFilms', { limit, offset });
        
        const filmes = (data.data || []).map(item => ({
            id: item.id,
            titulo: item.title || 'Sem título',
            thumb: item.thumb || ''
        }));
        
        const result = { filmes };
        setCached(cacheKey, result);
        res.json(result);
    } catch (error) {
        res.status(500).json({ filmes: [] });
    }
});

// GET /api/categorias
app.get('/api/categorias', async (req, res) => {
    try {
        const cached = getCached('categorias');
        if (cached) return res.json(cached);
        
        const data = await callApi('partner/content/getFilmCategoryList');
        
        const categorias = (data.data || []).map(cat => ({
            id: cat.id,
            nome: cat.name || cat.title || 'Sem nome'
        }));
        
        const result = { categorias };
        setCached('categorias', result);
        res.json(result);
    } catch (error) {
        res.status(500).json({ categorias: [] });
    }
});

// GET /api/filmes/categoria/:id
app.get('/api/filmes/categoria/:id', async (req, res) => {
    try {
        const categoryId = req.params.id;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const data = await callApi('partner/content/getFilmsByCategory', { 
            category_id: categoryId, limit, offset 
        });
        
        const filmes = (data.data || []).map(item => ({
            id: item.id,
            titulo: item.title || 'Sem título',
            thumb: item.thumb || ''
        }));
        
        res.json({ filmes });
    } catch (error) {
        res.status(500).json({ filmes: [] });
    }
});

// GET /api/canais
app.get('/api/canais', async (req, res) => {
    try {
        const cached = getCached('canais');
        if (cached) return res.json(cached);
        
        const data = await callApi('partner/content/getAllTV', { limit: 200 });
        
        const canais = (data.data || []).map(canal => ({
            id: canal.id,
            titulo: canal.title || 'Sem nome',
            thumb: canal.thumb || '',
            original_id: canal.original_id
        }));
        
        const result = { canais };
        setCached('canais', result);
        res.json(result);
    } catch (error) {
        res.status(500).json({ canais: [] });
    }
});

// GET /api/filme/:id
app.get('/api/filme/:id', async (req, res) => {
    try {
        const filmId = req.params.id;
        const data = await callApi('partner/content/getFilmDetail', { film_id: filmId });
        
        const raw = data.data || {};
        
        const filme = {
            id: raw.id || filmId,
            titulo: raw.title || raw.film_name || '',
            thumb: raw.thumb || raw.cover || '',
            ano: raw.year || raw.release_year || '',
            duracao: raw.duration || '',
            pais: raw.nation || raw.country || '',
            descricao: (raw.description || '').replace(/<[^>]*>/g, ''),
            videoUrl: fixVideoUrl(raw.media_url || raw.video_url || raw.url || '')
        };
        
        res.json({ filme });
    } catch (error) {
        res.status(500).json({ filme: null });
    }
});

// GET /api/canal/:id
app.get('/api/canal/:id', async (req, res) => {
    try {
        const tvId = req.params.id;
        const data = await callApi('partner/content/playTelevision', { tv_id: tvId });
        
        const raw = data.data || {};
        let videoUrl = raw.stream_url || raw.url || '';
        if (videoUrl && !videoUrl.startsWith('http')) {
            videoUrl = 'http://' + videoUrl;
        }
        
        const canal = {
            id: tvId,
            titulo: raw.title || '',
            videoUrl: videoUrl
        };
        
        res.json({ canal });
    } catch (error) {
        res.status(500).json({ canal: null });
    }
});

// GET /api/buscar
app.get('/api/buscar', async (req, res) => {
    try {
        const q = req.query.q || '';
        if (!q) return res.json({ filmes: [] });
        
        const data = await callApi('app/search', { keyword: q, limit: 50 });
        
        let filmes = [];
        const rawData = data.data || [];
        
        if (Array.isArray(rawData)) {
            rawData.forEach(section => {
                const items = section.lists || section.items || [section];
                if (Array.isArray(items)) {
                    items.forEach(item => {
                        if (item.id) {
                            filmes.push({
                                id: item.id,
                                titulo: item.title || item.film_name || '',
                                thumb: item.thumb || item.cover || '',
                                ano: item.year || ''
                            });
                        }
                    });
                }
            });
        }
        
        res.json({ filmes });
    } catch (error) {
        res.status(500).json({ filmes: [] });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Limpeza de cache
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            cache.delete(key);
        }
    }
}, 60000);

if (process.env.VERCEL) {
    module.exports = app;
} else {
    app.listen(PORT, () => {
        console.log(`\n🚀 DSO TV rodando em http://localhost:${PORT}\n`);
    });
}