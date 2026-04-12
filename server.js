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
    
    console.log('\n═══════════════════════════════════════');
    console.log(`📤 REQUISIÇÃO PARA API MOVTV`);
    console.log(`📍 Endpoint: ${endpoint}`);
    console.log(`🔗 URL: ${url.substring(0, 200)}...`);
    console.log(`📋 Params:`, customParams);
    
    const response = await fetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'X-Api-Key': 'bigzun.com',
            'Device-Id': DEVICE_ID
        },
        signal: AbortSignal.timeout(30000)
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    console.log(`📥 RESPOSTA DA API MOVTV`);
    console.log(`✅ Code: ${data.code}, Message: ${data.message}`);
    console.log(`📦 data é array? ${Array.isArray(data.data)}`);
    console.log(`📦 data tamanho: ${Array.isArray(data.data) ? data.data.length : 'N/A'}`);
    if (Array.isArray(data.data) && data.data.length > 0) {
        console.log(`📋 Primeiro item:`, JSON.stringify(data.data[0]).substring(0, 300));
    }
    console.log('═══════════════════════════════════════\n');
    
    return data;
}

function getCached(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`💾 Cache HIT: ${key}`);
        return cached.data;
    }
    console.log(`💾 Cache MISS: ${key}`);
    return null;
}

function setCached(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
    console.log(`💾 Cache SET: ${key}`);
}

// ============= ENDPOINTS =============

app.get('/api/filmes', async (req, res) => {
    console.log(`\n🎬 [FRONTEND] GET /api/filmes - limit=${req.query.limit}, offset=${req.query.offset}`);
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const cacheKey = `filmes_${limit}_${offset}`;
        const cached = getCached(cacheKey);
        if (cached) {
            console.log(`📤 [FRONTEND] Respondendo com cache`);
            return res.json(cached);
        }
        
        const data = await callApi('partner/content/getAllFilms', { limit, offset });
        
        const filmes = (data.data || []).map(item => ({
            id: item.id,
            titulo: item.title || 'Sem título',
            thumb: item.thumb || ''
        }));
        
        console.log(`📤 [FRONTEND] Respondendo com ${filmes.length} filmes`);
        const result = { filmes };
        setCached(cacheKey, result);
        res.json(result);
    } catch (error) {
        console.error(`❌ [FRONTEND] Erro:`, error.message);
        res.status(500).json({ filmes: [] });
    }
});

app.get('/api/categorias', async (req, res) => {
    console.log(`\n📁 [FRONTEND] GET /api/categorias`);
    try {
        const cached = getCached('categorias');
        if (cached) return res.json(cached);
        
        const data = await callApi('partner/content/getFilmCategoryList');
        
        const categorias = (data.data || []).map(cat => ({
            id: cat.id,
            nome: cat.name || cat.title || 'Sem nome'
        }));
        
        console.log(`📤 [FRONTEND] Respondendo com ${categorias.length} categorias`);
        const result = { categorias };
        setCached('categorias', result);
        res.json(result);
    } catch (error) {
        console.error(`❌ [FRONTEND] Erro:`, error.message);
        res.status(500).json({ categorias: [] });
    }
});

app.get('/api/filmes/categoria/:id', async (req, res) => {
    console.log(`\n📂 [FRONTEND] GET /api/filmes/categoria/${req.params.id}`);
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
        
        console.log(`📤 [FRONTEND] Respondendo com ${filmes.length} filmes`);
        res.json({ filmes });
    } catch (error) {
        console.error(`❌ [FRONTEND] Erro:`, error.message);
        res.status(500).json({ filmes: [] });
    }
});

app.get('/api/canais', async (req, res) => {
    console.log(`\n📺 [FRONTEND] GET /api/canais`);
    try {
        const cached = getCached('canais');
        if (cached) return res.json(cached);
        
        const data = await callApi('partner/content/getAllTV', { limit: 200 });
        
        const canais = (data.data || []).map(canal => ({
            id: canal.id,
            titulo: canal.title || 'Sem nome',
            thumb: canal.thumb || ''
        }));
        
        console.log(`📤 [FRONTEND] Respondendo com ${canais.length} canais`);
        const result = { canais };
        setCached('canais', result);
        res.json(result);
    } catch (error) {
        console.error(`❌ [FRONTEND] Erro:`, error.message);
        res.status(500).json({ canais: [] });
    }
});

app.get('/api/filme/:id', async (req, res) => {
    console.log(`\n🎬 [FRONTEND] GET /api/filme/${req.params.id}`);
    try {
        const filmId = req.params.id;
        const data = await callApi('partner/content/getFilmDetail', { film_id: filmId });
        
        const raw = data.data || {};
        
        const videoUrl = fixVideoUrl(raw.media_url || raw.video_url || raw.url || '');
        console.log(`🎥 Video URL: ${videoUrl ? videoUrl.substring(0, 80) + '...' : 'NÃO ENCONTRADO'}`);
        
        const filme = {
            id: raw.id || filmId,
            titulo: raw.title || raw.film_name || '',
            thumb: raw.thumb || raw.cover || '',
            ano: raw.year || raw.release_year || '',
            duracao: raw.duration || '',
            pais: raw.nation || raw.country || '',
            descricao: (raw.description || '').replace(/<[^>]*>/g, ''),
            videoUrl: videoUrl
        };
        
        console.log(`📤 [FRONTEND] Respondendo filme: ${filme.titulo}`);
        res.json({ filme });
    } catch (error) {
        console.error(`❌ [FRONTEND] Erro:`, error.message);
        res.status(500).json({ filme: null });
    }
});

app.get('/api/canal/:id', async (req, res) => {
    console.log(`\n📺 [FRONTEND] GET /api/canal/${req.params.id}`);
    try {
        const tvId = req.params.id;
        const data = await callApi('partner/content/playTelevision', { tv_id: tvId });
        
        const raw = data.data || {};
        let videoUrl = raw.stream_url || raw.url || '';
        if (videoUrl && !videoUrl.startsWith('http')) {
            videoUrl = 'http://' + videoUrl;
        }
        
        console.log(`🎥 Stream URL: ${videoUrl ? videoUrl.substring(0, 80) + '...' : 'NÃO ENCONTRADO'}`);
        
        const canal = {
            id: tvId,
            titulo: raw.title || '',
            videoUrl: videoUrl
        };
        
        console.log(`📤 [FRONTEND] Respondendo canal: ${canal.titulo}`);
        res.json({ canal });
    } catch (error) {
        console.error(`❌ [FRONTEND] Erro:`, error.message);
        res.status(500).json({ canal: null });
    }
});

app.get('/api/buscar', async (req, res) => {
    console.log(`\n🔍 [FRONTEND] GET /api/buscar?q=${req.query.q}`);
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
        
        console.log(`📤 [FRONTEND] Respondendo com ${filmes.length} resultados`);
        res.json({ filmes });
    } catch (error) {
        console.error(`❌ [FRONTEND] Erro:`, error.message);
        res.status(500).json({ filmes: [] });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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