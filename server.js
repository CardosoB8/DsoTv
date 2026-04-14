const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const API_BASE_URL = "http://api.movtv.co.mz";
const DEVICE_ID = "f30ec03a4e6a32c1b45efd7eb9c10854";
const MSISDN = "865446574";
const SECRET = "mCotB+*f>SYyO@8Em";

const API_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
    'Connection': 'keep-alive'
};

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function generateTimestamp() {
    const now = new Date();
    const maputoTime = new Date(now.getTime() + (2 * 60 * 60 * 1000));
    const year = maputoTime.getUTCFullYear();
    const month = String(maputoTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(maputoTime.getUTCDate()).padStart(2, '0');
    const hours = String(maputoTime.getUTCHours()).padStart(2, '0');
    const minutes = String(maputoTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(maputoTime.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function generateHash(timestamp) {
    const hashString = `${timestamp}|${SECRET}|${MSISDN}|${DEVICE_ID}|android`;
    return crypto.createHash('sha256').update(hashString).digest('hex');
}

async function callApi(endpoint, params = {}) {
    const timestamp = generateTimestamp();
    const hash = generateHash(timestamp);
    
    const urlParams = new URLSearchParams();
    urlParams.append('s', hash);
    urlParams.append('t', timestamp);
    urlParams.append('os', 'android');
    urlParams.append('language', 'pt');
    urlParams.append('msisdn', MSISDN);
    urlParams.append('did', DEVICE_ID);
    urlParams.append('clientType', 'Android');
    urlParams.append('revision', '173');
    urlParams.append('languageCode', 'pt');
    urlParams.append('countryCode', 'PT');
    
    Object.entries(params).forEach(([k, v]) => urlParams.append(k, String(v)));
    
    const url = `${API_BASE_URL}/${endpoint}?${urlParams.toString()}`;
    
    console.log(`🌐 API: ${endpoint}`);
    
    const response = await axios.get(url, {
        headers: {
            'X-Api-Key': 'bigzun.com',
            'Device-Id': DEVICE_ID,
            ...API_HEADERS
        },
        timeout: 30000
    });
    
    return response.data;
}

// Cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
    return null;
}

function setCached(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

// ============= ENDPOINTS =============

app.get('/api/categorias', async (req, res) => {
    try {
        const cached = getCached('categorias');
        if (cached) return res.json(cached);
        
        const data = await callApi('partner/content/getFilmCategoryList', {});
        const categorias = (data.data || []).map(cat => ({
            id: cat.id,
            nome: cat.name || cat.title || 'Sem nome',
            imagem: cat.image_url || ''
        }));
        
        const result = { categorias };
        setCached('categorias', result);
        res.json(result);
    } catch (e) {
        res.json({ categorias: [] });
    }
});

app.get('/api/filmes', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const categoryId = req.query.category || '0';
        
        let endpoint, params;
        if (categoryId === '0') {
            endpoint = 'partner/content/getAllFilms';
            params = { limit, offset };
        } else {
            endpoint = 'partner/content/getFilmsByCategory';
            params = { category_id: categoryId, limit, offset };
        }
        
        const cacheKey = `filmes_${categoryId}_${limit}_${offset}`;
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);
        
        const data = await callApi(endpoint, params);
        const filmes = (data.data || []).map(item => ({
            id: item.id,
            titulo: item.title || 'Sem título',
            thumb: item.thumb || '',
            thumb_horizontal: item.thumb_horizontal || '',
            ano: item.published_year || item.year || ''
        }));
        
        const result = { filmes };
        setCached(cacheKey, result);
        res.json(result);
    } catch (e) {
        res.json({ filmes: [] });
    }
});

app.get('/api/canais', async (req, res) => {
    try {
        const cached = getCached('canais');
        if (cached) return res.json(cached);
        
        const data = await callApi('partner/content/getAllTV', { limit: 200 });
        const canais = (data.data || []).map(canal => ({
            id: canal.id,
            titulo: canal.title || 'Sem nome',
            thumb: canal.thumb || ''
        }));
        
        const result = { canais };
        setCached('canais', result);
        res.json(result);
    } catch (e) {
        res.json({ canais: [] });
    }
});

app.get('/api/filme/:id', async (req, res) => {
    try {
        const filmId = req.params.id;
        const data = await callApi('partner/content/getFilmDetail', { film_id: filmId });
        
        const raw = data.data || {};
        let videoUrl = raw.media_url || '';
        
        // Substituir domínio para filmes
        if (videoUrl) {
            videoUrl = videoUrl.replace('30fc87ca.vws.vegacdn.vn', 'free-media.movtv.co.mz');
            if (!videoUrl.startsWith('http')) videoUrl = 'http://' + videoUrl;
        }
        
        // Extrair atores
        const atores = (raw.actors || []).map(a => a.title || a.name).filter(Boolean);
        
        // Extrair categorias
        const categorias = (raw.category || []).map(c => c.title || c.name).filter(Boolean);
        
        res.json({
            filme: {
                id: raw.id || filmId,
                titulo: raw.title || '',
                titulo_original: raw.title_original || '',
                capa: raw.cover || raw.thumb || '',
                thumb: raw.thumb || '',
                ano: raw.published_year || raw.year || '',
                duracao: raw.duration || '',
                pais: raw.nation || '',
                sinopse: (raw.brief || raw.description || '').replace(/<[^>]*>/g, ''),
                categorias: categorias,
                atores: atores,
                is_serie: raw.is_series == 1,
                videoUrl: videoUrl
            }
        });
    } catch (e) {
        res.json({ filme: null });
    }
});

app.get('/api/canal/:id', async (req, res) => {
    try {
        const tvId = req.params.id;
        const data = await callApi('partner/content/playTelevision', { tv_id: tvId });
        
        const raw = data.data || {};
        let videoUrl = raw.media_url || raw.stream_url || raw.url || '';
        
        // NÃO substituir domínio para TV
        if (videoUrl && !videoUrl.startsWith('http')) {
            videoUrl = 'http://' + videoUrl;
        }
        
        res.json({ 
            canal: { 
                id: tvId, 
                titulo: raw.title || '', 
                videoUrl: videoUrl
            } 
        });
    } catch (e) {
        res.json({ canal: null });
    }
});

app.get('/api/buscar', async (req, res) => {
    try {
        const q = req.query.q || '';
        if (!q) return res.json({ filmes: [] });
        
        const data = await callApi('app/search', { keyword: q, limit: 50 });
        const filmes = [];
        const rawData = data.data || [];
        
        for (const section of rawData) {
            if (section.lists) {
                for (const item of section.lists) {
                    filmes.push({
                        id: item.id,
                        titulo: item.title || '',
                        thumb: item.thumb || '',
                        ano: item.published_year || item.year || ''
                    });
                }
            }
        }
        
        res.json({ filmes });
    } catch (e) {
        res.json({ filmes: [] });
    }
});

// Página de player para redirecionamento
app.get('/player', (req, res) => {
    const url = req.query.url || '';
    const title = req.query.title || 'DSO TV';
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>${title}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { background: #000; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
                video { width: 100%; height: 100vh; object-fit: contain; }
            </style>
        </head>
        <body>
            <video controls autoplay playsinline src="${url}"></video>
        </body>
        </html>
    `);
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.VERCEL) {
    module.exports = app;
} else {
    app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
}