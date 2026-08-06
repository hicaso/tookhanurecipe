// Recipe Cost Calculator JS Application

// --- State Management ---
let items = [];
let activeRecipe = {
    name: '새 레시피',
    packagingCost: 0,
    ingredients: [] // Array of { itemId, usageQty, name, brand, price, qty, unit, basePrice, baseUnit }
};
let savedRecipes = [];

// --- Default Data for First-Time Users ---
const defaultItems = [
    { id: 'def-gochu', name: '고추장', brand: '임시', price: 45000, qty: 14, unit: 'kg', basePrice: 3.214, baseUnit: 'g' },
    { id: 'def-sugar', name: '정백당', brand: '임시', price: 18800, qty: 5, unit: 'kg', basePrice: 3.76, baseUnit: 'g' },
    { id: 'def-msg', name: 'MSG', brand: '임시', price: 23000, qty: 2, unit: 'kg', basePrice: 11.50, baseUnit: 'g' },
    { id: 'def-pepper', name: '고춧가루', brand: '임시', price: 25000, qty: 2.5, unit: 'kg', basePrice: 10.00, baseUnit: 'g' },
    { id: 'def-hotpepper', name: '매운 고춧가루', brand: '임시', price: 14000, qty: 1, unit: 'kg', basePrice: 14.00, baseUnit: 'g' },
    { id: 'def-salt', name: '정제염', brand: '임시', price: 19880, qty: 20000, unit: 'g', basePrice: 0.994, baseUnit: 'g' },
    { id: 'def-water', name: '정제수', brand: '임시', price: 1000, qty: 2, unit: 'L', basePrice: 0.50, baseUnit: 'ml' },
    { id: 'def-pork-huji', name: '돈육 후지', brand: '', price: 5600, qty: 1, unit: 'kg', basePrice: 5.60, baseUnit: 'g' },
    { id: 'def-pack-box', name: '배달용 사각용기세트 (포장재)', brand: '크린팩', price: 35000, qty: 100, unit: 'EA', basePrice: 350, baseUnit: 'EA' },
    { id: 'def-pack-bag', name: '포장 비닐봉투 (포장재)', brand: '임시', price: 5000, qty: 100, unit: 'EA', basePrice: 50, baseUnit: 'EA' }
];

const defaultRecipes = [
    {
        id: 'rec-def-1',
        name: '비법 양념장 (요청 레시피)',
        packagingCost: 0,
        ingredients: [
            { itemId: 'def-gochu', usageQty: 2500, name: '고추장', brand: '임시', price: 45000, qty: 14, unit: 'kg', basePrice: 3.214, baseUnit: 'g' },
            { itemId: 'def-sugar', usageQty: 200, name: '정백당', brand: '임시', price: 18800, qty: 5, unit: 'kg', basePrice: 3.76, baseUnit: 'g' },
            { itemId: 'def-msg', usageQty: 200, name: 'MSG', brand: '임시', price: 23000, qty: 2, unit: 'kg', basePrice: 11.50, baseUnit: 'g' },
            { itemId: 'def-pepper', usageQty: 200, name: '고춧가루', brand: '임시', price: 25000, qty: 2.5, unit: 'kg', basePrice: 10.00, baseUnit: 'g' },
            { itemId: 'def-hotpepper', usageQty: 30, name: '매운 고춧가루', brand: '임시', price: 14000, qty: 1, unit: 'kg', basePrice: 14.00, baseUnit: 'g' },
            { itemId: 'def-salt', usageQty: 1, name: '정제염', brand: '임시', price: 19880, qty: 20000, unit: 'g', basePrice: 0.994, baseUnit: 'g' },
            { itemId: 'def-water', usageQty: 500, name: '정제수', brand: '임시', price: 1000, qty: 2, unit: 'L', basePrice: 0.50, baseUnit: 'ml' }
        ],
        createdAt: '2026-01-01T00:00:00.000Z'
    }
];

// --- Brand Display Formatting Helper ---
function getFormattedBrandDisplay(brandStr) {
    if (!brandStr) return '';
    const clean = brandStr.replace(/^\((.+)\)$/, '$1').trim();
    if (!clean) return '';
    
    const brands = clean.split(/[,/ ]+/).map(b => b.trim()).filter(b => b.length > 0);
    if (brands.length === 0) return '';
    
    if (brands.length >= 3) {
        // 3개가 되면 마지막 브랜드 뒤에 ... 표시
        return `[${brands.slice(0, 3).join(' ')}...]`;
    } else {
        return `[${brands.join(' ')}]`;
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('[RC] DOMContentLoaded - starting app');
    checkBrowserStorage();
    initTheme();
    initEventListeners();
    checkLoginState();
    // 안전망 자동 저장: 10초마다 데이터 백업
    setInterval(() => {
        if (isUserLoggedIn()) {
            saveDataOnly();
        }
    }, 10000);
});

// --- 서버 및 로컬 이중 데이터 보존 레이어 (손실 없는 복구 & 즉시 저장) ---
let _saveTimer = null;

