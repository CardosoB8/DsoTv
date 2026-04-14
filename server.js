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
    
    console.log(`API: ${endpoint}`);
    
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

// ============= NOVOS CANAIS IPTV (COM LOGOS LIMPOS) =============
const canaisIPTV = [
    { nome: "Cartoon Network", url: "https://stm.sinalmycn.com/24003/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/Cartoon%20Network.png", categoria: "infantil" },
    { nome: "TNT", url: "https://stm.sinalmycn.com/13039/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/TNT.png", categoria: "filmes-series" },
    { nome: "ESPN", url: "https://stm.sinalmycn.com/22001/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/ESPN.png", categoria: "esportes" },
    { nome: "ESPN 2", url: "https://stm.sinalmycn.com/22004/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/ESPN2.png", categoria: "esportes" },
    { nome: "ESPN 3", url: "https://stm.sinalmycn.com/22007/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/ESPN3.png", categoria: "esportes" },
    { nome: "ESPN 4", url: "https://stm.sinalmycn.com/22010/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/ESPN4.png", categoria: "esportes" },
    { nome: "ESPN 5", url: "https://stm.sinalmycn.com/22013/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/ESPN5.png", categoria: "esportes" },
    { nome: "ESPN 6", url: "https://stm.sinalmycn.com/22016/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/ESPN6.png", categoria: "esportes" },
    { nome: "Band Sports", url: "https://stm.sinalmycn.com/19001/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Premiere 1", url: "https://stm.sinalmycn.com/20000/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Premiere 2", url: "https://stm.sinalmycn.com/20003/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Premiere 3", url: "https://stm.sinalmycn.com/20006/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Premiere 4", url: "https://stm.sinalmycn.com/20010/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Premiere 5", url: "https://stm.sinalmycn.com/20012/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Premiere 6", url: "https://stm.sinalmycn.com/20015/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Premiere 7", url: "https://stm.sinalmycn.com/20018/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Premiere 8", url: "https://stm.sinalmycn.com/20022/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Caze TV 1", url: "https://stm.sinalmycn.com/19068/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Caze TV 2", url: "https://stm.sinalmycn.com/19069/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Paramount+ 1", url: "https://stm.sinalmycn.com/19071/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Paramount+ 2", url: "https://stm.sinalmycn.com/19072/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Paramount+ 3", url: "https://stm.sinalmycn.com/19073/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Paramount+ 4", url: "https://stm.sinalmycn.com/19074/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Nosso Futebol 1", url: "https://stm.sinalmycn.com/19024/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Nosso Futebol 2", url: "https://stm.sinalmycn.com/19025/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "Nosso Futebol 3", url: "https://stm.sinalmycn.com/19026/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "esportes" },
    { nome: "CNN Brasil", url: "https://stm.sinalmycn.com/25005/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/CNN.png", categoria: "noticias" },
    { nome: "Band News", url: "https://stm.sinalmycn.com/25001/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "noticias" },
    { nome: "Globo News", url: "https://stm.sinalmycn.com/25007/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "noticias" },
    { nome: "JP News", url: "https://stm.sinalmycn.com/25022/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "noticias" },
    { nome: "SBT News", url: "https://stm.sinalmycn.com/25022/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "noticias" },
    { nome: "Discovery", url: "https://stm.sinalmycn.com/23030/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "documentario" },
    { nome: "Discovery World", url: "https://stm.sinalmycn.com/23018/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "documentario" },
    { nome: "Discovery Theater", url: "https://stm.sinalmycn.com/23015/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "documentario" },
    { nome: "Discovery Channel", url: "https://stm.sinalmycn.com/23009/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "documentario" },
    { nome: "Discovery Science", url: "https://stm.sinalmycn.com/23012/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/Discovery%20Science.png", categoria: "documentario" },
    { nome: "Discovery H&H", url: "https://stm.sinalmycn.com/12012/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "documentario" },
    { nome: "Discovery Turbo", url: "https://stm.sinalmycn.com/12015/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "documentario" },
    { nome: "History", url: "https://stm.sinalmycn.com/23027/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "documentario" },
    { nome: "Animal Planet", url: "https://stm.sinalmycn.com/23000/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/Animal%20Planet.png", categoria: "documentario" },
    { nome: "Gloob", url: "https://stm.sinalmycn.com/24015/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "infantil" },
    { nome: "Box Kids", url: "https://stm.sinalmycn.com/24000/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "infantil" },
    { nome: "Discovery Kids", url: "https://stm.sinalmycn.com/24009/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "infantil" },
    { nome: "Cartoonito", url: "https://stm.sinalmycn.com/24006/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "infantil" },
    { nome: "Nicktoon", url: "https://stmv2.srvif.com/nicktoons/nicktoons/playlist.m3u8", logo: "", categoria: "infantil" },
    { nome: "HBO", url: "https://stm.sinalmycn.com/14000/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/HBO.png", categoria: "filmes-series" },
    { nome: "HBO 2", url: "https://stm.sinalmycn.com/14003/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/HBO%202.png", categoria: "filmes-series" },
    { nome: "HBO Family", url: "https://stm.sinalmycn.com/14006/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/HBO%20Family.png", categoria: "filmes-series" },
    { nome: "HBO Signature", url: "https://stm.sinalmycn.com/14018/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/HBO%20Signature.png", categoria: "filmes-series" },
    { nome: "HBO Plus", url: "https://stm.sinalmycn.com/14012/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/HBO%20Plus.png", categoria: "filmes-series" },
    { nome: "HBO Mundi", url: "https://stm.sinalmycn.com/14009/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/HBO%20Mundi.png", categoria: "filmes-series" },
    { nome: "HBO Pop", url: "https://stm.sinalmycn.com/14015/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/HBO%20Pop.png", categoria: "filmes-series" },
    { nome: "HBO Xtreme", url: "https://stm.sinalmycn.com/14021/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/HBO%20Xtreme.png", categoria: "filmes-series" },
    { nome: "Space", url: "https://stm.sinalmycn.com/13027/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/SPACE.png", categoria: "filmes-series" },
    { nome: "Warner Channel", url: "https://stm.sinalmycn.com/13051/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/Warner%20Channel.png", categoria: "filmes-series" },
    { nome: "Sony Channel", url: "https://stm.sinalmycn.com/13021/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "filmes-series" },
    { nome: "Sony Movies", url: "https://stm.sinalmycn.com/13024/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "filmes-series" },
    { nome: "AXN", url: "https://stm.sinalmycn.com/13003/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/AXN.png", categoria: "filmes-series" },
    { nome: "AMC", url: "https://stm.sinalmycn.com/13000/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "filmes-series" },
    { nome: "A&E", url: "https://stm.sinalmycn.com/12000/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "filmes-series" },
    { nome: "Cinemax", url: "https://stm.sinalmycn.com/13009/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/Cinemax.png", categoria: "filmes-series" },
    { nome: "Studio Universal", url: "https://stm.sinalmycn.com/13048/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/Studio%20Universal.png", categoria: "filmes-series" },
    { nome: "TNT Novelas", url: "https://stm.sinalmycn.com/13036/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "variedades" },
    { nome: "Globoplay Novelas", url: "https://stm.sinalmycn.com/12060/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "variedades" },
    { nome: "Multishow", url: "https://stm.sinalmycn.com/12045/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "https://piratetv.app/wp-content/themes/piratetv5v/assets/images/canais/Multishow.png", categoria: "variedades" },
    { nome: "Food Network", url: "https://stm.sinalmycn.com/12024/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0", logo: "", categoria: "variedades" },
    { nome: "Novelissima", url: "https://cis-no-samsung.otteravision.com/cis/no/no_h265.m3u8", logo: "", categoria: "variedades" }
];

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
            titulo: item.title || 'Sem titulo',
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

app.get('/api/canais-movtv', async (req, res) => {
    try {
        const cached = getCached('canais-movtv');
        if (cached) return res.json(cached);
        
        const data = await callApi('partner/content/getAllTV', { limit: 200 });
        const canais = (data.data || []).map(canal => ({
            id: canal.id,
            titulo: canal.title || 'Sem nome',
            thumb: canal.thumb || ''
        }));
        
        const result = { canais };
        setCached('canais-movtv', result);
        res.json(result);
    } catch (e) {
        res.json({ canais: [] });
    }
});

app.get('/api/canais-iptv', (req, res) => {
    res.json({ canais: canaisIPTV });
});

app.get('/api/filme/:id', async (req, res) => {
    try {
        const filmId = req.params.id;
        const data = await callApi('partner/content/getFilmDetail', { film_id: filmId });
        
        const raw = data.data || {};
        let videoUrl = raw.media_url || '';
        
        if (videoUrl) {
            videoUrl = videoUrl.replace('30fc87ca.vws.vegacdn.vn', 'free-media.movtv.co.mz');
            if (!videoUrl.startsWith('http')) videoUrl = 'http://' + videoUrl;
        }
        
        const atores = (raw.actors || []).map(a => a.title || a.name).filter(Boolean);
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

app.get('/api/canal-movtv/:id', async (req, res) => {
    try {
        const tvId = req.params.id;
        const data = await callApi('partner/content/playTelevision', { tv_id: tvId });
        
        const raw = data.data || {};
        let videoUrl = raw.media_url || raw.stream_url || raw.url || '';
        
        if (videoUrl && !videoUrl.startsWith('http')) {
            videoUrl = 'http://' + videoUrl;
        }
        
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

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.VERCEL) {
    module.exports = app;
} else {
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
}