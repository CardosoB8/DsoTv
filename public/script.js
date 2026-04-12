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
    
    document.querySelector('.categories-wrapper').addEventListener('click', (e) => {
        const categoryBtn = e.target.closest('.category-btn');
        if (categoryBtn) {
            selectCategory(categoryBtn.dataset.category);
        }
    });
    
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value;
        searchClear.style.display = term ? 'flex' : 'none';
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch(term);
        }, 500);
    });
    
    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchClear.style.display = 'none';
        currentSearchTerm = '';
        resetAndReload();
    });
    
    window.addEventListener('scroll', handleScroll);
    
    const modal = document.getElementById('playerModal');
    const closeBtn = document.getElementById('playerClose');
    
    closeBtn.addEventListener('click', closePlayer);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePlayer();
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePlayer();
    });
    
    document.getElementById('contentGrid').addEventListener('click', (e) => {
        const card = e.target.closest('.content-card');
        if (card) {
            const id = card.dataset.id;
            const title = card.dataset.title;
            if (!id || id === 'undefined') return;
            
            if (currentMode === 'movies') {
                playMovie(id, title);
            } else {
                playTVChannel(id, title);
            }
        }
    });
}

// ============= FUNÇÕES DE MODO =============
function switchMode(mode) {
    currentMode = mode;
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    const categoriesContainer = document.getElementById('categoriesContainer');
    categoriesContainer.style.display = mode === 'movies' ? 'block' : 'none';
    
    const grid = document.getElementById('contentGrid');
    grid.classList.toggle('tv-mode', mode === 'tv');
    
    resetAndReload();
}

function selectCategory(categoryId) {
    currentCategory = categoryId;
    
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === categoryId);
    });
    
    resetAndReload();
}

// ============= CARREGAMENTO DE CATEGORIAS =============
async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/categories`);
        const data = await response.json();
        
        // 🔥 CORREÇÃO BASEADA NO APK: data é um ARRAY direto!
        let categories = [];
        if (Array.isArray(data)) {
            categories = data;
        } else if (data.data && Array.isArray(data.data)) {
            categories = data.data;
        }
        
        if (categories.length > 0) {
            allCategories = categories;
            renderCategories(categories);
        }
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
}

function renderCategories(categories) {
    const wrapper = document.querySelector('.categories-wrapper');
    const defaultBtn = wrapper.querySelector('.category-btn');
    
    wrapper.innerHTML = '';
    wrapper.appendChild(defaultBtn);
    
    categories.forEach(category => {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        // 🔥 CORREÇÃO: Campos 'id' e 'name' (igual ao APK)
        btn.dataset.category = category.id;
        btn.innerHTML = `<i class="fas fa-folder"></i> ${category.name}`;
        wrapper.appendChild(btn);
    });
}

// ============= CARREGAMENTO DE CONTEÚDO =============
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
        
        const response = await fetch(url);
        const data = await response.json();
        
        // 🔥 CORREÇÃO BASEADA NO APK: data é um ARRAY direto!
        let items = [];
        if (Array.isArray(data)) {
            items = data;
        } else if (data.data && Array.isArray(data.data)) {
            items = data.data;
        }
        
        // 🔥 CORREÇÃO PARA SEARCH: estrutura diferente!
        if (currentSearchTerm && items.length === 0) {
            // Tenta extrair da estrutura de busca (lists dentro de sections)
            if (data.data) {
                data.data.forEach(section => {
                    if (section.lists && Array.isArray(section.lists)) {
                        items.push(...section.lists);
                    }
                });
            }
        }
        
        if (items.length === 0) {
            hasMore = false;
            showEndMessage(true);
        } else {
            renderContent(items, currentOffset === 0);
            currentOffset += items.length;
            
            if (items.length < limit) {
                hasMore = false;
                showEndMessage(true);
            }
        }
        
    } catch (error) {
        console.error('Erro ao carregar conteúdo:', error);
        showError('Erro ao carregar conteúdo');
    } finally {
        isLoading = false;
        showLoading(false);
    }
}

function renderContent(items, clearExisting = false) {
    const grid = document.getElementById('contentGrid');
    
    if (clearExisting) {
        grid.innerHTML = '';
    }
    
    items.forEach(item => {
        const card = createContentCard(item);
        if (card) grid.appendChild(card);
    });
}

function createContentCard(item) {
    // 🔥 CORREÇÃO: Campos exatos usados no APK!
    const id = item.id || '';
    const title = item.title || 'Sem título';
    
    if (!id) return null;
    
    const card = document.createElement('div');
    card.className = 'content-card';
    card.dataset.id = id;
    card.dataset.title = title;
    
    // 🔥 CORREÇÃO: thumb ou cover (igual ao APK)
    const thumbnail = item.thumb || item.cover || '';
    // 🔥 CORREÇÃO: year ou published_year
    const year = item.year || item.published_year || '';
    
    card.innerHTML = `
        <div class="card-thumbnail">
            ${thumbnail ? 
                `<img src="${thumbnail}" alt="${title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">` : 
                ''}
            <i class="fas fa-film fallback-icon" style="${thumbnail ? 'display: none;' : ''}"></i>
        </div>
        <div class="card-info">
            <h3 class="card-title">${title}</h3>
            ${year ? `
                <div class="card-meta">
                    <span class="card-year">
                        <i class="fas fa-calendar"></i> ${year}
                    </span>
                </div>
            ` : ''}
        </div>
    `;
    
    return card;
}

// ============= PLAYER =============
async function playMovie(id, title) {
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/movie/${id}`);
        const data = await response.json();
        
        // 🔥 CORREÇÃO: estrutura da resposta (data.data)
        const movieData = data.data || data;
        const videoUrl = movieData.media_url || movieData.video_url || '';
        
        if (videoUrl) {
            // 🔥 CORREÇÃO: substituir domínio (igual ao APK)
            let fixedUrl = videoUrl.replace('30fc87ca.vws.vegacdn.vn', 'free-media.movtv.co.mz');
            if (!fixedUrl.startsWith('http://') && !fixedUrl.startsWith('https://')) {
                fixedUrl = 'http://' + fixedUrl;
            }
            
            openPlayer(fixedUrl, title, movieData);
        } else {
            alert('Vídeo não disponível');
        }
    } catch (error) {
        console.error('Erro ao carregar filme:', error);
        alert('Erro ao carregar filme');
    } finally {
        showLoading(false);
    }
}