// --- IndexedDB & 저장소 영구 지속성 헬퍼 ---
function initIDB() {
    return new Promise((resolve) => {
        if (!window.indexedDB) return resolve(null);
        try {
            const req = indexedDB.open('RecipeCostDB', 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('store')) {
                    db.createObjectStore('store');
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
}

async function saveToIndexedDB(payload) {
    try {
        const db = await initIDB();
        if (!db) return;
        const tx = db.transaction('store', 'readwrite');
        tx.objectStore('store').put(payload, 'backup_data');
    } catch (e) {
        console.warn('[RC] IndexedDB 쓰기 실패:', e);
    }
}

async function loadFromIndexedDB() {
    try {
        const db = await initIDB();
        if (!db) return null;
        return new Promise((resolve) => {
            const tx = db.transaction('store', 'readonly');
            const req = tx.objectStore('store').get('backup_data');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
}

// 브라우저 저장소 사용 가능 여부 확인
function checkBrowserStorage() {
    try {
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().then(granted => {
                console.log(`[RC] 영구 저장소(persist) 요청 결과: ${granted}`);
            }).catch(() => {});
        }
        const testKey = '__rc_storage_test__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
        console.log(`[RC] localStorage 사용 가능: ${window.location.origin || window.location.href}`);
        return true;
    } catch (error) {
        console.error('[RC] localStorage를 사용할 수 없습니다.', error);
        setTimeout(() => {
            showToast('브라우저 저장소가 차단되어 저장할 수 없습니다. 시크릿 모드·사이트 데이터 차단 설정을 확인해주세요.', 'danger');
        }, 0);
        return false;
    }
}

// 백엔드는 명시적으로 켠 경우 또는 local http/https 서버 호스트에서 자동 활성화한다.
// GitHub Pages와 file://에서는 항상 브라우저 localStorage만 사용한다.
function isServerAvailable() {
    if (window.RC_BACKEND_ENABLED !== undefined) {
        return window.RC_BACKEND_ENABLED === true;
    }
    const isStaticHost = window.location.protocol === 'file:' ||
        window.location.hostname.endsWith('github.io');
    return !isStaticHost;
}

// 로그인 상태 통합 검증 (sessionStorage 또는 localStorage)
function isUserLoggedIn() {
    return sessionStorage.getItem('rc_logged_in') === 'true' || localStorage.getItem('rc_logged_in') === 'true';
}

// localStorage & IndexedDB 캐시 동기 업데이트 (PC 로컬 통합 저장소 + 전역 키 + IDB 동시 기록)
function updateLocalCache() {
    const userId = getCurrentUserId() || 'local_user';
    try {
        const payload = {
            userId,
            items,
            recipes: savedRecipes,
            activeRecipe,
            savedAt: new Date().toISOString()
        };
        const payloadStr = JSON.stringify(payload);
        localStorage.setItem(`rc_cache_${userId}`, payloadStr);
        localStorage.setItem('rc_cache_local', payloadStr); // 마지막 로그인 계정의 동일 브라우저 안전 백업
        localStorage.setItem('rc_recipes', JSON.stringify(savedRecipes)); // 3중 전역 보관
        localStorage.setItem('rc_items', JSON.stringify(items)); // 3중 전역 보관
        localStorage.setItem('rc_storage_version', '10');

        // IndexedDB에도 동시 백업
        saveToIndexedDB(payload);
    } catch(e) {
        console.warn('[RC] 로컬 캐시 쓰기 실패:', e);
    }
}

// 서버 디스크 파일(data/{userId}.json) 즉시 저장 (async)
async function saveToServer() {
    if (!isServerAvailable()) return false;
    const userId = getCurrentUserId();
    if (!userId || !_sessionDataLoaded || !isUserLoggedIn()) return false;
    const payload = {
        userId,
        items,
        recipes: savedRecipes,
        activeRecipe,
        savedAt: new Date().toISOString()
    };
    try {
        const resp = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const result = await resp.json();
        if (result.ok) {
            console.log(`[RC] ✅ 서버 디스크 파일 저장 성공: data/${userId}.json (품목:${items.length}, 레시피:${savedRecipes.length})`);
            return true;
        }
    } catch (e) {
        console.warn('[RC] 서버 저장 실패:', e.message);
    }
    return false;
}

// 종합 데이터 저장 함수
// isImmediate = true: 버튼 클릭 등 명시적 저장 시 즉시 파일 저장
// isImmediate = false: 입력 중 실시간 백업용 디바운스 저장
function saveAllData(isImmediate = false) {
    updateLocalCache();
    if (isImmediate) {
        clearTimeout(_saveTimer);
        saveToServer();
    } else {
        triggerServerSave();
    }
}

function triggerServerSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => { saveToServer(); }, 1000);
}

// 품목 저장 (기본값: 즉시 파일 저장)
function saveItemsToLocalStorage(isImmediate = true) {
    saveAllData(isImmediate);
    renderItemsList();
    renderAvailableItemChips();
}

// 레시피 저장 (기본값: 즉시 파일 저장)
function saveRecipesToLocalStorage(isImmediate = true) {
    saveAllData(isImmediate);
    renderSavedRecipesList();
    updateHeaderStats();
}

// 작업중 레시피 저장 (기본값: 디바운스 자동 백업)
function saveActiveRecipeToLocalStorage(isImmediate = false) {
    saveAllData(isImmediate);
}

// 즉시 전체 저장 (페이지 이탈/종료 시)
function saveDataOnly() {
    updateLocalCache();
    if (isServerAvailable()) {
        const userId = getCurrentUserId() || 'local_user';
        const payload = JSON.stringify({ userId, items, recipes: savedRecipes, activeRecipe, savedAt: new Date().toISOString() });
        try {
            navigator.sendBeacon('/api/save', new Blob([payload], { type: 'application/json' }));
        } catch(e) {
            saveToServer();
        }
    }
}

// 스마트 데이터 복구 및 동기화 (로컬 캐시 + PC 백업 + 전역 레거시 키 + 서버 파일 무손실 병합)
async function loadAndReconcileUserData(userId) {
    const cleanUserId = (userId || '').trim().toLowerCase() || 'local_user';
    console.log(`[RC] 사용자 데이터 동기화 시작: "${cleanUserId}"`);
    _sessionDataLoaded = false;
    
    // 1. 해당 계정 로컬 캐시 및 PC 전체 백업 읽기
    let localData = null;
    try {
        const cachedRaw = localStorage.getItem(`rc_cache_${cleanUserId}`);
        if (cachedRaw) localData = JSON.parse(cachedRaw);
    } catch (e) {}

    let pcBackupData = null;
    try {
        const pcRaw = localStorage.getItem('rc_cache_local');
        if (pcRaw) {
            const parsed = JSON.parse(pcRaw);
            const backupUserId = String(parsed?.userId || '').trim().toLowerCase();
            if (!backupUserId || backupUserId === cleanUserId) pcBackupData = parsed;
        }
    } catch (e) {}

    // 1-3. 구버전 전역 키 (rc_recipes, rc_items) 호환 백업 체크
    let legacyRecipes = null;
    let legacyItems = null;
    try {
        const legacyR = localStorage.getItem('rc_recipes');
        if (legacyR) legacyRecipes = JSON.parse(legacyR);
        const legacyI = localStorage.getItem('rc_items');
        if (legacyI) legacyItems = JSON.parse(legacyI);
    } catch (e) {}

    // 1-4. IndexedDB 2차 안전 백업 읽기
    let idbData = null;
    try {
        idbData = await loadFromIndexedDB();
    } catch (e) {}

    // 2. 서버 파일 데이터 불러오기 (서버가 존재하는 모드에서만)
    let serverData = null;
    if (isServerAvailable()) {
        try {
            const resp = await fetch(`/api/load?userId=${encodeURIComponent(cleanUserId)}`);
            if (resp.ok) {
                const json = await resp.json();
                if (json && (Array.isArray(json.items) || Array.isArray(json.recipes))) {
                    serverData = json;
                }
            }
        } catch (e) {}
    }

    // 3. 무손실 종합 합집합 병합 (Reconciliation)
    const recipeMap = new Map();
    const collectRecipes = (list) => {
        if (Array.isArray(list)) {
            list.forEach(r => {
                if (r && r.id) {
                    if (!recipeMap.has(r.id)) {
                        recipeMap.set(r.id, r);
                    } else {
                        const existing = recipeMap.get(r.id);
                        const existingDate = new Date(existing.createdAt || 0).getTime();
                        const newDate = new Date(r.createdAt || 0).getTime();
                        if (newDate >= existingDate) {
                            recipeMap.set(r.id, r);
                        }
                    }
                }
            });
        }
    };

    const itemMap = new Map();
    const collectItems = (list) => {
        if (Array.isArray(list)) {
            list.forEach(i => {
                if (i && i.id) itemMap.set(i.id, i);
            });
        }
    };

    // 무조건 존재하는 모든 소스의 레시피/품목 수집 (100% 무손실 복구)
    collectRecipes(defaultRecipes);
    collectRecipes(legacyRecipes);
    if (idbData && Array.isArray(idbData.recipes)) collectRecipes(idbData.recipes);
    if (pcBackupData && Array.isArray(pcBackupData.recipes)) collectRecipes(pcBackupData.recipes);
    if (localData && Array.isArray(localData.recipes)) collectRecipes(localData.recipes);
    if (serverData && Array.isArray(serverData.recipes)) collectRecipes(serverData.recipes);

    collectItems(defaultItems);
    collectItems(legacyItems);
    if (idbData && Array.isArray(idbData.items)) collectItems(idbData.items);
    if (pcBackupData && Array.isArray(pcBackupData.items)) collectItems(pcBackupData.items);
    if (localData && Array.isArray(localData.items)) collectItems(localData.items);
    if (serverData && Array.isArray(serverData.items)) collectItems(serverData.items);

    // 메모리 상태 업데이트 (품목/레시피 DB 복구 + 레시피 입력창은 깨끗한 널/초기화 상태 유지)
    items = Array.from(itemMap.values());
    savedRecipes = Array.from(recipeMap.values());
    activeRecipe = { id: null, loadedName: '', name: '새 레시피', packagingCost: 0, ingredients: [] };

    _sessionDataLoaded = true;

    // 로컬 통합 저장소와 서버에 동시 보관
    updateLocalCache();
    await saveToServer();
    
    renderAll();
    console.log(`[RC] ✅ PC 무손실 복구 및 동기화 완료: 품목 ${items.length}개, 레시피 ${savedRecipes.length}개`);
}

// --- Theme Management ---
function initTheme() {
    const savedTheme = localStorage.getItem('rc_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('rc_theme', newTheme);
}

// --- Calculation & Conversion Helpers ---
function getBaseUnit(unit) {
    switch (unit) {
        case 'kg':
        case 'g':
            return 'g';
        case 'L':
        case 'ml':
            return 'ml';
        case 'EA':
            return 'EA';
        case '스푼':
            return '스푼';
        default:
            return 'g';
    }
}

function convertToMinUnitQty(qty, unit) {
    if (unit === 'kg' || unit === 'L') {
        return qty * 1000;
    }
    return qty; // g, ml, EA, 스푼
}

function convertQty(qty, fromUnit, toUnit) {
    if (fromUnit === toUnit) return qty;
    // weight
    if (fromUnit === 'kg' && toUnit === 'g') return qty * 1000;
    if (fromUnit === 'g' && toUnit === 'kg') return qty / 1000;
    // volume
    if (fromUnit === 'L' && toUnit === 'ml') return qty * 1000;
    if (fromUnit === 'ml' && toUnit === 'L') return qty / 1000;
    return qty; // EA, 스푼 or fallback
}

function calculateBaseUnitPrice(price, qty, unit) {
    const minQty = convertToMinUnitQty(qty, unit);
    if (minQty <= 0) return 0;
    return price / minQty;
}

// FIFO (선입선출) 기반 g/ml/EA당 단가 계산 헬퍼
function calculateFifoUnitPrice(item, usageQtyInBaseUnit) {
    if (!item) return 0;
    if (item.batches && Array.isArray(item.batches) && item.batches.length > 0) {
        let remainingQtyNeeded = usageQtyInBaseUnit;
        let totalCost = 0;
        const sortedBatches = [...item.batches].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        
        for (const batch of sortedBatches) {
            const batchBaseQty = convertToMinUnitQty(batch.qty, batch.unit);
            const batchBasePrice = calculateBaseUnitPrice(batch.price, batch.qty, batch.unit);
            
            if (remainingQtyNeeded <= 0) break;
            
            const takeQty = Math.min(remainingQtyNeeded, batchBaseQty);
            totalCost += takeQty * batchBasePrice;
            remainingQtyNeeded -= takeQty;
        }
        
        if (remainingQtyNeeded > 0) {
            totalCost += remainingQtyNeeded * item.basePrice;
        }
        
        return usageQtyInBaseUnit > 0 ? totalCost / usageQtyInBaseUnit : item.basePrice;
    }
    return item.basePrice;
}

// --- Event Listeners ---
function initEventListeners() {
    // Theme Toggle
    document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);

    // Chat Recipe Auto Parsing
    const parseChatBtn = document.getElementById('parse-chat-recipe-btn');
    if (parseChatBtn) {
        parseChatBtn.addEventListener('click', handleParseChatRecipe);
    }

    // Item Master Form Submit
    const itemForm = document.getElementById('item-master-form');
    itemForm.addEventListener('submit', handleItemFormSubmit);

    // Cancel Edit Button
    document.getElementById('item-cancel-edit-btn').addEventListener('click', cancelItemEdit);

    // Item Search
    document.getElementById('search-item').addEventListener('input', renderItemsList);

    // Event Delegation: Item Master List Item Click (Opens Item Details/Edit Modal Window)
    document.getElementById('items-list-container').addEventListener('click', (e) => {
        const card = e.target.closest('.item-card');
        if (!card) return;
        const id = card.dataset.id;

        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            deleteItem(id);
        } else {
            // Clicking item name or anywhere on item card opens modal window with 품목명, 브랜드, 단가, 중량
            openItemEditModal(id);
        }
    });

    // Item Edit Modal Form Listeners
    const itemEditModalForm = document.getElementById('item-edit-modal-form');
    if (itemEditModalForm) {
        itemEditModalForm.addEventListener('submit', handleItemEditModalSubmit);
    }
    const closeItemEditModalBtn = document.getElementById('close-item-edit-modal-btn');
    if (closeItemEditModalBtn) {
        closeItemEditModalBtn.addEventListener('click', closeItemEditModal);
    }
    const cancelItemEditModalBtn = document.getElementById('cancel-item-edit-modal-btn');
    if (cancelItemEditModalBtn) {
        cancelItemEditModalBtn.addEventListener('click', closeItemEditModal);
    }

    // Add ingredient to recipe
    document.getElementById('add-recipe-item-btn').addEventListener('click', handleAddRecipeItem);

    // Delegation handler helper for ingredient and packaging tables
    const setupTableListeners = (tbodyEl) => {
        if (!tbodyEl) return;
        tbodyEl.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.ingredient-row-delete-btn');
            if (deleteBtn) {
                const itemId = deleteBtn.dataset.itemId;
                const ingId = deleteBtn.dataset.ingId;
                removeRecipeIngredient(ingId, itemId);
                return;
            }

            const unregBtn = e.target.closest('.unregistered-item-btn');
            if (unregBtn) {
                const ingId = unregBtn.dataset.ingId;
                const rawName = unregBtn.dataset.rawName;
                const baseUnit = unregBtn.dataset.baseUnit;
                openQuickItemModal(ingId, rawName, baseUnit);
                return;
            }

            const itemNameClick = e.target.closest('.ingredient-item-name');
            if (itemNameClick) {
                const tr = itemNameClick.closest('tr');
                if (tr && tr.dataset.itemId) {
                    openItemEditModal(tr.dataset.itemId);
                }
            }
        });

        tbodyEl.addEventListener('input', (e) => {
            const usageInput = e.target.closest('.ingredient-usage-input');
            if (usageInput) {
                const ingId = usageInput.dataset.ingId;
                const newQty = parseFloat(usageInput.value);
                const ing = activeRecipe.ingredients.find(i => i.id === ingId);
                if (ing && !isNaN(newQty) && newQty >= 0) {
                    ing.usageQty = newQty;
                    saveActiveRecipeToLocalStorage();
                    renderRecipeSummary();
                    const item = items.find(i => i.id === ing.itemId);
                    const costCell = usageInput.closest('tr').querySelector('td:nth-last-child(2)');
                    if (costCell) {
                        const fifoPrice = item ? calculateFifoUnitPrice(item, newQty) : (ing.basePrice || 0);
                        const cost = fifoPrice * newQty;
                        costCell.textContent = formatNumber(Math.round(cost)) + '원';
                    }
                }
            }
        });
    };

    setupTableListeners(document.getElementById('recipe-ingredients-tbody'));
    setupTableListeners(document.getElementById('recipe-packaging-tbody'));

    // Packaging Cost inputs
    document.getElementById('packaging-cost').addEventListener('input', (e) => {
        activeRecipe.packagingCost = parseFloat(e.target.value) || 0;
        saveActiveRecipeToLocalStorage();
        renderRecipeSummary();
    });

    document.getElementById('recipe-name').addEventListener('input', (e) => {
        activeRecipe.name = e.target.value || '새 레시피';
        saveActiveRecipeToLocalStorage();
    });

    // Recipe Actions
    document.getElementById('recipe-reset-btn').addEventListener('click', resetActiveRecipe);
    document.getElementById('recipe-save-btn').addEventListener('click', saveActiveRecipe);
    document.getElementById('recipe-print-btn').addEventListener('click', printActiveRecipe);

    // Event Delegation: Saved Recipes list buttons
    document.getElementById('recipes-list-container').addEventListener('click', (e) => {
        const card = e.target.closest('.recipe-db-card');
        if (!card) return;
        const id = card.dataset.id;

        const loadBtn = e.target.closest('.load-recipe-btn');
        const deleteBtn = e.target.closest('.delete-recipe-btn');

        if (loadBtn) {
            loadSavedRecipe(id);
        } else if (deleteBtn) {
            deleteSavedRecipe(id);
        }
    });

    // Enter key navigation for Item Master Form fields
    const itemFormFields = [
        'item-name',
        'item-brand',
        'purchase-price',
        'purchase-qty',
        'purchase-unit'
    ];
    itemFormFields.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const nextId = itemFormFields[idx + 1];
                    if (nextId) {
                        const nextEl = document.getElementById(nextId);
                        if (nextEl) {
                            nextEl.focus();
                            if (nextEl.tagName === 'INPUT') {
                                nextEl.select();
                            }
                        }
                    } else {
                        document.getElementById('item-master-form').requestSubmit();
                    }
                }
            });
        }
    });

    // Enter key submission for Recipe Ingredient qty
    document.getElementById('recipe-item-qty').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddRecipeItem();
        }
    });

    // Saved Recipes DB Collapsible Handlers
    const savedRecipesHeader = document.getElementById('saved-recipes-header');
    if (savedRecipesHeader) {
        savedRecipesHeader.addEventListener('click', toggleSavedRecipesDB);
    }

    // Item Master Form Collapsible & Auto Expand on typing item name
    const itemFormCard = document.getElementById('item-form-card');
    if (itemFormCard) {
        itemFormCard.addEventListener('click', (e) => {
            if (e.target.closest('#item-form-header') || e.target.closest('.collapse-toggle-btn')) {
                toggleItemForm();
            }
        });
    }

    const itemNameInput = document.getElementById('item-name');
    if (itemNameInput) {
        itemNameInput.addEventListener('focus', () => {
            expandItemForm();
        });
        itemNameInput.addEventListener('input', (e) => {
            if (e.target.value.trim().length > 0) {
                expandItemForm();
            }
        });
    }

    // Collapse Saved Recipes DB card when starting to enter/edit a recipe
    const recipeInputs = ['recipe-name', 'packaging-cost', 'recipe-item-qty', 'chat-recipe-input'];
    recipeInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('focus', collapseSavedRecipesDB);
            el.addEventListener('input', collapseSavedRecipesDB);
        }
    });

    // Auth Event Listeners (Block Spacebar & Enter key to submit)
    const setupAuthInput = (inputEl) => {
        if (!inputEl) return;
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                const form = inputEl.closest('form');
                if (form) {
                    form.requestSubmit();
                } else {
                    handleLoginSubmit(e);
                }
            }
        });
        inputEl.addEventListener('input', (e) => {
            if (e.target.value.includes(' ')) {
                e.target.value = e.target.value.replace(/\s+/g, '');
            }
        });
    };
    setupAuthInput(document.getElementById('login-id'));
    setupAuthInput(document.getElementById('login-pw'));
    setupAuthInput(document.getElementById('current-pw'));
    setupAuthInput(document.getElementById('new-pw'));
    setupAuthInput(document.getElementById('new-pw-confirm'));

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    const exportBtn = document.getElementById('export-backup-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportBackupData);
    }

    const importBtn = document.getElementById('import-backup-btn');
    const importFile = document.getElementById('import-backup-file');
    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                importBackupData(e.target.files[0]);
                e.target.value = '';
            }
        });
    }

    const pwChangeBtn = document.getElementById('pw-change-btn');
    if (pwChangeBtn) {
        pwChangeBtn.addEventListener('click', openPwChangeModal);
    }

    const closePwModalBtn = document.getElementById('close-pw-modal-btn');
    if (closePwModalBtn) {
        closePwModalBtn.addEventListener('click', closePwChangeModal);
    }

    const cancelPwModalBtn = document.getElementById('cancel-pw-modal-btn');
    if (cancelPwModalBtn) {
        cancelPwModalBtn.addEventListener('click', closePwChangeModal);
    }

    const pwChangeForm = document.getElementById('pw-change-form');
    if (pwChangeForm) {
        pwChangeForm.addEventListener('submit', handlePwChangeSubmit);
    }

    // Quick Item Modal Listeners
    const quickItemForm = document.getElementById('quick-item-form');
    if (quickItemForm) {
        quickItemForm.addEventListener('submit', handleQuickItemSubmit);
    }
    const closeQuickModalBtn = document.getElementById('close-quick-item-modal-btn');
    if (closeQuickModalBtn) {
        closeQuickModalBtn.addEventListener('click', closeQuickItemModal);
    }
    const cancelQuickModalBtn = document.getElementById('cancel-quick-item-btn');
    if (cancelQuickModalBtn) {
        cancelQuickModalBtn.addEventListener('click', closeQuickItemModal);
    }

    // Window auto-save handlers for program exit / tab change
    window.addEventListener('beforeunload', () => {
        saveDataOnly();
    });
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            saveDataOnly();
        }
    });
    window.addEventListener('pagehide', saveDataOnly);
}

