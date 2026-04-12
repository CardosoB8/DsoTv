// ============= CONFIGURAÇÕES GLOBAIS =============
const API_BASE = '/api'; // MUDADO para caminho relativo
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
    console.log('🚀 Inicializando MOVTV Player...');
    initApp();
    initEventListeners();
    loadCategories();
    loadContent();
});

function initApp() {
    // Verificar se Video.js está disponível
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
        console.log('✅ Video.js inicializado');
    } else {
        console.warn('⚠️ Video.js não carregado');
    }
}

function initEventListeners() {
    console.log('🔧 Configurando event listeners...');
    
    // Navegação entre modos
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });
    
    // Categorias
    document.querySelector('.categories-wrapper').addEventListener('click', (e) => {
        const categoryBtn = e.target.closest('.category-btn');
        if (categoryBtn) {
            selectCategory(categoryBtn.dataset.category);
        }
    });
    
    // Busca
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
    
    // Scroll infinito
    window.addEventListener('scroll', handleScroll);
    
    // Modal
    const modal = document.getElementById('playerModal');
    const closeBtn = document.getElementById('playerClose');
    
    closeBtn.addEventListener('click', closePlayer);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePlayer();
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePlayer();
    });
    
    // Cards
    document.getElementById('contentGrid').addEventListener('click', (e) => {
        const card = e.target.closest('.content-card');
        if (card) {
            const id = card.dataset.id;
            const title = card.dataset.title;
            
            if (!id || id === 'undefined') {
                console.error('❌ ID inválido');
                return;
            }
            
            if (currentMode === 'movies') {
                playMovie(id, title);
            } else {
                playTVChannel(id, title);
            }
        }
    });
    
    console.log('✅ Event listeners configurados');
}

// ============= FUNÇÕES PRINCIPAIS =============
async function loadContent() {
    if (isLoading || !hasMore) return;
    
    isLoading = true;
    showLoading(true);
    
    try {
        let url;
        const limit = 50;
        
        if (currentSearchTerm) {
            url = `${API_BASE}/search?q=${encodeURIComponent(currentSearchTerm)}&limit=${limit}`;
        } else if (currentMode === 'movies') {
            if (currentCategory === 'all') {
                url = `${API_BASE}/movies?limit=${limit}&offset=${currentOffset}`;
            } else {
                url = `${API_BASE}/movies/category/${currentCategory}?limit=${limit}&offset=${currentOffset}`;
            }
        } else {
            url = `${API_BASE}/tv?limit=200&offset=${currentOffset}`;
        }
        
        console.log('🌐 Carregando:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('📦 Resposta da API:', data);
        
        // Extrair items da resposta
        let items = [];
        if (data && data.data) {
            if (Array.isArray(data.data)) {
                items = data.data;
            } else if (data.data.data && Array.isArray(data.data.data)) {
                items = data.data.data;
            } else if (data.data.films) {
                items = data.data.films;
            } else if (data.data.channels) {
                items = data.data.channels;
            }
        } else if (Array.isArray(data)) {
            items = data;
        }
        
        console.log(`📺 ${items.length} itens carregados`);
        
        if (items.length > 0) {
            renderContent(items, currentOffset === 0);
            currentOffset += items.length;
        }
        
        if (items.length === 0 || items.length < limit) {
            hasMore = false;
            showEndMessage(true);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
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
    
    console.log(`🎨 Grid atualizado com ${items.length} cards`);
}

function createContentCard(item) {
    const id = item.film_id || item.tv_id || item.id;
    const title = item.film_name || item.tv_name || item.name || item.title;
    
    if (!title) return null;
    
    const card = document.createElement('div');
    card.className = 'content-card';
    if (id) card.dataset.id = id;
    card.dataset.title = title;
    
    const thumbnail = item.thumb || item.cover || item.thumbnail || '';
    const year = item.release_year || item.year || '';
    
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

// ... (copie o resto das funções do script original: switchMode, selectCategory, etc.)

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = show ? 'flex' : 'none';
}

function showEndMessage(show) {
    const msg = document.getElementById('endMessage');
    if (msg) msg.style.display = show ? 'flex' : 'none';
}

function showError(message) {
    const grid = document.getElementById('contentGrid');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 40px;';
    errorDiv.innerHTML = `<p>${message}</p>`;
    grid.appendChild(errorDiv);
}