async function playTVChannel(id, title) {
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/tv/play/${id}`);
        const data = await response.json();
        
        // 🔥 CORREÇÃO: estrutura da resposta
        const tvData = data.data || data;
        let streamUrl = tvData.stream_url || tvData.url || tvData.media_url || '';
        
        if (streamUrl) {
            if (!streamUrl.startsWith('http://') && !streamUrl.startsWith('https://')) {
                streamUrl = 'http://' + streamUrl;
            }
            
            openPlayer(streamUrl, title, { ...tvData, year: 'AO VIVO' });
        } else {
            alert('Canal não disponível');
        }
    } catch (error) {
        console.error('Erro ao carregar canal:', error);
        alert('Erro ao carregar canal');
    } finally {
        showLoading(false);
    }
}

function openPlayer(url, title, details) {
    document.getElementById('playerTitle').textContent = title;
    
    player.src({
        src: url,
        type: url.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
    });
    
    const infoContainer = document.getElementById('playerInfo');
    
    let infoHtml = '<div class="info-grid">';
    
    if (details.year) {
        infoHtml += `
            <div class="info-item">
                <i class="fas fa-calendar"></i>
                <span>${details.year}</span>
            </div>
        `;
    }
    
    if (details.duration) {
        infoHtml += `
            <div class="info-item">
                <i class="fas fa-clock"></i>
                <span>${details.duration}</span>
            </div>
        `;
    }
    
    if (details.nation) {
        infoHtml += `
            <div class="info-item">
                <i class="fas fa-globe"></i>
                <span>${details.nation}</span>
            </div>
        `;
    }
    
    infoHtml += '</div>';
    
    if (details.description) {
        const desc = details.description.replace(/<[^>]*>/g, '');
        infoHtml += `<div class="synopsis"><strong>Sinopse:</strong> ${desc}</div>`;
    }
    
    infoContainer.innerHTML = infoHtml || '<p>Sem informações adicionais</p>';
    
    document.getElementById('playerModal').classList.add('active');
}

function closePlayer() {
    if (player) {
        player.pause();
        player.reset();
    }
    document.getElementById('playerModal').classList.remove('active');
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
    document.getElementById('contentGrid').innerHTML = '';
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
    const endMessage = document.getElementById('endMessage');
    if (endMessage) endMessage.style.display = show ? 'flex' : 'none';
}

function showError(message) {
    const grid = document.getElementById('contentGrid');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        grid-column: 1 / -1;
        text-align: center;
        padding: 40px;
        color: var(--text-secondary);
    `;
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="color: var(--accent); font-size: 48px; margin-bottom: 20px;"></i>
        <p>${message}</p>
    `;
    grid.appendChild(errorDiv);
}