// --- Item Master Collapsible Helper Functions ---
function toggleItemForm() {
    const card = document.getElementById('item-form-card');
    if (card) {
        card.classList.toggle('collapsed');
    }
}

function expandItemForm() {
    const card = document.getElementById('item-form-card');
    if (card && card.classList.contains('collapsed')) {
        card.classList.remove('collapsed');
    }
}

function collapseItemForm() {
    const card = document.getElementById('item-form-card');
    if (card && !card.classList.contains('collapsed')) {
        card.classList.add('collapsed');
    }
}

// --- Item Form Actions & Item Edit Modal ---
function openItemEditModal(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    document.getElementById('modal-edit-item-id').value = item.id;
    document.getElementById('modal-item-name').value = item.name;
    document.getElementById('modal-item-brand').value = item.brand || '';
    document.getElementById('modal-purchase-price').value = item.price;
    document.getElementById('modal-purchase-qty').value = item.qty;
    document.getElementById('modal-purchase-unit').value = item.unit;

    const modal = document.getElementById('item-edit-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('modal-item-name').focus();
    }
}

function closeItemEditModal() {
    const modal = document.getElementById('item-edit-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    const form = document.getElementById('item-edit-modal-form');
    if (form) form.reset();
}

function handleItemEditModalSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('modal-edit-item-id').value;
    const name = document.getElementById('modal-item-name').value.trim();
    const brand = document.getElementById('modal-item-brand').value.trim();
    const price = parseFloat(document.getElementById('modal-purchase-price').value);
    const qty = parseFloat(document.getElementById('modal-purchase-qty').value);
    const unit = document.getElementById('modal-purchase-unit').value;

    if (!name || isNaN(price) || isNaN(qty)) {
        showToast('올바른 품목명, 단가(가격), 중량(수량)을 입력해주세요.', 'danger');
        return;
    }

    const itemIndex = items.findIndex(i => i.id === id);
    if (itemIndex > -1) {
        const baseUnit = getBaseUnit(unit);
        const basePrice = calculateBaseUnitPrice(price, qty, unit);
        items[itemIndex] = { ...items[itemIndex], name, brand, price, qty, unit, basePrice, baseUnit };

        // Update ingredient snapshots in active recipe if present
        if (activeRecipe && activeRecipe.ingredients) {
            activeRecipe.ingredients.forEach(ing => {
                if (ing.itemId === id) {
                    ing.name = name;
                    ing.brand = brand;
                    ing.price = price;
                    ing.qty = qty;
                    ing.unit = unit;
                    ing.basePrice = basePrice;
                    ing.baseUnit = baseUnit;
                }
            });
        }

        saveItemsToLocalStorage();
        renderRecipeIngredientsTable();
        closeItemEditModal();
        showToast(`"${name}" 품목 정보가 수정되었습니다.`, 'success');
    }
}

