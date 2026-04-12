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
    console.log('🚀 MOVTV PLAYER - Inicializando...');
    console.log('📍 API_BASE:', API_BASE);
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
        console.log('✅ Video.js inicializado');
    } else {
        console.warn('⚠️ Video.js não carregado');
    }
}

function initEventListeners() {
    console.log('🔧 Configurando event listeners...');
    
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
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value;
            searchClear.style.display = term ? 'flex' : 'none';
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch(term);
            }, 500);
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
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closePlayer);
    }
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
            if (card) {
                const id = card.dataset.id;
                const title = card.dataset.title;
                console.log('🖱️ Card clicado:', title, 'ID:', id);
                
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
    }
    
    console.log('✅ Event listeners configurados');
}

// ============= FUNÇÕES DE MODO =============
function switchMode(mode) {
    console.log('🔄 Mudando modo para:', mode);
    currentMode = mode;
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    const categoriesContainer = document.getElementById('categoriesContainer');
    if (categoriesContainer) {
        categoriesContainer.style.display = mode === 'movies' ? 'block' : 'none';
    }
    
    const grid = document.getElementById('contentGrid');
    if (grid) {
        grid.classList.toggle('tv-mode', mode === 'tv');
    }
    
    resetAndReload();
}

function selectCategory(categoryId) {
    console.log('📂 Categoria selecionada:', categoryId);
    currentCategory = categoryId;
    
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === categoryId);
    });
    
    resetAndReload();
}

