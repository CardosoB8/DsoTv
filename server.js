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

// Headers para API de metadados (sem Referer e X-Requested-With)
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

// Cache simples
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
            nome: cat.name || cat.title || 'Sem nome'
        }));
        
        const result = { categorias };
        setCached('categorias', result);
        res.json(result);
    } catch (e) {
        console.error('Erro categorias:', e.message);
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
            ano: item.year || ''
        }));
        
        const result = { filmes };
        setCached(cacheKey, result);
        res.json(result);
    } catch (e) {
        console.error('Erro filmes:', e.message);
        res.json({ filmes: [] });
    }
});

app.get('/api/canais', async (req, res) => {
    try {
        const cached = getCached('canais');
        if (cached) return res.json(cached);
        
        const data = await callApi('partner/content/getAllTV', { limit: 200 });
        
        const canais = (data.data || []).map(canal => {
            // Exatamente como o APK faz
            let thumbUrl = '';
            if (canal.thumb && canal.thumb.trim() && !canal.thumb.includes('null')) {
                thumbUrl = canal.thumb;
            } else if (canal.logo && canal.logo.trim()) {
                thumbUrl = canal.logo;
            } else if (canal.cover && canal.cover.trim()) {
                thumbUrl = canal.cover;
            }
            
            return {
                id: canal.id,
                titulo: canal.title || 'Sem nome',
                thumb: thumbUrl
            };
        });
        
        const result = { canais };
        setCached('canais', result);
        res.json(result);
    } catch (e) {
        console.error('Erro canais:', e.message);
        res.json({ canais: [] });
    }
});

app.get('/api/filme/:id', async (req, res) => {
    try {
        const filmId = req.params.id;
        const data = await callApi('partner/content/getFilmDetail', { film_id: filmId });
        
        const raw = data.data || {};
        let videoUrl = raw.media_url || raw.video_url || '';
        
        // Não substitui domínio, mantém original
        if (videoUrl && !videoUrl.startsWith('http')) {
            videoUrl = 'http://' + videoUrl;
        }
        
        res.json({
            filme: {
                id: raw.id || filmId,
                titulo: raw.title || '',
                thumb: raw.thumb || raw.cover || '',
                ano: raw.year || raw.release_year || '',
                duracao: raw.duration || '',
                pais: raw.nation || '',
                descricao: (raw.description || '').replace(/<[^>]*>/g, ''),
                videoUrl: videoUrl
            }
        });
    } catch (e) {
        console.error('Erro filme:', e.message);
        res.json({ filme: null });
    }
});

app.get('/api/canal/:id', async (req, res) => {
    try {
        const tvId = req.params.id;
        const data = await callApi('partner/content/playTelevision', { tv_id: tvId });
        
        const raw = data.data || {};
        // NÃO substitui domínio para TV - exatamente como no APK!
        let videoUrl = raw.stream_url || raw.url || raw.media_url || '';
        
        // Apenas garante que começa com http
        if (videoUrl && !videoUrl.startsWith('http')) {
            videoUrl = 'http://' + videoUrl;
        }
        
        console.log('📺 TV Stream URL:', videoUrl);
        
        res.json({ canal: { id: tvId, titulo: raw.title || '', videoUrl } });
    } catch (e) {
        console.error('Erro canal:', e.message);
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
                        thumb: item.thumb || item.cover || '',
                        ano: item.year || ''
                    });
                }
            }
        }
        
        res.json({ filmes });
    } catch (e) {
        console.error('Erro busca:', e.message);
        res.json({ filmes: [] });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.VERCEL) {
    module.exports = app;
} else {
    app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
}