function handleItemFormSubmit(e) {
    e.preventDefault();

    const editId = document.getElementById('edit-item-id').value;
    const name = document.getElementById('item-name').value.trim();
    const brand = document.getElementById('item-brand').value.trim();
    const priceVal = document.getElementById('purchase-price').value;
    const qtyVal = document.getElementById('purchase-qty').value;
    const price = parseFloat(priceVal);
    const qty = parseFloat(qtyVal);
    const unit = document.getElementById('purchase-unit').value || 'g';

    if (!name || isNaN(price) || isNaN(qty)) {
        expandItemForm();
        if (!name) {
            document.getElementById('item-name').focus();
            showToast('품목명을 입력해주세요.', 'danger');
        } else if (isNaN(price)) {
            document.getElementById('purchase-price').focus();
            showToast('구매 가격(단가)을 입력해주세요.', 'danger');
        } else if (isNaN(qty)) {
            document.getElementById('purchase-qty').focus();
            showToast('구매 수량(중량)을 입력해주세요.', 'danger');
        }
        return;
    }

    const baseUnit = getBaseUnit(unit);
    const basePrice = calculateBaseUnitPrice(price, qty, unit);

    if (editId) {
        // Edit existing item
        const itemIndex = items.findIndex(i => i.id === editId);
        if (itemIndex > -1) {
            items[itemIndex] = { ...items[itemIndex], name, brand, price, qty, unit, basePrice, baseUnit };
            showToast('품목 정보가 수정되었습니다.', 'success');
        }
        cancelItemEdit();
    } else {
        // Check for duplicates and accumulate cost/quantities if name matches
        const existingItem = items.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (existingItem) {
            const isExistingWeight = ['kg', 'g'].includes(existingItem.unit);
            const isNewWeight = ['kg', 'g'].includes(unit);
            const isExistingVolume = ['L', 'ml'].includes(existingItem.unit);
            const isNewVolume = ['L', 'ml'].includes(unit);
            const isExistingCount = existingItem.unit === 'EA';
            const isNewCount = unit === 'EA';

            if ((isExistingWeight && !isNewWeight) || 
                (isExistingVolume && !isNewVolume) || 
                (isExistingCount && !isNewCount)) {
                showToast('동일한 이름의 품목이 존재하지만 단위 계열이 다릅니다 (중량/부피/개수 불일치).', 'danger');
                return;
            }

            const convertedNewQty = convertQty(qty, unit, existingItem.unit);
            existingItem.qty += convertedNewQty;
            existingItem.price += price;
            if (brand) {
                let existingBrands = existingItem.brand ? 
                    existingItem.brand.replace(/^\((.+)\)$/, '$1').split(/[,/ ]+/).map(b => b.trim()).filter(b => b.length > 0) : [];
                const newBrands = brand.replace(/^\((.+)\)$/, '$1').split(/[,/ ]+/).map(b => b.trim()).filter(b => b.length > 0);
                newBrands.forEach(b => {
                    if (!existingBrands.includes(b)) {
                        existingBrands.push(b);
                    }
                });
                existingItem.brand = existingBrands.join(' ');
            }
            existingItem.basePrice = calculateBaseUnitPrice(existingItem.price, existingItem.qty, existingItem.unit);

            showToast(`"${existingItem.name}" 품목에 수량(${qty}${unit})과 가격(${price}원)이 누적 합산되었습니다.`, 'success');
        } else {
            const newItem = {
                id: 'item-' + Date.now(),
                name,
                brand,
                price,
                qty,
                unit,
                basePrice,
                baseUnit
            };
            items.push(newItem);
            showToast(`새 품목 "${name}"이(가) 등록되었습니다.`, 'success');
        }
    }

    saveItemsToLocalStorage();
    document.getElementById('item-master-form').reset();
    document.getElementById('edit-item-id').value = '';
    collapseItemForm();
    renderRecipeIngredientsTable();
}

function editItem(id) {
    openItemEditModal(id);
}

function cancelItemEdit() {
    document.getElementById('edit-item-id').value = '';
    document.getElementById('item-master-form').reset();
    document.getElementById('item-submit-btn').querySelector('span').textContent = '품목 등록하기';
    document.getElementById('item-cancel-edit-btn').classList.add('hidden');
    collapseItemForm();
}

function deleteItem(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    if (confirm(`"${item.name}" 품목을 삭제하시겠습니까? 이 품목을 포함한 레시피의 계산 값이 틀려질 수 있습니다.`)) {
        items = items.filter(i => i.id !== id);
        
        // Remove from current recipe ingredients if present
        activeRecipe.ingredients = activeRecipe.ingredients.filter(ing => ing.itemId !== id);

        saveItemsToLocalStorage();
        renderRecipeIngredientsTable();
        showToast('품목이 삭제되었습니다.', 'success');
    }
}

// --- Recipe Calculator Actions ---
function handleRecipeItemSelectChange(e) {
    const itemId = e.target.value;
    const unitDisplay = document.getElementById('recipe-item-unit-display');
    
    if (!itemId) {
        unitDisplay.textContent = '-';
        return;
    }

    const item = items.find(i => i.id === itemId);
    if (item) {
        unitDisplay.textContent = item.baseUnit;
    }
}

    // Update ingredients snapshot values to the CURRENT master list item properties upon saving
    const updatedIngredients = activeRecipe.ingredients.map(ing => {
        const item = items.find(i => i.id === ing.itemId);
        const ingId = ing.id || ('ing-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5));
        if (item) {
            return {
                id: ingId,
                itemId: ing.itemId,
                usageQty: ing.usageQty,
                name: item.name,
                brand: item.brand,
                price: item.price,
                qty: item.qty,
                unit: item.unit,
                basePrice: item.basePrice,
                baseUnit: item.baseUnit
            };
        }
        return {
            ...ing,
            id: ingId
        };
    });

    const targetName = activeRecipe.name;
    
    // Check if user is explicitly editing the currently loaded recipe (ID exists AND name is unchanged from loadedName)
    const isEditingLoadedRecipe = activeRecipe.id && 
                                  activeRecipe.loadedName && 
                                  targetName === activeRecipe.loadedName;

    let targetId = null;
    let isUpdate = false;

    if (isEditingLoadedRecipe) {
        // 1. Update the existing loaded recipe (name unchanged)
        targetId = activeRecipe.id;
        isUpdate = true;
    } else {
        // 2. User changed name OR created new recipe -> ALWAYS CREATE NEW RECIPE ENTRY!
        targetId = 'recipe-' + Date.now();
        isUpdate = false;
    }

    const recipeToSave = {
        id: targetId,
        name: targetName,
        packagingCost: activeRecipe.packagingCost,
        ingredients: updatedIngredients,
        createdAt: new Date().toISOString()
    };

    if (isUpdate) {
        const existingIndex = savedRecipes.findIndex(r => r.id === targetId);
        if (existingIndex > -1) {
            savedRecipes[existingIndex] = recipeToSave;
        } else {
            savedRecipes.push(recipeToSave);
        }
    } else {
        // Always append as a brand-new independent recipe
        savedRecipes.push(recipeToSave);
    }

    // Synchronize activeRecipe state with saved record
    activeRecipe.id = targetId;
    activeRecipe.loadedName = targetName;
    activeRecipe.ingredients = JSON.parse(JSON.stringify(updatedIngredients));

    saveRecipesToLocalStorage();
    saveActiveRecipeToLocalStorage();
    expandSavedRecipesDB();
    
    if (isUpdate) {
        showToast(`기존 레시피 "${targetName}"이(가) 수정 저장되었습니다.`, 'success');
    } else {
        showToast(`새 레시피 "${targetName}"이(가) "저장된 레시피 DB"에 추가되었습니다.`, 'success');
    }
}

function loadSavedRecipe(recipeId) {
    const saved = savedRecipes.find(r => r.id === recipeId);
    if (!saved) return;

    activeRecipe = {
        id: saved.id,
        loadedName: saved.name,
        name: saved.name,
        packagingCost: saved.packagingCost,
        ingredients: JSON.parse(JSON.stringify(saved.ingredients)) // Freeze historical prices in activeRecipe
    };

    saveActiveRecipeToLocalStorage();
    document.getElementById('recipe-name').value = activeRecipe.name;
    document.getElementById('packaging-cost').value = activeRecipe.packagingCost;

    renderRecipeIngredientsTable();
    collapseSavedRecipesDB();
    showToast(`레시피 "${saved.name}"을(를) 불러왔습니다.`, 'success');
}

function deleteSavedRecipe(recipeId) {
    const saved = savedRecipes.find(r => r.id === recipeId);
    if (!saved) return;

    if (confirm(`레시피 "${saved.name}"을(를) 영구 삭제하시겠습니까?`)) {
        savedRecipes = savedRecipes.filter(r => r.id !== recipeId);
        saveRecipesToLocalStorage();
        showToast('레시피가 삭제되었습니다.', 'success');
    }
}

