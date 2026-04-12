// ============= CONFIGURAÇÕES GLOBAIS =============
const API_BASE = '/api';
let player = null;
let currentMode = 'movies';
let currentCategory = 'all';
let currentOffset = 0;
let isLoading = false;
let hasMore = true;
let searchTimeout = null;
let currentSearchTerm = '';
let allCategories = [];

// ============= INICIALIZAÇÃO =============
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 MOVTV PLAYER v2 - Inicializando...');
    initApp();
    initEventListeners();
    loadCategories();
    loadContent();
});

function initApp() {
    if (typeof videojs !== 'undefined') {
        player = videojs('videoPlayer', {
            controls: true,
            autoplay: false,
            preload: 'auto',
            fluid: true,
            playbackRates: [0.5, 1, 1.5, 2],
            controlBar: {
                pictureInPictureToggle: true,
                fullscreenToggle: true
            }
        });
    }
}

function initEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });
    
    const wrapper = document.querySelector('.categories-wrapper');
    if (wrapper) {
        wrapper.addEventListener('click', (e) => {
            const btn = e.target.closest('.category-btn');
            if (btn) selectCategory(btn.dataset.category);
        });
    }
    
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value;
            if (searchClear) searchClear.style.display = term ? 'flex' : 'none';
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => performSearch(term), 500);
        });
    }
    
    if (searchClear) {
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.style.display = 'none';
            currentSearchTerm = '';
            resetAndReload();
        });
    }
    
    window.addEventListener('scroll', handleScroll);
    
    const modal = document.getElementById('playerModal');
    const closeBtn = document.getElementById('playerClose');
    
    if (closeBtn) closeBtn.addEventListener('click', closePlayer);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closePlayer();
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePlayer();
    });
    
    const grid = document.getElementById('contentGrid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.content-card');
            if (card && card.dataset.id) {
                if (currentMode === 'movies') {
                    playMovie(card.dataset.id, card.dataset.title);
                } else {
                    playTVChannel(card.dataset.id, card.dataset.title);
                }
            }
        });
    }
}

// ============= MODO =============
function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    const catContainer = document.getElementById('categoriesContainer');
    if (catContainer) catContainer.style.display = mode === 'movies' ? 'block' : 'none';
    
    const grid = document.getElementById('contentGrid');
    if (grid) grid.classList.toggle('tv-mode', mode === 'tv');
    
    resetAndReload();
}

function selectCategory(id) {
    currentCategory = id;
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === id);
    });
    resetAndReload();
}

// ============= CATEGORIAS =============
async function loadCategories() {
    try {
        const res = await fetch(`${API_BASE}/categories`);
        const data = await res.json();
        
        console.log('📁 Categorias:', data);
        
        // 🔥 CORREÇÃO: data.data é o array (APK)
        let categories = data.data || data || [];
        if (!Array.isArray(categories)) categories = [];
        
        if (categories.length > 0) {
            allCategories = categories;
            renderCategories(categories);
        }
    } catch (e) {
        console.error('Erro categorias:', e);
    }
}

function renderCategories(categories) {
    const wrapper = document.querySelector('.categories-wrapper');
    if (!wrapper) return;
    
    // Mantém o botão "Todos"
    const allBtn = wrapper.querySelector('.category-btn[data-category="all"]');
    wrapper.innerHTML = '';
    if (allBtn) {
        wrapper.appendChild(allBtn.cloneNode(true));
    } else {
        const btn = document.createElement('button');
        btn.className = 'category-btn active';
        btn.dataset.category = 'all';
        btn.innerHTML = '<i class="fas fa-star"></i> Todos';
        wrapper.appendChild(btn);
    }
    
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        // 🔥 CORREÇÃO: campos 'id' e 'name' (APK)
        btn.dataset.category = cat.id || cat.category_id;
        btn.innerHTML = `<i class="fas fa-folder"></i> ${cat.name || cat.category_name}`;
        wrapper.appendChild(btn);
    });
}

