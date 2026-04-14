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
    
    console.log('📤 URL:', url.substring(0, 150) + '...');
    
    try {
        // Tenta com axios (mais robusto)
        const response = await axios.get(url, {
            headers: {
                'X-Api-Key': 'bigzun.com',
                'Device-Id': DEVICE_ID,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Connection': 'keep-alive'
            },
            timeout: 30000
        });
        
        console.log('✅ Resposta recebida:', response.data.code);
        return { data: response.data, debug: { url, response: JSON.stringify(response.data).substring(0, 300) } };
        
    } catch (error) {
        console.error('❌ Erro axios:', error.message);
        
        // Fallback para fetch
        try {
            const res = await fetch(url, {
                headers: {
                    'X-Api-Key': 'bigzun.com',
                    'Device-Id': DEVICE_ID,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            const data = await res.json();
            return { data, debug: { url, response: JSON.stringify(data).substring(0, 300) } };
        } catch (e2) {
            throw new Error(`Axios: ${error.message}, Fetch: ${e2.message}`);
        }
    }
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

// ... (outros endpoints similares)

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.VERCEL) {
    module.exports = app;
} else {
    app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
}