// --- Printing/Exporting ---
function printActiveRecipe() {
    if (activeRecipe.ingredients.length === 0) {
        showToast('인쇄할 재료가 레시피에 없습니다.', 'danger');
        return;
    }

    const printTemplate = document.getElementById('print-template');
    
    // Compute total ingredients cost using frozen/saved properties
    let ingredientsCostTotal = 0;
    const tableRows = activeRecipe.ingredients.map((ing, idx) => {
        const item = items.find(i => i.id === ing.itemId);
        
        const basePrice = ing.basePrice !== undefined ? ing.basePrice : (item ? item.basePrice : 0);
        const baseUnit = ing.baseUnit || (item ? item.baseUnit : '');
        const name = ing.name || (item ? item.name : '삭제된 품목');
        const brand = ing.brand || (item ? item.brand : '');
        const qty = ing.qty !== undefined ? ing.qty : (item ? item.qty : 0);
        const unit = ing.unit || (item ? item.unit : '');
        const price = ing.price !== undefined ? ing.price : (item ? item.price : 0);

        const cost = basePrice * ing.usageQty;
        ingredientsCostTotal += cost;

        const displayName = name + (brand ? ` [${brand}]` : '');

        return `
            <tr>
                <td>${idx + 1}</td>
                <td>${escapeHtml(displayName)}</td>
                <td style="text-align: right;">${formatNumber(qty)}${unit} / ${formatNumber(price)}원</td>
                <td style="text-align: right;">${basePrice.toFixed(2)}원 / ${baseUnit}</td>
                <td style="text-align: right;">${formatNumber(ing.usageQty)} ${baseUnit}</td>
                <td style="text-align: right; font-weight: bold;">${formatNumber(Math.round(cost))}원</td>
            </tr>
        `;
    }).join('');

    const totalCost = Math.round(ingredientsCostTotal + activeRecipe.packagingCost);

    printTemplate.innerHTML = `
        <div class="print-header">
            <h1>🍳 레시피 원가 산출 분석 보고서</h1>
            <p style="margin-top: 5px; color: #666; font-size: 13px;">발행일자: ${new Date().toLocaleString()}</p>
        </div>
        <div class="print-meta-grid">
            <div class="print-meta-item"><strong>레시피명:</strong> ${escapeHtml(activeRecipe.name)}</div>
            <div class="print-meta-item" style="text-align: right;"><strong>사용 품목 수:</strong> ${activeRecipe.ingredients.length}개</div>
        </div>
        <table class="print-table">
            <thead>
                <tr>
                    <th style="width: 50px;">번호</th>
                    <th>품목명</th>
                    <th style="text-align: right;">구매 정보</th>
                    <th style="text-align: right;">최소단위 환산 단가</th>
                    <th style="text-align: right;">레시피 사용량</th>
                    <th style="text-align: right;">계산 원가</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
        <div class="print-summary">
            <div class="print-summary-item">식자재 원가 합계: ${formatNumber(Math.round(ingredientsCostTotal))} 원</div>
            <div class="print-summary-item">포장 비용 (고정값): ${formatNumber(activeRecipe.packagingCost)} 원</div>
            <div class="print-summary-item" style="font-size: 20px; color: #059669; margin-top: 10px;">
                최종 합산 원가: ${formatNumber(totalCost)} 원
            </div>
        </div>
    `;

    window.print();
}

// --- Render Logic ---
function renderAll() {
    renderItemsList();
    renderAvailableItemChips();

    // Sync input fields with activeRecipe
    const nameInput = document.getElementById('recipe-name');
    const costInput = document.getElementById('packaging-cost');
    if (nameInput) nameInput.value = activeRecipe.name || '새 레시피';
    if (costInput) costInput.value = activeRecipe.packagingCost !== undefined ? activeRecipe.packagingCost : 0;

    renderRecipeIngredientsTable();
    renderSavedRecipesList();
    if (savedRecipes && savedRecipes.length > 0) {
        expandSavedRecipesDB();
    }
}

function updateHeaderStats() {
    document.getElementById('header-items-count').textContent = items.length;
    document.getElementById('header-recipes-count').textContent = savedRecipes.length;
    document.getElementById('items-count-badge').textContent = `${items.length}개 품목`;
    document.getElementById('recipes-count-badge').textContent = `${savedRecipes.length}개 레시피`;
}

function renderItemsList() {
    const listContainer = document.getElementById('items-list-container');
    const searchQuery = document.getElementById('search-item').value.toLowerCase().trim();
    
    // Filter items
    const filteredItems = items.filter(item => item.name.toLowerCase().includes(searchQuery));

    if (filteredItems.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m21 21-4.3-4.3"/><path d="M8 12h8"/></svg>
                <p>${searchQuery ? '검색 결과에 부합하는 품목이 없습니다.' : '등록된 품목이 없습니다.'}</p>
            </div>
        `;
        updateHeaderStats();
        return;
    }

    listContainer.innerHTML = filteredItems.map(item => {
        const brandDisp = getFormattedBrandDisplay(item.brand);
        const brandHtml = brandDisp ? `<span class="item-brand-txt">${escapeHtml(brandDisp)}</span>` : '';
        return `
            <div class="item-card" data-id="${item.id}">
                <div class="item-info">
                    <span class="item-name-txt">
                        ${escapeHtml(item.name)}
                        ${brandHtml}
                    </span>
                    <span class="item-raw-txt">구매: ${formatNumber(item.qty)}${item.unit} / ${formatNumber(item.price)}원</span>
                    <span class="item-unit-cost-txt">${item.basePrice.toFixed(2)}원 / ${item.baseUnit}</span>
                </div>
                <div class="item-actions">
                    <button class="action-btn edit-btn" title="수정">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    </button>
                    <button class="action-btn delete-btn" title="삭제">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    updateHeaderStats();
    renderAvailableItemChips();
}

function renderAvailableItemChips() {
    const container = document.getElementById('recipe-items-chip-list');
    if (!container) return;
    
    if (items.length === 0) {
        container.innerHTML = '<span class="text-muted" style="font-size: 13px;">등록된 품목이 없습니다.</span>';
        return;
    }
    
    container.innerHTML = items.map(item => {
        const brandDisp = getFormattedBrandDisplay(item.brand);
        const brandStr = brandDisp ? `<span class="chip-brand">${escapeHtml(brandDisp)}</span>` : '';
        return `
            <button type="button" class="item-chip-btn" data-item-id="${item.id}" data-unit="${item.baseUnit}">
                <span>${escapeHtml(item.name)}</span>
                ${brandStr}
                <span class="chip-price">(${item.basePrice.toFixed(1)}원/${item.baseUnit})</span>
            </button>
        `;
    }).join('');
    
    container.querySelectorAll('.item-chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.item-chip-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const itemId = btn.getAttribute('data-item-id');
            const unit = btn.getAttribute('data-unit');
            const selectedItem = items.find(i => i.id === itemId);
            
            const selectedInput = document.getElementById('selected-recipe-item-id');
            if (selectedInput) selectedInput.value = itemId;
            
            const unitDisplay = document.getElementById('recipe-item-unit-display');
            if (unitDisplay) unitDisplay.textContent = unit || 'g';
            
            const displayEl = document.getElementById('selected-item-display');
            if (displayEl && selectedItem) {
                const brandDisp = getFormattedBrandDisplay(selectedItem.brand);
                displayEl.innerHTML = `📌 <strong>${escapeHtml(selectedItem.name)}</strong> ${brandDisp ? `<span style="color:var(--accent-primary); margin-left:4px;">${escapeHtml(brandDisp)}</span>` : ''}`;
            }
        });
    });
}

function handleAddRecipeItem() {
    const selectedInput = document.getElementById('selected-recipe-item-id');
    const itemId = selectedInput ? selectedInput.value : '';
    const qtyInput = document.getElementById('recipe-item-qty');
    const usageQty = parseFloat(qtyInput.value);

    if (!itemId) {
        showToast('위 전체 등록 품목 목록에서 추가할 품목을 먼저 선택해주세요.', 'danger');
        return;
    }

    if (isNaN(usageQty) || usageQty <= 0) {
        showToast('올바른 사용 수량을 입력해주세요.', 'danger');
        return;
    }

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const existingIng = activeRecipe.ingredients.find(i => i.itemId === item.id);
    if (existingIng) {
        existingIng.usageQty += usageQty;
    } else {
        activeRecipe.ingredients.push({
            id: 'ing-' + Date.now(),
            itemId: item.id,
            usageQty: usageQty,
            name: item.name,
            brand: item.brand,
            price: item.price,
            qty: item.qty,
            unit: item.unit,
            basePrice: item.basePrice,
            baseUnit: item.baseUnit
        });
    }

    qtyInput.value = '';
    saveActiveRecipeToLocalStorage();
    renderRecipeIngredientsTable();
    showToast(`"${item.name}" 재료가 레시피에 성공적으로 추가되었습니다.`, 'success');
}