// ============= CONTEÚDO =============
async function loadContent() {
    if (isLoading || !hasMore) return;
    
    isLoading = true;
    showLoading(true);
    
    try {
        let url;
        const limit = 50;
        
        if (currentSearchTerm) {
            url = `${API_BASE}/search?q=${encodeURIComponent(currentSearchTerm)}&limit=100`;
        } else if (currentMode === 'movies') {
            if (currentCategory === 'all') {
                url = `${API_BASE}/movies?limit=${limit}&offset=${currentOffset}`;
            } else {
                url = `${API_BASE}/movies/category/${currentCategory}?limit=${limit}&offset=${currentOffset}`;
            }
        } else {
            url = `${API_BASE}/tv?limit=200&offset=${currentOffset}`;
        }
        
        console.log('🌐 URL:', url);
        
        const res = await fetch(url);
        const data = await res.json();
        
        console.log('📦 Resposta:', data);
        
        // 🔥 CORREÇÃO BASEADA NO APK:
        // A API retorna { data: [...] } ou diretamente [...]
        let items = data.data || data || [];
        
        // Se for objeto com outras propriedades, tenta encontrar array
        if (!Array.isArray(items)) {
            console.log('🔍 Procurando array em:', Object.keys(items));
            // Tenta encontrar qualquer array
            for (const key of Object.keys(items)) {
                if (Array.isArray(items[key])) {
                    items = items[key];
                    console.log('✅ Array encontrado em:', key);
                    break;
                }
            }
        }
        
        // Se ainda não for array, define como vazio
        if (!Array.isArray(items)) {
            console.error('❌ Não foi possível encontrar array de itens');
            items = [];
        }
        
        console.log('📺 Itens encontrados:', items.length);
        
        if (items.length > 0) {
            console.log('📋 Primeiro item:', items[0]);
            renderContent(items, currentOffset === 0);
            currentOffset += items.length;
            
            if (items.length < limit) {
                hasMore = false;
                showEndMessage(true);
            }
        } else {
            console.log('❌ Nenhum item');
            hasMore = false;
            showEndMessage(true);
        }
        
    } catch (e) {
        console.error('❌ Erro:', e);
        showError('Erro ao carregar');
    } finally {
        isLoading = false;
        showLoading(false);
    }
}

function renderContent(items, clear) {
    const grid = document.getElementById('contentGrid');
    if (!grid) return;
    
    if (clear) grid.innerHTML = '';
    
    items.forEach(item => {
        const card = createCard(item);
        if (card) grid.appendChild(card);
    });
    
    console.log('✅ Grid atualizado');
}

function createCard(item) {
    // 🔥 CORREÇÃO: campos exatos do APK
    const id = item.id || item.film_id || item.tv_id;
    const title = item.title || item.film_name || item.tv_name || item.name;
    const thumb = item.thumb || item.cover || item.thumbnail || item.logo;
    const year = item.year || item.release_year || item.published_year;
    
    if (!id) {
        console.warn('⚠️ Item sem ID:', item);
        return null;
    }
    
    const card = document.createElement('div');
    card.className = 'content-card';
    card.dataset.id = id;
    card.dataset.title = title || 'Sem título';
    
    card.innerHTML = `
        <div class="card-thumbnail">
            ${thumb ? `<img src="${thumb}" alt="${title || ''}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">` : ''}
            <i class="fas fa-film fallback-icon" style="${thumb ? 'display: none;' : ''}"></i>
        </div>
        <div class="card-info">
            <h3 class="card-title">${title || 'Sem título'}</h3>
            ${year ? `<div class="card-meta"><span class="card-year"><i class="fas fa-calendar"></i> ${year}</span></div>` : ''}
        </div>
    `;
    
    return card;
}

