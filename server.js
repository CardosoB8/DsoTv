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

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Log de requisições
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path}`);
    next();
});

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
    
    console.log(`[API] ${endpoint}`);
    
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

// ============= ENDPOINTS ORGANIZADOS =============

// GET /api/filmes - Retorna lista de filmes ORGANIZADA
app.get('/api/filmes', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const data = await callApi('partner/content/getAllFilms', { limit, offset });
        
        // 🔥 ORGANIZA OS DADOS AQUI!
        let filmes = [];
        const rawData = data.data || data || [];
        
        if (Array.isArray(rawData)) {
            filmes = rawData.map(item => ({
                id: item.id || item.film_id || '',
                titulo: item.title || item.film_name || item.name || 'Sem título',
                thumb: item.thumb || item.cover || item.thumbnail || '',
                ano: item.year || item.release_year || item.published_year || ''
            }));
        }
        
        console.log(`✅ ${filmes.length} filmes organizados`);
        res.json({ filmes, total: filmes.length });
        
    } catch (error) {
        console.error('❌ Erro filmes:', error.message);
        res.status(500).json({ filmes: [], erro: error.message });
    }
});

// GET /api/categorias - Lista de categorias ORGANIZADA
app.get('/api/categorias', async (req, res) => {
    try {
        const data = await callApi('partner/content/getFilmCategoryList');
        
        let categorias = [];
        const rawData = data.data || data || [];
        
        if (Array.isArray(rawData)) {
            categorias = rawData.map(cat => ({
                id: cat.id || cat.category_id || '',
                nome: cat.name || cat.category_name || cat.title || 'Sem nome'
            }));
        }
        
        console.log(`✅ ${categorias.length} categorias organizadas`);
        res.json({ categorias });
        
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
        
        let filmes = [];
        const rawData = data.data || data || [];
        
        if (Array.isArray(rawData)) {
            filmes = rawData.map(item => ({
                id: item.id || item.film_id || '',
                titulo: item.title || item.film_name || item.name || 'Sem título',
                thumb: item.thumb || item.cover || '',
                ano: item.year || item.release_year || ''
            }));
        }
        
        res.json({ filmes });
        
    } catch (error) {
        res.status(500).json({ filmes: [] });
    }
});

// GET /api/canais - Lista de canais TV ORGANIZADA
app.get('/api/canais', async (req, res) => {
    try {
        const data = await callApi('partner/content/getAllTV', { limit: 200 });
        
        let canais = [];
        const rawData = data.data || data || [];
        
        if (Array.isArray(rawData)) {
            canais = rawData.map(canal => ({
                id: canal.id || canal.tv_id || '',
                titulo: canal.title || canal.tv_name || canal.name || 'Sem nome',
                thumb: canal.thumb || canal.logo || canal.cover || '',
                aoVivo: true
            }));
        }
        
        console.log(`✅ ${canais.length} canais organizados`);
        res.json({ canais });
        
    } catch (error) {
        res.status(500).json({ canais: [] });
    }
});

// GET /api/filme/:id - Detalhes do filme
app.get('/api/filme/:id', async (req, res) => {
    try {
        const filmId = req.params.id;
        const data = await callApi('partner/content/getFilmDetail', { film_id: filmId });
        
        const raw = data.data || data;
        
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
        
        console.log(`✅ Filme: ${filme.titulo} | Video: ${filme.videoUrl ? 'SIM' : 'NÃO'}`);
        res.json({ filme });
        
    } catch (error) {
        res.status(500).json({ filme: null });
    }
});

// GET /api/canal/:id - Stream do canal
app.get('/api/canal/:id', async (req, res) => {
    try {
        const tvId = req.params.id;
        const data = await callApi('partner/content/playTelevision', { tv_id: tvId });
        
        const raw = data.data || data;
        let url = raw.stream_url || raw.url || raw.media_url || '';
        if (url && !url.startsWith('http')) url = 'http://' + url;
        
        const canal = {
            id: tvId,
            titulo: raw.title || '',
            videoUrl: url
        };
        
        console.log(`✅ Canal: ${canal.titulo} | Stream: ${canal.videoUrl ? 'SIM' : 'NÃO'}`);
        res.json({ canal });
        
    } catch (error) {
        res.status(500).json({ canal: null });
    }
});

// GET /api/buscar - Busca
app.get('/api/buscar', async (req, res) => {
    try {
        const q = req.query.q || '';
        if (!q) return res.json({ filmes: [] });
        
        const data = await callApi('app/search', { keyword: q, limit: 50 });
        
        let filmes = [];
        const rawData = data.data || data || [];
        
        if (Array.isArray(rawData)) {
            rawData.forEach(section => {
                if (section.lists && Array.isArray(section.lists)) {
                    section.lists.forEach(item => {
                        filmes.push({
                            id: item.id || item.film_id || '',
                            titulo: item.title || item.film_name || item.name || '',
                            thumb: item.thumb || item.cover || '',
                            ano: item.year || ''
                        });
                    });
                }
            });
        }
        
        console.log(`🔍 Busca "${q}": ${filmes.length} resultados`);
        res.json({ filmes });
        
    } catch (error) {
        res.status(500).json({ filmes: [] });
    }
});

// Rota principal - serve o HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Exportar para Vercel ou iniciar
if (process.env.VERCEL) {
    module.exports = app;
} else {
    app.listen(PORT, () => {
        console.log(`\n🚀 SERVIDOR RODANDO NA PORTA ${PORT}\n`);
        console.log(`📡 http://localhost:${PORT}\n`);
    });
}