function handleParseChatRecipe() {
    const inputEl = document.getElementById('chat-recipe-input');
    const text = inputEl ? inputEl.value.trim() : '';
    
    if (!text) {
        showToast('채팅/텍스트 형식의 레시피를 입력해주세요.', 'danger');
        return;
    }
    
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;
    
    let recipeTitle = '';
    let ingredientLines = [];
    
    const recipeLineIdx = lines.findIndex(l => l.includes('레시피'));
    if (recipeLineIdx > -1) {
        recipeTitle = lines[recipeLineIdx].replace(/레시피/g, '').trim() || lines[recipeLineIdx];
        if (!recipeTitle.includes('레시피')) recipeTitle += ' 레시피';
        ingredientLines = lines.filter((_, idx) => idx !== recipeLineIdx);
    } else {
        if (!/\d+\s*(g|kg|ml|L|스푼|EA)$/i.test(lines[0])) {
            recipeTitle = lines[0];
            ingredientLines = lines.slice(1);
        } else {
            recipeTitle = '자유 입력 레시피';
            ingredientLines = [...lines];
        }
    }
    
    activeRecipe.name = recipeTitle;
    document.getElementById('recipe-name').value = recipeTitle;
    activeRecipe.ingredients = [];
    
    let addedCount = 0;
    let unmatchedCount = 0;
    
    ingredientLines.forEach((line, lineIndex) => {
        // 불필요한 기호(-, *, :, • 등) 제거
        const cleanLine = line.replace(/^[-*•\s:]+/, '').trim();
        // 품목명 수량 단위 파싱 정규식 (예: 돈육 후지: 100g, - 고추장 50 g, MSG 10g 등)
        const match = cleanLine.match(/^(.+?)\s*[:=-]?\s*([\d.,]+)\s*(g|kg|ml|L|스푼|EA)$/i);
        if (match) {
            const rawName = match[1].trim();
            const rawQty = parseFloat(match[2].replace(/,/g, ''));
            const rawUnit = match[3].trim();
            
            if (!rawName || isNaN(rawQty)) return;
            
            let normUnit = rawUnit;
            if (normUnit.toLowerCase() === 'g') normUnit = 'g';
            if (normUnit.toLowerCase() === 'kg') normUnit = 'kg';
            if (normUnit.toLowerCase() === 'ml') normUnit = 'ml';
            if (normUnit.toLowerCase() === 'l') normUnit = 'L';
            if (normUnit.toLowerCase() === 'ea') normUnit = 'EA';
            
            const baseUnit = getBaseUnit(normUnit);
            const usageQtyInBaseUnit = convertToMinUnitQty(rawQty, normUnit);
            
            // 1. 정확한 이름 매칭 시도
            let matchedItem = items.find(i => i.name.trim().toLowerCase() === rawName.toLowerCase());
            
            // 2. 정확히 일치하는 게 없을 경우 부분/유사 매칭(Fuzzy Match) 시도
            if (!matchedItem) {
                const cleanRaw = rawName.replace(/\s+/g, '').toLowerCase();
                matchedItem = items.find(i => {
                    const cleanItemName = i.name.replace(/\s+/g, '').toLowerCase();
                    return cleanItemName.includes(cleanRaw) || cleanRaw.includes(cleanItemName);
                });
            }
            
            if (matchedItem) {
                activeRecipe.ingredients.push({
                    id: 'ing-' + Date.now() + '-' + lineIndex,
                    itemId: matchedItem.id,
                    rawName: rawName,
                    usageQty: usageQtyInBaseUnit,
                    name: matchedItem.name,
                    brand: matchedItem.brand,
                    price: matchedItem.price,
                    qty: matchedItem.qty,
                    unit: matchedItem.unit,
                    basePrice: matchedItem.basePrice,
                    baseUnit: matchedItem.baseUnit
                });
                addedCount++;
            } else {
                activeRecipe.ingredients.push({
                    id: 'ing-' + Date.now() + '-' + lineIndex,
                    itemId: '',
                    rawName: rawName,
                    usageQty: usageQtyInBaseUnit,
                    baseUnit: baseUnit,
                    name: rawName,
                    brand: '',
                    price: 0,
                    qty: 0,
                    unit: normUnit,
                    basePrice: 0
                });
                unmatchedCount++;
            }
        }
    });
    
    saveActiveRecipeToLocalStorage();
    renderRecipeIngredientsTable();
    collapseSavedRecipesDB();
    
    if (addedCount > 0 || unmatchedCount > 0) {
        if (unmatchedCount > 0) {
            showToast(`총 ${addedCount + unmatchedCount}개 재료 등록 완료! (${unmatchedCount}개 품목은 등록 품목 선택 또는 신규 등록 필요)`, 'danger');
        } else {
            showToast(`"${recipeTitle}" 레시피가 성공적으로 등록되었습니다.`, 'success');
        }
    } else {
        showToast('인식할 수 있는 재료 라인을 찾지 못했습니다. (예: 고추장 50g)', 'danger');
    }
}

function handleIngredientMatchChange(ingId, selectedItemId) {
    const ing = activeRecipe.ingredients.find(i => i.id === ingId);
    if (!ing) return;
    
    ing.itemId = selectedItemId;
    const item = items.find(i => i.id === selectedItemId);
    if (item) {
        ing.name = item.name;
        ing.brand = item.brand;
        ing.price = item.price;
        ing.qty = item.qty;
        ing.unit = item.unit;
        ing.basePrice = item.basePrice;
        ing.baseUnit = item.baseUnit;
        showToast(`"${item.name}" 품목으로 매칭 연동되었습니다.`, 'success');
    }
    renderRecipeIngredientsTable();
}

function openQuickItemModal(ingId, rawName, baseUnit) {
    document.getElementById('quick-item-temp-id').value = ingId;
    document.getElementById('quick-item-name').value = rawName || '';
    document.getElementById('quick-item-brand').value = '';
    document.getElementById('quick-item-price').value = '';
    document.getElementById('quick-item-qty').value = '';
    document.getElementById('quick-item-unit').value = baseUnit || 'g';
    
    // Render existing items inside modal select dropdown
    const selectEl = document.getElementById('quick-item-existing-select');
    if (selectEl) {
        let optionsHtml = '<option value="">-- 기존 품목 중에서 연결할 품목 선택 --</option>';
        items.forEach(item => {
            const brandDisp = getFormattedBrandDisplay(item.brand);
            const brandStr = brandDisp ? ` [${brandDisp}]` : '';
            optionsHtml += `<option value="${item.id}">${escapeHtml(item.name)}${escapeHtml(brandStr)} (${item.basePrice.toFixed(1)}원/${item.baseUnit})</option>`;
        });
        selectEl.innerHTML = optionsHtml;
        selectEl.value = '';
    }

    document.getElementById('quick-item-modal').classList.remove('hidden');
}

function closeQuickItemModal() {
    document.getElementById('quick-item-modal').classList.add('hidden');
    document.getElementById('quick-item-form').reset();
}

function handleQuickItemSubmit(e) {
    e.preventDefault();
    const ingId = document.getElementById('quick-item-temp-id').value;
    const existingItemId = document.getElementById('quick-item-existing-select').value;

    // 1. 기존 품목으로 매칭 선택 시
    if (existingItemId) {
        handleIngredientMatchChange(ingId, existingItemId);
        closeQuickItemModal();
        return;
    }

    // 2. 신규 품목으로 등록 시
    const name = document.getElementById('quick-item-name').value.trim();
    const brand = document.getElementById('quick-item-brand').value.trim();
    const price = parseFloat(document.getElementById('quick-item-price').value);
    const qty = parseFloat(document.getElementById('quick-item-qty').value);
    const unit = document.getElementById('quick-item-unit').value;

    if (!name || isNaN(price) || isNaN(qty)) {
        showToast('기존 품목을 선택하거나, 신규 품목의 정보(이름, 가격, 수량)를 올바르게 입력해주세요.', 'danger');
        return;
    }

    const baseUnit = getBaseUnit(unit);
    const basePrice = calculateBaseUnitPrice(price, qty, unit);

    const newItem = {
        id: 'item-' + Date.now(),
        name,
        brand,
        price,
        qty,
        unit,
        basePrice,
        baseUnit,
        batches: [{ price, qty, unit, createdAt: new Date().toISOString() }]
    };

    items.push(newItem);
    saveItemsToLocalStorage();

    const ing = activeRecipe.ingredients.find(i => i.id === ingId);
    if (ing) {
        ing.itemId = newItem.id;
        ing.name = newItem.name;
        ing.brand = newItem.brand;
        ing.price = newItem.price;
        ing.qty = newItem.qty;
        ing.unit = newItem.unit;
        ing.basePrice = newItem.basePrice;
        ing.baseUnit = newItem.baseUnit;
    }

    closeQuickItemModal();
    renderRecipeIngredientsTable();
    showToast(`신규 품목 "${name}"이(가) 등록되어 레시피에 연결되었습니다.`, 'success');
}

function removeRecipeIngredient(ingId, itemId) {
    activeRecipe.ingredients = activeRecipe.ingredients.filter(ing => {
        if (ingId && ing.id === ingId) return false;
        if (itemId && ing.itemId === itemId) return false;
        return true;
    });
    saveActiveRecipeToLocalStorage();
    renderRecipeIngredientsTable();
    showToast('품목/포장재가 레시피에서 제외되었습니다.', 'success');
}

