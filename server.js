const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============= CONFIGURAÇÕES EXATAS DO APK =============
const API_BASE_URL = "http://api.movtv.co.mz";
const DEVICE_ID = "f30ec03a4e6a32c1b45efd7eb9c10854";
const MSISDN = "865446574";
const SECRET = "mCotB+*f>SYyO@8Em";

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============= FUNÇÕES EXATAS DO APK =============
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

// ============= CHAMADA API EXATA DO APK =============
async function callApi(endpoint, params = null) {
    const timestamp = generateTimestamp();
    const s_hash = generateHash(timestamp);
    
    // Constrói URL exatamente como no APK
    let url = `${API_BASE_URL}/${endpoint}?`;
    url += `s=${s_hash}`;
    url += `&t=${timestamp}`;
    url += `&os=android`;
    url += `&language=pt`;
    url += `&msisdn=${MSISDN}`;
    url += `&did=${DEVICE_ID}`;
    url += `&clientType=Android`;
    url += `&revision=173`;
    url += `&languageCode=pt`;
    url += `&countryCode=PT`;
    
    if (params) {
        url += `&${params}`;
    }
    
    console.log(`🌐 ${endpoint}`);
    
    // Headers exatos do APK
    const response = await fetch(url, {
        headers: {
            'X-Api-Key': 'bigzun.com',
            'Device-Id': DEVICE_ID
        }
    });
    
    const text = await response.text();
    return JSON.parse(text);
}

// ============= ENDPOINTS =============

// GET /api/filmes - EXATAMENTE como o APK faz loadMovies()
app.get('/api/filmes', async (req, res) => {
    try {
        const limit = req.query.limit || 50;
        const offset = req.query.offset || 0;
        const categoryId = req.query.category || '0';
        
        let endpoint, params;
        
        if (categoryId === '0') {
            endpoint = 'partner/content/getAllFilms';
            params = `limit=${limit}&offset=${offset}`;
        } else {
            endpoint = 'partner/content/getFilmsByCategory';
            params = `category_id=${categoryId}&limit=${limit}&offset=${offset}`;
        }
        
        const data = await callApi(endpoint, params);
        
        // APK faz: JSONArray data = json.getJSONArray("data")
        const filmes = (data.data || []).map(item => ({
            id: item.id,
            titulo: item.title || 'Sem título',
            thumb: item.thumb || item.cover || ''
        }));
        
        res.json({ filmes });
    } catch (e) {
        res.json({ filmes: [] });
    }
});

// GET /api/categorias - EXATAMENTE como o APK faz loadCategories()
app.get('/api/categorias', async (req, res) => {
    try {
        const data = await callApi('partner/content/getFilmCategoryList', null);
        
        // APK faz: JSONArray data = json.getJSONArray("data")
        const categorias = (data.data || []).map(cat => ({
            id: cat.id,
            nome: cat.name
        }));
        
        res.json({ categorias });
    } catch (e) {
        res.json({ categorias: [] });
    }
});

// GET /api/canais - EXATAMENTE como o APK faz loadTVChannels()
app.get('/api/canais', async (req, res) => {
    try {
        const data = await callApi('partner/content/getAllTV', 'limit=200');
        
        // APK faz: JSONArray data = json.getJSONArray("data")
        const canais = (data.data || []).map(canal => ({
            id: canal.id,
            titulo: canal.title,
            thumb: canal.thumb || canal.logo || canal.cover || ''
        }));
        
        res.json({ canais });
    } catch (e) {
        res.json({ canais: [] });
    }
});

// GET /api/filme/:id - EXATAMENTE como o APK faz playMovie()
app.get('/api/filme/:id', async (req, res) => {
    try {
        const filmId = req.params.id;
        const data = await callApi('partner/content/getFilmDetail', `film_id=${filmId}`);
        
        // APK faz: JSONObject data = json.getJSONObject("data")
        const raw = data.data || {};
        
        let videoUrl = raw.media_url || '';
        if (videoUrl) {
            videoUrl = videoUrl.replace('30fc87ca.vws.vegacdn.vn', 'free-media.movtv.co.mz');
            if (!videoUrl.startsWith('http')) videoUrl = 'http://' + videoUrl;
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
        res.json({ filme: null });
    }
});

// GET /api/canal/:id - EXATAMENTE como o APK faz playTVChannel()
app.get('/api/canal/:id', async (req, res) => {
    try {
        const tvId = req.params.id;
        const data = await callApi('partner/content/playTelevision', `tv_id=${tvId}`);
        
        const raw = data.data || {};
        let videoUrl = raw.stream_url || raw.url || raw.media_url || '';
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

// GET /api/buscar - EXATAMENTE como o APK faz performSearch()
app.get('/api/buscar', async (req, res) => {
    try {
        const q = req.query.q || '';
        if (!q) return res.json({ filmes: [] });
        
        const data = await callApi('app/search', `keyword=${encodeURIComponent(q)}&limit=100`);
        
        const filmes = [];
        const rawData = data.data || [];
        
        // APK faz: percorre sections e lists
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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.VERCEL) {
    module.exports = app;
} else {
    app.listen(PORT, () => {
        console.log(`\n🚀 http://localhost:${PORT}\n`);
    });
}