// ============= CARREGAMENTO DE CATEGORIAS =============
async function loadCategories() {
    console.log('📁 Carregando categorias...');
    try {
        const response = await fetch(`${API_BASE}/categories`);
        const data = await response.json();
        
        console.log('📦 Categorias - resposta bruta:', data);
        
        let categories = [];
        if (Array.isArray(data)) {
            categories = data;
            console.log('✅ Categorias extraídas (data é array)');
        } else if (data.data && Array.isArray(data.data)) {
            categories = data.data;
            console.log('✅ Categorias extraídas (data.data é array)');
        } else {
            console.log('❌ Formato de categorias desconhecido. Procurando...');
            const findArray = (obj, path = '') => {
                if (!obj || typeof obj !== 'object') return;
                Object.keys(obj).forEach(key => {
                    const fullPath = path ? `${path}.${key}` : key;
                    const value = obj[key];
                    if (Array.isArray(value)) {
                        console.log(`🔍 Array encontrado em: ${fullPath} (${value.length} itens)`);
                        if (value.length > 0) {
                            console.log('   Primeiro item:', value[0]);
                        }
                    }
                });
            };
            findArray(data);
        }
        
        console.log('📁 Total de categorias:', categories.length);
        
        if (categories.length > 0) {
            allCategories = categories;
            renderCategories(categories);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar categorias:', error);
    }
}

function renderCategories(categories) {
    console.log('🎨 Renderizando categorias...');
    const wrapper = document.querySelector('.categories-wrapper');
    const defaultBtn = wrapper.querySelector('.category-btn');
    
    wrapper.innerHTML = '';
    if (defaultBtn) {
        wrapper.appendChild(defaultBtn.cloneNode(true));
    } else {
        const btn = document.createElement('button');
        btn.className = 'category-btn active';
        btn.dataset.category = 'all';
        btn.innerHTML = '<i class="fas fa-star"></i> Todos';
        wrapper.appendChild(btn);
    }
    
    categories.forEach(category => {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.dataset.category = category.id || category.category_id || category.cat_id;
        btn.innerHTML = `<i class="fas fa-folder"></i> ${category.name || category.category_name || category.title || 'Sem nome'}`;
        wrapper.appendChild(btn);
    });
    
    console.log('✅ Categorias renderizadas:', categories.length);
}

// ============= CARREGAMENTO DE CONTEÚDO =============
async function loadContent() {
    console.log('📺 loadContent() - isLoading:', isLoading, 'hasMore:', hasMore);
    
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
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('📦 Dados brutos recebidos:', data);
        console.log('📦 Tipo dos dados:', typeof data);
        console.log('📦 É array?', Array.isArray(data));
        
        if (data.data) {
            console.log('📦 data.data existe?', !!data.data);
            console.log('📦 data.data é array?', Array.isArray(data.data));
            if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
                console.log('📦 Chaves de data.data:', Object.keys(data.data));
            }
        }
        
        // Tenta extrair items
        let items = [];
        
        if (Array.isArray(data)) {
            items = data;
            console.log('✅ Items extraídos (data é array)');
        } else if (data.data && Array.isArray(data.data)) {
            items = data.data;
            console.log('✅ Items extraídos (data.data é array)');
        } else if (data.data && data.data.data && Array.isArray(data.data.data)) {
            items = data.data.data;
            console.log('✅ Items extraídos (data.data.data é array)');
        } else if (data.data && data.data.films && Array.isArray(data.data.films)) {
            items = data.data.films;
            console.log('✅ Items extraídos (data.data.films)');
        } else if (data.data && data.data.items && Array.isArray(data.data.items)) {
            items = data.data.items;
            console.log('✅ Items extraídos (data.data.items)');
        } else if (data.result && Array.isArray(data.result)) {
            items = data.result;
            console.log('✅ Items extraídos (data.result)');
        } else if (data.data && data.data.lists) {
            // Estrutura de busca
            console.log('🔍 Verificando estrutura de busca (lists)...');
            if (Array.isArray(data.data.lists)) {
                items = data.data.lists;
            } else if (Array.isArray(data.data)) {
                data.data.forEach(section => {
                    if (section.lists && Array.isArray(section.lists)) {
                        items.push(...section.lists);
                    }
                });
            }
            console.log('✅ Items extraídos da busca:', items.length);
        } else {
            console.log('❌ Nenhum formato conhecido. Procurando arrays...');
            
            const findArrays = (obj, path = '') => {
                if (!obj || typeof obj !== 'object') return;
                
                Object.keys(obj).forEach(key => {
                    const fullPath = path ? `${path}.${key}` : key;
                    const value = obj[key];
                    
                    if (Array.isArray(value)) {
                        console.log(`🔍 Array encontrado em: ${fullPath} (${value.length} itens)`);
                        if (value.length > 0) {
                            console.log(`   Primeiro item:`, value[0]);
                        }
                    } else if (value && typeof value === 'object') {
                        findArrays(value, fullPath);
                    }
                });
            };
            
            findArrays(data);
        }
        
        console.log(`📺 Total de items extraídos: ${items.length}`);
        
        if (items.length > 0) {
            console.log('📋 Primeiro item:', items[0]);
            console.log('📋 Campos do primeiro item:', Object.keys(items[0]));
            
            renderContent(items, currentOffset === 0);
            currentOffset += items.length;
            
            if (items.length < limit) {
                hasMore = false;
                showEndMessage(true);
                console.log('🏁 Fim do conteúdo (menos de ' + limit + ' itens)');
            }
        } else {
            console.log('❌ Nenhum item encontrado!');
            hasMore = false;
            showEndMessage(true);
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar conteúdo:', error);
        showError('Erro ao carregar conteúdo');
    } finally {
        isLoading = false;
        showLoading(false);
    }
}

function renderContent(items, clearExisting = false) {
    console.log('🎨 renderContent - items:', items.length, 'clearExisting:', clearExisting);
    
    const grid = document.getElementById('contentGrid');
    
    if (!grid) {
        console.error('❌ Grid não encontrado!');
        return;
    }
    
    if (clearExisting) {
        grid.innerHTML = '';
    }
    
    let cardsCriados = 0;
    items.forEach((item, index) => {
        const card = createContentCard(item);
        if (card) {
            grid.appendChild(card);
            cardsCriados++;
        }
        if (index < 3) {
            console.log(`🎬 Card ${index}:`, item);
        }
    });
    
    console.log(`✅ Grid atualizado: ${cardsCriados}/${items.length} cards criados`);
}