function renderRecipeIngredientsTable() {
    const tbody = document.getElementById('recipe-ingredients-tbody');
    const summaryBox = document.getElementById('recipe-included-summary-box');
    
    // Update top included ingredients summary badges
    if (summaryBox) {
        if (activeRecipe.ingredients.length > 0) {
            const chipsHtml = activeRecipe.ingredients.map(ing => {
                const item = items.find(i => i.id === ing.itemId);
                const name = ing.name || (item ? item.name : '미등록');
                const brandDisp = getFormattedBrandDisplay(ing.brand || (item ? item.brand : ''));
                const brandStr = brandDisp ? ` ${brandDisp}` : '';
                const unit = item ? item.baseUnit : (ing.baseUnit || 'g');
                return `<div class="included-ing-badge">
                    <span>${escapeHtml(name)}${escapeHtml(brandStr)}</span>
                    <strong>${formatNumber(ing.usageQty)}${unit}</strong>
                </div>`;
            }).join('');

            summaryBox.style.display = 'block';
            summaryBox.innerHTML = `
                <div class="recipe-included-header">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    <span>🍳 레시피 포함 품목 목록 (총 ${activeRecipe.ingredients.length}개)</span>
                </div>
                <div class="recipe-included-chips">
                    ${chipsHtml}
                </div>
            `;
        } else {
            summaryBox.style.display = 'none';
            summaryBox.innerHTML = '';
        }
    }

    // Split ingredients into general ingredients vs packaging items (EA)
    const generalIngs = activeRecipe.ingredients.filter(ing => {
        const item = items.find(i => i.id === ing.itemId);
        return !(item && item.baseUnit === 'EA');
    });
    
    const packagingIngs = activeRecipe.ingredients.filter(ing => {
        const item = items.find(i => i.id === ing.itemId);
        return item && item.baseUnit === 'EA';
    });

    if (generalIngs.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-table-row">
                <td colspan="6" class="text-center text-muted py-8">
                    레시피에 추가된 식자재가 없습니다. 위에서 품목을 선택해보세요.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = generalIngs.map((ing, idx) => {
            const ingId = ing.id || ('ing-idx-' + idx);
            ing.id = ingId;
            const item = items.find(i => i.id === ing.itemId);

            if (item) {
                const fifoPrice = calculateFifoUnitPrice(item, ing.usageQty);
                const cost = fifoPrice * ing.usageQty;
                const baseUnit = item.baseUnit || ing.baseUnit || 'g';
                const brandDisp = getFormattedBrandDisplay(item.brand);
                
                return `
                    <tr data-ing-id="${ingId}" data-item-id="${item.id}">
                        <td>
                            <div class="ingredient-item-title-row" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span class="ingredient-item-name" style="font-weight: 700; font-size: 15px; color: var(--text-primary);">
                                    ${escapeHtml(item.name)}
                                </span>
                                ${brandDisp ? `<span class="item-brand-txt" style="font-size: 12px; color: var(--accent-primary); font-weight: 600; background: rgba(99, 102, 241, 0.1); padding: 2px 8px; border-radius: 6px;">${escapeHtml(brandDisp)}</span>` : ''}
                            </div>
                        </td>
                        <td class="text-right text-muted">${formatNumber(item.qty)}${item.unit} / ${formatNumber(item.price)}원</td>
                        <td class="text-right">
                            ${fifoPrice.toFixed(2)}원/${baseUnit}
                            <span class="fifo-unit-badge">선입선출</span>
                        </td>
                        <td class="text-right">
                            <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 4px;">
                                <input type="number" class="ingredient-usage-input" data-ing-id="${ingId}" value="${ing.usageQty}" min="0.001" step="any"
                                    style="width: 90px; height: 34px; padding: 4px 8px; text-align: right; font-size: 14px; font-weight: 600; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-input); color: var(--text-primary);">
                                <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">${baseUnit}</span>
                            </div>
                        </td>
                        <td class="text-right" style="font-weight: 700; color: var(--accent-success);">${formatNumber(Math.round(cost))}원</td>
                        <td class="text-center">
                            <button class="ingredient-row-delete-btn" data-ing-id="${ingId}" data-item-id="${item.id}" title="제외">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                            </button>
                        </td>
                    </tr>
                `;
            } else {
                const rawName = ing.rawName || ing.name || '미등록 품목';
                const baseUnit = ing.baseUnit || 'g';

                return `
                    <tr data-ing-id="${ingId}">
                        <td>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <div style="font-weight: 700; font-size: 14px; color: var(--accent-danger);">
                                    📝 미등록 품목: ${escapeHtml(rawName)}
                                </div>
                                <div>
                                    <button type="button" class="unregistered-item-btn" data-ing-id="${ingId}" data-raw-name="${escapeHtml(rawName)}" data-base-unit="${baseUnit}">
                                        ➕ "${escapeHtml(rawName)}" 신규 품목 등록
                                    </button>
                                </div>
                            </div>
                        </td>
                        <td class="text-right text-muted">-</td>
                        <td class="text-right text-muted" style="color: #f59e0b; font-weight: 500;">단가 미등록</td>
                        <td class="text-right">
                            <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 4px;">
                                <input type="number" class="ingredient-usage-input" data-ing-id="${ingId}" value="${ing.usageQty}" min="0.001" step="any"
                                    style="width: 90px; height: 34px; padding: 4px 8px; text-align: right; font-size: 14px; font-weight: 600; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-input); color: var(--text-primary);">
                                <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">${baseUnit}</span>
                            </div>
                        </td>
                        <td class="text-right" style="font-weight: 700; color: var(--text-muted);">0원</td>
                        <td class="text-center">
                            <button class="ingredient-row-delete-btn" data-ing-id="${ingId}" title="제외">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                            </button>
                        </td>
                    </tr>
                `;
            }
        }).join('');
    }

    // Render Packaging Table Window
    const pkgTbody = document.getElementById('recipe-packaging-tbody');
    if (pkgTbody) {
        if (packagingIngs.length === 0) {
            pkgTbody.innerHTML = `
                <tr class="empty-table-row">
                    <td colspan="6" class="text-center text-muted py-6">
                        적용된 포장재가 없습니다. 품목 목록에서 포장재(EA/개) 선택 시 여기에 추가됩니다.
                    </td>
                </tr>
            `;
            pkgTbody.innerHTML = packagingIngs.map((ing, idx) => {
                const ingId = ing.id || ('pkg-idx-' + idx + '-' + Date.now());
                ing.id = ingId;
                const item = items.find(i => i.id === ing.itemId);
                const fifoPrice = item ? calculateFifoUnitPrice(item, ing.usageQty) : (ing.basePrice || 0);
                const cost = fifoPrice * ing.usageQty;
                const brandDisp = item ? getFormattedBrandDisplay(item.brand) : '';
                
                return `
                    <tr data-ing-id="${ingId}" data-item-id="${item ? item.id : ''}">
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-weight: 700; font-size: 15px; color: var(--accent-success);">
                                    📦 ${escapeHtml(item ? item.name : ing.name)}
                                </span>
                                ${brandDisp ? `<span class="item-brand-txt">${escapeHtml(brandDisp)}</span>` : ''}
                            </div>
                        </td>
                        <td class="text-right text-muted">${item ? formatNumber(item.qty) + item.unit + ' / ' + formatNumber(item.price) + '원' : '-'}</td>
                        <td class="text-right" style="font-weight: 600;">${fifoPrice.toFixed(1)}원/개</td>
                        <td class="text-right">
                            <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 4px;">
                                <input type="number" class="ingredient-usage-input" data-ing-id="${ingId}" value="${ing.usageQty}" min="1" step="1"
                                    style="width: 80px; height: 34px; padding: 4px 8px; text-align: right; font-size: 14px; font-weight: 600; border: 1px solid var(--accent-success); border-radius: 6px; background: var(--bg-input); color: var(--text-primary);">
                                <span style="font-size: 13px; color: var(--text-secondary);">개</span>
                            </div>
                        </td>
                        <td class="text-right" style="font-weight: 700; color: var(--accent-success);">${formatNumber(Math.round(cost))}원</td>
                        <td class="text-center">
                            <button class="ingredient-row-delete-btn" data-ing-id="${ingId}" data-item-id="${item ? item.id : ''}" title="제외">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    renderRecipeSummary();
}

function renderRecipeSummary() {
    let ingredientsCostTotal = 0;
    let packagingCostFromItems = 0;

    activeRecipe.ingredients.forEach(ing => {
        const item = items.find(i => i.id === ing.itemId);
        if (item) {
            const fifoPrice = calculateFifoUnitPrice(item, ing.usageQty);
            if (item.baseUnit === 'EA') {
                packagingCostFromItems += fifoPrice * ing.usageQty;
            } else {
                ingredientsCostTotal += fifoPrice * ing.usageQty;
            }
        } else if (ing.basePrice) {
            ingredientsCostTotal += ing.basePrice * ing.usageQty;
        }
    });

    ingredientsCostTotal = Math.round(ingredientsCostTotal);
    const manualPackagingCost = Math.round(activeRecipe.packagingCost || 0);
    const packagingCost = manualPackagingCost + Math.round(packagingCostFromItems);
    const totalCost = ingredientsCostTotal + packagingCost;

    document.getElementById('ingredients-cost-total').textContent = formatNumber(ingredientsCostTotal);
    document.getElementById('packaging-cost-total').textContent = formatNumber(packagingCost);
    document.getElementById('recipe-total-cost').textContent = formatNumber(totalCost);

    // Update SVG Donut Chart
    updateDonutChart(ingredientsCostTotal, packagingCost, totalCost);
}

function updateDonutChart(ingCost, pkgCost, totalCost) {
    const chartWrapper = document.getElementById('chart-wrapper');
    if (totalCost === 0) {
        chartWrapper.style.opacity = '0.5';
        document.getElementById('donut-ingredients-segment').setAttribute('stroke-dasharray', '0 100');
        document.getElementById('donut-packaging-segment').setAttribute('stroke-dasharray', '0 100');
        document.getElementById('chart-total-cost-text').textContent = '0원';
        document.getElementById('legend-ingredients-val').textContent = '0원 (0%)';
        document.getElementById('legend-packaging-val').textContent = '0원 (0%)';
        return;
    }

    chartWrapper.style.opacity = '1';
    
    const ingPercent = (ingCost / totalCost) * 100;
    const pkgPercent = (pkgCost / totalCost) * 100;

    // SVG donut rings
    const ingSeg = document.getElementById('donut-ingredients-segment');
    ingSeg.setAttribute('stroke-dasharray', `${ingPercent.toFixed(1)} ${ (100 - ingPercent).toFixed(1) }`);
    ingSeg.setAttribute('stroke-dashoffset', '25'); 

    const pkgSeg = document.getElementById('donut-packaging-segment');
    pkgSeg.setAttribute('stroke-dasharray', `${pkgPercent.toFixed(1)} ${ (100 - pkgPercent).toFixed(1) }`);
    pkgSeg.setAttribute('stroke-dashoffset', `${ (25 - ingPercent).toFixed(1) }`);

    // Center Text
    document.getElementById('chart-total-cost-text').textContent = formatNumber(totalCost) + '원';
    
    // Legend labels
    document.getElementById('legend-ingredients-val').textContent = `${formatNumber(ingCost)}원 (${ingPercent.toFixed(0)}%)`;
    document.getElementById('legend-packaging-val').textContent = `${formatNumber(pkgCost)}원 (${pkgPercent.toFixed(0)}%)`;
}

function renderSavedRecipesList() {
    const listContainer = document.getElementById('recipes-list-container');

    if (savedRecipes.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
                <p>저장된 레시피가 없습니다.<br>계산된 레시피를 여기에 백업할 수 있습니다.</p>
            </div>
        `;
        return;
    }

    let gridHtml = '<div class="recipes-grid">';

    savedRecipes.forEach(recipe => {
        let ingCost = 0;
        recipe.ingredients.forEach(ing => {
            const item = items.find(i => i.id === ing.itemId);
            const basePrice = ing.basePrice !== undefined ? ing.basePrice : (item ? item.basePrice : 0);
            ingCost += basePrice * ing.usageQty;
        });
        const totalCost = Math.round(ingCost + recipe.packagingCost);
        const formattedDate = (recipe.createdAt && !isNaN(new Date(recipe.createdAt).getTime()))
            ? new Date(recipe.createdAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            })
            : '최근';

        const ingredientsBadgesHtml = recipe.ingredients.map(ing => {
            const item = items.find(i => i.id === ing.itemId);
            const name = ing.name || (item ? item.name : '미등록 품목');
            const brandDisp = getFormattedBrandDisplay(ing.brand || (item ? item.brand : ''));
            const brandStr = brandDisp ? ` ${brandDisp}` : '';
            const unit = item ? item.baseUnit : (ing.baseUnit || 'g');
            return `<span class="recipe-ing-tag" style="background: var(--bg-input); border: 1px solid var(--border-color); padding: 3px 8px; border-radius: 6px; font-size: 12px; color: var(--text-primary); font-weight: 500; display: inline-flex; align-items: center; gap: 4px;">
                ${escapeHtml(name)}${escapeHtml(brandStr)} <strong>${formatNumber(ing.usageQty)}${unit}</strong>
            </span>`;
        }).join('');

        gridHtml += `
            <div class="recipe-db-card" data-id="${recipe.id}">
                <div class="recipe-db-info">
                    <h3>${escapeHtml(recipe.name)}</h3>
                    <span class="recipe-db-date">저장일: ${formattedDate}</span>
                </div>
                <div class="recipe-db-ingredients-tags" style="display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0;">
                    ${ingredientsBadgesHtml}
                </div>
                <div class="recipe-db-cost-row">
                    <span class="recipe-db-label">총 원가:</span>
                    <span class="recipe-db-cost font-outfit">${formatNumber(totalCost)}원</span>
                </div>
                <div class="recipe-db-actions">
                    <button class="btn btn-secondary load-recipe-btn">불러오기</button>
                    <button class="btn btn-ghost delete-recipe-btn" style="color: var(--accent-danger);">삭제</button>
                </div>
            </div>
        `;
    });

    gridHtml += '</div>';
    listContainer.innerHTML = gridHtml;
}

// --- Toast & Utility Functions ---
function showToast(message, type = 'primary') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    if (type === 'success') {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m22 4-10 10.01-3-3"/></svg>';
    } else if (type === 'danger') {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>';
    } else {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
    }

    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse forwards';
        setTimeout(() => {
            if (toast.parentNode) {
                container.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

function formatNumber(num) {
    if (isNaN(num)) return '0';
    return Number(num).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function toggleSavedRecipesDB() {
    const card = document.getElementById('saved-recipes-card');
    if (card) {
        card.classList.toggle('collapsed');
    }
}

function collapseSavedRecipesDB() {
    const card = document.getElementById('saved-recipes-card');
    if (card && !card.classList.contains('collapsed')) {
        card.classList.add('collapsed');
    }
}

function expandSavedRecipesDB() {
    const card = document.getElementById('saved-recipes-card');
    if (card && card.classList.contains('collapsed')) {
        card.classList.remove('collapsed');
    }
}

// --- 인증 & 로그인 관리 ---
let _sessionDataLoaded = false;

function getCurrentUserId() {
    const raw = localStorage.getItem('rc_current_user') || '';
    return raw.trim().toLowerCase();
}

function checkLoginState() {
    const isLoggedIn = isUserLoggedIn();
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const userId = getCurrentUserId();

    const userBadge = document.getElementById('user-display-badge');
    if (userBadge && userId) userBadge.textContent = `👤 ${userId}`;

    if (isLoggedIn && userId) {
        if (loginContainer) { loginContainer.classList.add('hidden'); loginContainer.style.display = 'none'; }
        if (appContainer) { appContainer.classList.remove('hidden'); appContainer.style.display = 'block'; }

        if (!_sessionDataLoaded) {
            loadAndReconcileUserData(userId);
        } else {
            renderAll();
        }
    } else {
        _sessionDataLoaded = false;
        if (loginContainer) { loginContainer.classList.remove('hidden'); loginContainer.style.display = 'flex'; }
        if (appContainer) { appContainer.classList.add('hidden'); appContainer.style.display = 'none'; }
    }
}

async function handleLoginSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const idInput = document.getElementById('login-id');
    const pwInput = document.getElementById('login-pw');
    const rememberMeCheckbox = document.getElementById('remember-me');
    const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : true;
    const rawId = idInput ? idInput.value.trim() : '';
    const inputPw = pwInput ? pwInput.value.trim() : '';

    if (!rawId || !inputPw) {
        showToast('아이디와 비밀번호를 입력해주세요.', 'danger');
        return;
    }

    const inputId = rawId.toLowerCase();

    // 1. 백엔드가 명시적으로 활성화된 환경에서만 서버 인증 시도
    if (isServerAvailable()) {
        try {
            const resp = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: inputId, pw: inputPw })
            });
            if (resp.ok) {
                const result = await resp.json();
                if (result.ok) {
                    localStorage.setItem('rc_current_user', inputId);
                    sessionStorage.setItem('rc_logged_in', 'true');
                    if (rememberMe) {
                        localStorage.setItem('rc_logged_in', 'true');
                    } else {
                        localStorage.removeItem('rc_logged_in');
                    }
                    _sessionDataLoaded = false;
                    if (idInput) idInput.value = '';
                    if (pwInput) pwInput.value = '';
                    checkLoginState();
                    const msg = result.isNew ? `새 계정 "${inputId}"(으)로 가입 및 로그인되었습니다.` : `"${inputId}" 계정으로 로그인했습니다.`;
                    showToast(msg, 'success');
                    return;
                }
                showToast(result.msg || '아이디 또는 비밀번호가 올바르지 않습니다.', 'danger');
                return;
            }
        } catch (err) {
            console.warn('[RC] 서버 인증 실패, 브라우저 저장 모드로 전환:', err);
        }
    }

    // 2. 서버가 없는 환경(GitHub Pages 모드) 오프라인 계정 로직
    let offlineUsers = {};
    try {
        const storedUsers = localStorage.getItem('rc_offline_users');
        if (storedUsers) offlineUsers = JSON.parse(storedUsers);
    } catch (e) {
        offlineUsers = {};
    }

    // 기본 admin 계정 보장
    if (!offlineUsers['admin']) {
        offlineUsers['admin'] = 'admin';
    }

    if (offlineUsers[inputId]) {
        if (offlineUsers[inputId] !== inputPw) {
            showToast('비밀번호가 올바르지 않습니다.', 'danger');
            return;
        }
    } else {
        offlineUsers[inputId] = inputPw;
        try {
            localStorage.setItem('rc_offline_users', JSON.stringify(offlineUsers));
        } catch (e) {}
    }

    localStorage.setItem('rc_current_user', inputId);
    sessionStorage.setItem('rc_logged_in', 'true');
    if (rememberMe) {
        localStorage.setItem('rc_logged_in', 'true');
    } else {
        localStorage.removeItem('rc_logged_in');
    }
    _sessionDataLoaded = false;
    if (idInput) idInput.value = '';
    if (pwInput) pwInput.value = '';
    checkLoginState();
    showToast(`"${inputId}" 계정으로 로그인했습니다. (로컬/깃허브 모드)`, 'info');
}

function handleLogout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        saveDataOnly(); // 로그아웃 전 즉시 저장
        saveToServer(); // 서버 파일에도 저장
        clearActiveRecipeForm(true); // 로그아웃 시 레시피 입력창 초기화
        sessionStorage.removeItem('rc_logged_in');
        localStorage.removeItem('rc_logged_in');
        _sessionDataLoaded = false;
        checkLoginState();
        showToast('로그아웃 되었습니다.', 'primary');
    }
}

