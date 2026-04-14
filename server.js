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

// ========== TIMESTAMP CORRIGIDO - AGORA COM UTC+2 (Maputo) ==========
function generateTimestamp() {
    const now = new Date();
    
    // A API está em UTC+2 (horário de Maputo)
    // Adiciona 2 horas ao UTC
    const maputoTime = new Date(now.getTime() + (2 * 60 * 60 * 1000));
    
    const year = maputoTime.getUTCFullYear();
    const month = String(maputoTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(maputoTime.getUTCDate()).padStart(2, '0');
    const hours = String(maputoTime.getUTCHours()).padStart(2, '0');
    const minutes = String(maputoTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(maputoTime.getUTCSeconds()).padStart(2, '0');
    
    const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;
    
    console.log('🕐 Timestamp gerado:', timestamp);
    return timestamp;
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
    
    console.log('📤 URL:', url.substring(0, 200) + '...');
    
    try {
        const response = await axios.get(url, {
            headers: {
                'X-Api-Key': 'bigzun.com',
                'Device-Id': DEVICE_ID,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        
        return { 
            data: response.data, 
            debug: { url, response: JSON.stringify(response.data).substring(0, 400) } 
        };
    } catch (error) {
        console.error('❌ Erro:', error.message);
        throw error;
    }
}

// ========== ENDPOINTS ==========

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
        
        res.json({ filmes, _debug: debug });
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
        
        res.json({ categorias, _debug: debug });
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
        
        res.json({ canais, _debug: debug });
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
        
        res.json({ filmes, _debug: debug });
    } catch (e) {
        res.json({ filmes: [], _debug: { error: e.message } });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.VERCEL) {
    module.exports = app;
} else {
    app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
}