function createContentCard(item) {
    // Tenta encontrar ID
    const id = item.id || item.film_id || item.tv_id || item.content_id || item.movie_id;
    // Tenta encontrar título
    const title = item.title || item.film_name || item.tv_name || item.name || item.movie_title;
    
    if (!id) {
        console.warn('⚠️ Item sem ID:', item);
        return null;
    }
    
    if (!title) {
        console.warn('⚠️ Item sem título:', item);
    }
    
    const card = document.createElement('div');
    card.className = 'content-card';
    card.dataset.id = id;
    card.dataset.title = title || 'Sem título';
    
    // Tenta encontrar thumbnail
    const thumbnail = item.thumb || item.cover || item.thumbnail || item.poster || item.image || item.logo || '';
    // Tenta encontrar ano
    const year = item.year || item.release_year || item.published_year || '';
    
    card.innerHTML = `
        <div class="card-thumbnail">
            ${thumbnail ? 
                `<img src="${thumbnail}" alt="${title || ''}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">` : 
                ''}
            <i class="fas fa-film fallback-icon" style="${thumbnail ? 'display: none;' : ''}"></i>
        </div>
        <div class="card-info">
            <h3 class="card-title">${title || 'Sem título'}</h3>
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
    console.log('🎬 playMovie:', title, 'ID:', id);
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/movie/${id}`);
        const data = await response.json();
        
        console.log('📦 Detalhes do filme:', data);
        
        const movieData = data.data || data;
        const videoUrl = movieData.media_url || movieData.video_url || '';
        
        if (videoUrl) {
            let fixedUrl = videoUrl.replace('30fc87ca.vws.vegacdn.vn', 'free-media.movtv.co.mz');
            if (!fixedUrl.startsWith('http://') && !fixedUrl.startsWith('https://')) {
                fixedUrl = 'http://' + fixedUrl;
            }
            
            console.log('✅ URL do vídeo:', fixedUrl);
            openPlayer(fixedUrl, title, movieData);
        } else {
            console.error('❌ URL do vídeo não encontrada');
            alert('Vídeo não disponível');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar filme:', error);
        alert('Erro ao carregar filme');
    } finally {
        showLoading(false);
    }
}

async function playTVChannel(id, title) {
    console.log('📺 playTVChannel:', title, 'ID:', id);
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/tv/play/${id}`);
        const data = await response.json();
        
        console.log('📦 Detalhes do canal:', data);
        
        const tvData = data.data || data;
        let streamUrl = tvData.stream_url || tvData.url || tvData.media_url || '';
        
        if (streamUrl) {
            if (!streamUrl.startsWith('http://') && !streamUrl.startsWith('https://')) {
                streamUrl = 'http://' + streamUrl;
            }
            
            console.log('✅ URL do stream:', streamUrl);
            openPlayer(streamUrl, title, { ...tvData, year: 'AO VIVO' });
        } else {
            console.error('❌ URL do stream não encontrada');
            alert('Canal não disponível');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar canal:', error);
        alert('Erro ao carregar canal');
    } finally {
        showLoading(false);
    }
}

function openPlayer(url, title, details) {
    console.log('▶️ Abrindo player:', title);
    
    document.getElementById('playerTitle').textContent = title;
    
    if (player) {
        player.src({
            src: url,
            type: url.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
        });
    }
    
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
    console.log('⏹️ Fechando player');
    if (player) {
        player.pause();
        player.reset();
    }
    document.getElementById('playerModal').classList.remove('active');
}

// ============= BUSCA =============
function performSearch(term) {
    console.log('🔍 Buscando:', term);
    currentSearchTerm = term;
    resetAndReload();
}

// ============= UTILITÁRIOS =============
function resetAndReload() {
    console.log('🔄 Resetando e recarregando...');
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
            console.log('📜 Scroll infinito - carregando mais...');
            loadContent();
        }
    }
}

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = show ? 'flex' : 'none';
        console.log('⏳ Loading:', show);
    }
}

function showEndMessage(show) {
    const endMessage = document.getElementById('endMessage');
    if (endMessage) {
        endMessage.style.display = show ? 'flex' : 'none';
        console.log('🏁 End message:', show);
    }
}

function showError(message) {
    console.error('❌ Erro exibido:', message);
    const grid = document.getElementById('contentGrid');
    if (grid) {
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
}

console.log('✅ Script MOVTV carregado!');