function openPwChangeModal() {
    document.getElementById('pw-change-modal').classList.remove('hidden');
    document.getElementById('current-pw').focus();
}

function closePwChangeModal() {
    document.getElementById('pw-change-modal').classList.add('hidden');
    document.getElementById('current-pw').value = '';
    document.getElementById('new-pw').value = '';
    document.getElementById('new-pw-confirm').value = '';
}

async function handlePwChangeSubmit(e) {
    e.preventDefault();
    const currentPw = document.getElementById('current-pw').value;
    const newPw = document.getElementById('new-pw').value;
    const newPwConfirm = document.getElementById('new-pw-confirm').value;

    if (newPw !== newPwConfirm) {
        showToast('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.', 'danger');
        return;
    }
    if (newPw.trim() === '') {
        showToast('새 비밀번호를 올바르게 입력해주세요.', 'danger');
        return;
    }

    const userId = getCurrentUserId();

    if (isServerAvailable()) {
        try {
            const verifyResp = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId, pw: currentPw })
            });
            const verifyResult = await verifyResp.json();
            if (!verifyResult.ok) {
                showToast('현재 비밀번호가 올바르지 않습니다.', 'danger');
                return;
            }
            await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId, pw: newPw, changePw: true, oldPw: currentPw })
            });
            closePwChangeModal();
            showToast('비밀번호가 성공적으로 변경되었습니다.', 'success');
            return;
        } catch(err) {
            showToast('서버 오류로 비밀번호를 변경하지 못했습니다.', 'danger');
            return;
        }
    }

    // GitHub Pages / 로컬 파일: 이 브라우저의 오프라인 계정 비밀번호 변경
    let offlineUsers = {};
    try {
        offlineUsers = JSON.parse(localStorage.getItem('rc_offline_users') || '{}');
    } catch (e) {}

    if (offlineUsers[userId] !== currentPw) {
        showToast('현재 비밀번호가 올바르지 않습니다.', 'danger');
        return;
    }

    offlineUsers[userId] = newPw;
    localStorage.setItem('rc_offline_users', JSON.stringify(offlineUsers));
    closePwChangeModal();
    showToast('이 브라우저에 저장된 비밀번호가 변경되었습니다.', 'success');
}

// --- Data Backup & Restore (JSON Export / Import) ---
function exportBackupData() {
    try {
        const backupObj = {
            appName: 'RecipeCost',
            version: '2.0',
            exportedAt: new Date().toISOString(),
            items: items,
            recipes: savedRecipes
        };
        const jsonStr = JSON.stringify(backupObj, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `recipe_cost_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('데이터 백업 파일이 다운로드되었습니다.', 'success');
    } catch (e) {
        showToast('백업 파일 생성 중 오류가 발생했습니다.', 'danger');
    }
}

function importBackupData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data && (Array.isArray(data.items) || Array.isArray(data.recipes))) {
                const itemCount = Array.isArray(data.items) ? data.items.length : 0;
                const recipeCount = Array.isArray(data.recipes) ? data.recipes.length : 0;
                
                if (confirm(`백업 파일에서 품목 ${itemCount}개, 레시피 ${recipeCount}개를 복원하시겠습니까? (기존 데이터가 교체됩니다)`)) {
                    if (Array.isArray(data.items)) items = data.items;
                    if (Array.isArray(data.recipes)) savedRecipes = data.recipes;
                    
                    saveItemsToLocalStorage();
                    saveRecipesToLocalStorage();
                    renderAll();
                    showToast('백업 데이터가 성공적으로 복원되었습니다!', 'success');
                }
            } else {
                showToast('올바르지 않은 백업 파일 형식입니다.', 'danger');
            }
        } catch (err) {
            showToast('백업 파일을 읽는 중 오류가 발생했습니다.', 'danger');
        }
    };
    reader.readAsText(file);
}