// ============= PLAYER =============
async function playMovie(id, title) {
    try {
        showLoading(true);
        const res = await fetch(`${API_BASE}/movie/${id}`);
        const data = await res.json();
        
        console.log('🎬 Filme:', data);
        
        const movie = data.data || data;
        // 🔥 CORREÇÃO: media_url (APK)
        let url = movie.media_url || movie.video_url || movie.url;
        
        if (url) {
            url = url.replace('30fc87ca.vws.vegacdn.vn', 'free-media.movtv.co.mz');
            if (!url.startsWith('http')) url = 'http://' + url;
            
            openPlayer(url, title, movie);
        } else {
            alert('Vídeo não disponível');
        }
    } catch (e) {
        console.error('Erro:', e);
        alert('Erro ao carregar filme');
    } finally {
        showLoading(false);
    }
}

async function playTVChannel(id, title) {
    try {
        showLoading(true);
        const res = await fetch(`${API_BASE}/tv/play/${id}`);
        const data = await res.json();
        
        console.log('📺 Canal:', data);
        
        const tv = data.data || data;
        let url = tv.stream_url || tv.url || tv.media_url;
        
        if (url) {
            if (!url.startsWith('http')) url = 'http://' + url;
            openPlayer(url, title, { ...tv, year: 'AO VIVO' });
        } else {
            alert('Canal não disponível');
        }
    } catch (e) {
        console.error('Erro:', e);
        alert('Erro ao carregar canal');
    } finally {
        showLoading(false);
    }
}

function openPlayer(url, title, details) {
    const titleEl = document.getElementById('playerTitle');
    if (titleEl) titleEl.textContent = title;
    
    if (player) {
        player.src({
            src: url,
            type: url.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
        });
    }
    
    const info = document.getElementById('playerInfo');
    if (info) {
        let html = '<div class="info-grid">';
        if (details.year) html += `<div class="info-item"><i class="fas fa-calendar"></i><span>${details.year}</span></div>`;
        if (details.duration) html += `<div class="info-item"><i class="fas fa-clock"></i><span>${details.duration}</span></div>`;
        if (details.nation) html += `<div class="info-item"><i class="fas fa-globe"></i><span>${details.nation}</span></div>`;
        html += '</div>';
        if (details.description) {
            html += `<div class="synopsis"><strong>Sinopse:</strong> ${details.description.replace(/<[^>]*>/g, '')}</div>`;
        }
        info.innerHTML = html || '<p>Sem informações</p>';
    }
    
    const modal = document.getElementById('playerModal');
    if (modal) modal.classList.add('active');
}

function closePlayer() {
    if (player) {
        player.pause();
        player.reset();
    }
    const modal = document.getElementById('playerModal');
    if (modal) modal.classList.remove('active');
}

// ============= BUSCA =============
function performSearch(term) {
    currentSearchTerm = term;
    resetAndReload();
}

// ============= UTILITÁRIOS =============
function resetAndReload() {
    currentOffset = 0;
    hasMore = true;
    const grid = document.getElementById('contentGrid');
    if (grid) grid.innerHTML = '';
    showEndMessage(false);
    loadContent();
}

function handleScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    if (scrollTop + windowHeight >= documentHeight - 200) {
        if (!isLoading && hasMore && !currentSearchTerm) {
            loadContent();
        }
    }
}

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = show ? 'flex' : 'none';
}

function showEndMessage(show) {
    const msg = document.getElementById('endMessage');
    if (msg) msg.style.display = show ? 'flex' : 'none';
}

function showError(msg) {
    const grid = document.getElementById('contentGrid');
    if (grid) {
        const div = document.createElement('div');
        div.style.cssText = 'grid-column:1/-1;text-align:center;padding:40px;color:#B0BEC5;';
        div.innerHTML = `<i class="fas fa-exclamation-triangle" style="color:#E50914;font-size:48px;"></i><p>${msg}</p>`;
        grid.appendChild(div);
    }
}

console.log('✅ Script v2 carregado!');