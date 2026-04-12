// ============= CONFIGURAÇÕES GLOBAIS =============
const API_BASE = 'http://dsotv.vercel.app/api';
let player = null;
let currentMode = 'movies'; // 'movies' ou 'tv'
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
    // Inicializar Video.js player
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

function initEventListeners() {
    // Navegação entre modos
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });
    
    // Categorias (delegado)
    document.querySelector('.categories-wrapper').addEventListener('click', (e) => {
        const categoryBtn = e.target.closest('.category-btn');
        if (categoryBtn) {
            selectCategory(categoryBtn.dataset.category);
        }
    });
    
    // Busca com debounce
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value;
        
        // Mostrar/ocultar botão limpar
        searchClear.style.display = term ? 'flex' : 'none';
        
        // Debounce da busca
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
    
    // Modal do player
    const modal = document.getElementById('playerModal');
    const closeBtn = document.getElementById('playerClose');
    
    closeBtn.addEventListener('click', closePlayer);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePlayer();
    });
    
    // Tecla ESC fecha modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePlayer();
    });
    
    // Clique nos cards (delegado)
    document.getElementById('contentGrid').addEventListener('click', (e) => {
        const card = e.target.closest('.content-card');
        if (card) {
            const id = card.dataset.id;
            const title = card.dataset.title;
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
    
    // Atualizar botões ativos
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Mostrar/ocultar categorias
    const categoriesContainer = document.getElementById('categoriesContainer');
    categoriesContainer.style.display = mode === 'movies' ? 'block' : 'none';
    
    // Mudar layout do grid
    const grid = document.getElementById('contentGrid');
    grid.classList.toggle('tv-mode', mode === 'tv');
    
    // Resetar e recarregar
    resetAndReload();
}

function selectCategory(categoryId) {
    currentCategory = categoryId;
    
    // Atualizar botões ativos
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === categoryId);
    });
    
    resetAndReload();
}

// ============= CARREGAMENTO DE CONTEÚDO =============
async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/categories`);
        const data = await response.json();
        
        if (data.data && Array.isArray(data.data)) {
            allCategories = data.data;
            renderCategories(data.data);
        }
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
}

function renderCategories(categories) {
    const wrapper = document.querySelector('.categories-wrapper');
    const defaultBtn = wrapper.querySelector('.category-btn'); // Botão "Todos"
    
    // Limpar categorias existentes (exceto "Todos")
    wrapper.innerHTML = '';
    wrapper.appendChild(defaultBtn);
    
    // Adicionar novas categorias
    categories.forEach(category => {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.dataset.category = category.category_id || category.id;
        btn.innerHTML = `<i class="fas fa-folder"></i> ${category.category_name || category.name}`;
        wrapper.appendChild(btn);
    });
}

async function loadContent() {
    if (isLoading || !hasMore) return;
    
    isLoading = true;
    showLoading(true);
    
    try {
        let url;
        const limit = 50;
        
        if (currentSearchTerm) {
            // Modo busca
            url = `${API_BASE}/search?q=${encodeURIComponent(currentSearchTerm)}&limit=${limit}`;
        } else if (currentMode === 'movies') {
            // Modo filmes
            if (currentCategory === 'all') {
                url = `${API_BASE}/movies?limit=${limit}&offset=${currentOffset}`;
            } else {
                url = `${API_BASE}/movies/category/${currentCategory}?limit=${limit}&offset=${currentOffset}`;
            }
        } else {
            // Modo TV
            url = `${API_BASE}/tv?limit=200&offset=${currentOffset}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.data && Array.isArray(data.data)) {
            const items = data.data;
            
            if (items.length === 0 || (currentMode === 'movies' && items.length < limit)) {
                hasMore = false;
                showEndMessage(true);
            }
            
            renderContent(items, currentOffset === 0);
            currentOffset += items.length;
        } else {
            hasMore = false;
            showEndMessage(true);
        }
    } catch (error) {
        console.error('Erro ao carregar conteúdo:', error);
        showError('Erro ao carregar conteúdo. Tente novamente.');
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
        grid.appendChild(card);
    });
}

function createContentCard(item) {
    const card = document.createElement('div');
    card.className = 'content-card';
    card.dataset.id = item.film_id || item.tv_id || item.id;
    card.dataset.title = item.film_name || item.tv_name || item.name || item.title;
    
    const thumbnail = item.thumb || item.cover || item.thumbnail || '';
    const title = item.film_name || item.tv_name || item.name || item.title || 'Sem título';
    const year = item.release_year || item.year || '';
    
    card.innerHTML = `
        <div class="card-thumbnail">
            ${thumbnail ? 
                `<img src="${thumbnail}" alt="${title}" onerror="this.classList.add('error'); this.nextElementSibling.style.display='block';">` : 
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
                    ${item.rating ? `
                        <span class="card-rating">
                            <i class="fas fa-star"></i> ${item.rating}
                        </span>
                    ` : ''}
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
        
        if (data.data && data.data.video_url) {
            openPlayer(data.data.video_url, title, data.data);
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
        
        if (data.data && data.data.stream_url) {
            openPlayer(data.data.stream_url, title, data.data);
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
    // Atualizar título
    document.getElementById('playerTitle').textContent = title;
    
    // Configurar player
    player.src({
        src: url,
        type: url.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
    });
    
    // Atualizar informações
    const infoContainer = document.getElementById('playerInfo');
    
    let infoHtml = '<div class="info-grid">';
    
    if (details.release_year || details.year) {
        infoHtml += `
            <div class="info-item">
                <i class="fas fa-calendar"></i>
                <span>${details.release_year || details.year}</span>
            </div>
        `;
    }
    
    if (details.duration) {
        infoHtml += `
            <div class="info-item">
                <i class="fas fa-clock"></i>
                <span>${details.duration} min</span>
            </div>
        `;
    }
    
    if (details.country) {
        infoHtml += `
            <div class="info-item">
                <i class="fas fa-globe"></i>
                <span>${details.country}</span>
            </div>
        `;
    }
    
    infoHtml += '</div>';
    
    if (details.description || details.synopsis) {
        infoHtml += `
            <div class="synopsis">
                <strong>Sinopse:</strong> ${details.description || details.synopsis}
            </div>
        `;
    }
    
    infoContainer.innerHTML = infoHtml || '<p>Sem informações adicionais</p>';
    
    // Abrir modal
    document.getElementById('playerModal').classList.add('active');
}

function closePlayer() {
    player.pause();
    player.reset();
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
    
    // Carregar mais quando estiver a 200px do final
    if (scrollTop + windowHeight >= documentHeight - 200) {
        if (!isLoading && hasMore && !currentSearchTerm) {
            loadContent();
        }
    }
}

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    spinner.style.display = show ? 'flex' : 'none';
}

function showEndMessage(show) {
    const endMessage = document.getElementById('endMessage');
    endMessage.style.display = show ? 'flex' : 'none';
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