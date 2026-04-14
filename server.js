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

async function callApi(endpoint, extraParams = {}) {
    const timestamp = generateTimestamp();
    const hash = generateHash(timestamp);
    
    const params = new URLSearchParams();
    params.append('s', hash);
    params.append('t', timestamp);
    params.append('os', 'android');
    params.append('language', 'pt');
    params.append('msisdn', MSISDN);
    params.append('did', DEVICE_ID);
    params.append('clientType', 'Android');
    params.append('revision', '173');
    params.append('languageCode', 'pt');
    params.append('countryCode', 'PT');
    
    Object.entries(extraParams).forEach(([key, value]) => {
        params.append(key, String(value));
    });
    
    const url = `${API_BASE_URL}/${endpoint}?${params.toString()}`;
    
    console.log('\n' + '='.repeat(60));
    console.log(`📤 URL: ${url}`);
    
    try {
        const response = await fetch(url, {
            headers: {
                'X-Api-Key': 'bigzun.com',
                'Device-Id': DEVICE_ID
            }
        });
        
        const text = await response.text();
        const data = JSON.parse(text);
        
        console.log(`📥 Resposta: ${text.substring(0, 200)}`);
        console.log('='.repeat(60));
        
        // 🔥 RETORNA A URL JUNTO COM OS DADOS!
        return { data, debug: { url, response: text.substring(0, 500) } };
    } catch (error) {
        console.error(`❌ Erro:`, error.message);
        throw error;
    }
}

// Cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// ========== ENDPOINTS COM DEBUG ==========

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
        
        const { data, debug } = await callApi(endpoint, params);
        
        const filmes = (data.data || []).map(item => ({
            id: item.id,
            titulo: item.title || 'Sem título',
            thumb: item.thumb || ''
        }));
        
        // 🔥 INCLUI DEBUG NA RESPOSTA!
        res.json({ 
            filmes,
            _debug: debug
        });
    } catch (e) {
        res.json({ filmes: [], _debug: { error: e.message } });
    }
});

app.get('/api/categorias', async (req, res) => {
    try {
        const { data, debug } = await callApi('partner/content/getFilmCategoryList', {});
        
        const categorias = (data.data || []).map(cat => ({
            id: cat.id,
            nome: cat.name || cat.title || 'Sem nome'
        }));
        
        res.json({ 
            categorias,
            _debug: debug
        });
    } catch (e) {
        res.json({ categorias: [], _debug: { error: e.message } });
    }
});

app.get('/api/canais', async (req, res) => {
    try {
        const { data, debug } = await callApi('partner/content/getAllTV', { limit: 200 });
        
        const canais = (data.data || []).map(canal => ({
            id: canal.id,
            titulo: canal.title || 'Sem nome',
            thumb: canal.thumb || ''
        }));
        
        res.json({ 
            canais,
            _debug: debug
        });
    } catch (e) {
        res.json({ canais: [], _debug: { error: e.message } });
    }
});

app.get('/api/filme/:id', async (req, res) => {
    try {
        const filmId = req.params.id;
        const { data, debug } = await callApi('partner/content/getFilmDetail', { film_id: filmId });
        
        const raw = data.data || {};
        let videoUrl = raw.media_url || raw.video_url || '';
        if (videoUrl) {
            videoUrl = fixVideoUrl(videoUrl);
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
            },
            _debug: debug
        });
    } catch (e) {
        res.json({ filme: null, _debug: { error: e.message } });
    }
});

app.get('/api/canal/:id', async (req, res) => {
    try {
        const tvId = req.params.id;
        const { data, debug } = await callApi('partner/content/playTelevision', { tv_id: tvId });
        
        const raw = data.data || {};
        let videoUrl = raw.stream_url || raw.url || '';
        if (videoUrl && !videoUrl.startsWith('http')) {
            videoUrl = 'http://' + videoUrl;
        }
        
        res.json({ 
            canal: { id: tvId, titulo: raw.title || '', videoUrl },
            _debug: debug
        });
    } catch (e) {
        res.json({ canal: null, _debug: { error: e.message } });
    }
});

app.get('/api/buscar', async (req, res) => {
    try {
        const q = req.query.q || '';
        if (!q) return res.json({ filmes: [] });
        
        const { data, debug } = await callApi('app/search', { keyword: q, limit: 50 });
        
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
        
        res.json({ 
            filmes,
            _debug: debug
        });
    } catch (e) {
        res.json({ filmes: [], _debug: { error: e.message } });
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