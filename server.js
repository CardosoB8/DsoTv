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

function fixVideoUrl(url) {
    if (!url) return '';
    let fixed = url.replace('30fc87ca.vws.vegacdn.vn', 'free-media.movtv.co.mz');
    if (!fixed.startsWith('http://') && !fixed.startsWith('https://')) {
        fixed = 'http://' + fixed;
    }
    return fixed;
}

function buildUrl(endpoint, params = {}) {
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
    return `${API_BASE_URL}/${endpoint}?${urlParams.toString()}`;
}

async function callApi(endpoint, params = {}) {
    const url = buildUrl(endpoint, params);
    const response = await axios.get(url, {
        headers: {
            'X-Api-Key': 'bigzun.com',
            'Device-Id': DEVICE_ID,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
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

// Endpoints
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
            thumb: item.thumb || ''
        }));
        const result = { filmes };
        setCached(cacheKey, result);
        res.json(result);
    } catch (e) {
        res.json({ filmes: [] });
    }
});

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
        res.json({ categorias: [] });
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
            thumb: canal.thumb || canal.logo || canal.cover || ''
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
        let videoUrl = raw.media_url || raw.video_url || '';
        if (videoUrl) videoUrl = fixVideoUrl(videoUrl);
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
        res.json({ filme: null });
    }
});

app.get('/api/canal/:id', async (req, res) => {
    try {
        const tvId = req.params.id;
        const data = await callApi('partner/content/playTelevision', { tv_id: tvId });
        const raw = data.data || {};
        let videoUrl = raw.stream_url || raw.url || raw.media_url || '';
        if (videoUrl && !videoUrl.startsWith('http')) videoUrl = 'http://' + videoUrl;
        res.json({ canal: { id: tvId, titulo: raw.title || '', videoUrl } });
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
                        thumb: item.thumb || item.cover || ''
                    });
                }
            }
        }
        res.json({ filmes });
    } catch (e) {
        res.json({ filmes: [] });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.VERCEL) {
    module.exports = app;
} else {
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
}