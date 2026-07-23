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
    { id: 'def-1', name: '고추장', brand: '해찬들', price: 10000, qty: 10, unit: 'kg', basePrice: 1, baseUnit: 'g' },
    { id: 'def-2', name: '참기름', brand: '백설', price: 15000, qty: 1.8, unit: 'L', basePrice: 8.33, baseUnit: 'ml' },
    { id: 'def-3', name: '달걀', brand: '목초란', price: 6000, qty: 30, unit: 'EA', basePrice: 200, baseUnit: 'EA' }
];

const defaultRecipes = [
    {
        id: 'rec-def-1',
        name: '비빔밥 소스 v1',
        packagingCost: 500,
        ingredients: [
            { itemId: 'def-1', usageQty: 50 }, // 고추장 50g -> 50원
            { itemId: 'def-2', usageQty: 15 }  // 참기름 15ml -> 125원 (8.33 * 15 = 124.95)
        ],
        createdAt: new Date().toISOString()
    }
];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadFromLocalStorage();
    initEventListeners();
    checkLoginState();
});

// --- LocalStorage Logic ---
function loadFromLocalStorage() {
    initCredentials();
    // Load Items
    const storedItems = localStorage.getItem('rc_items');
    if (storedItems) {
        items = JSON.parse(storedItems);
    } else {
        items = [...defaultItems];
        localStorage.setItem('rc_items', JSON.stringify(items));
    }

    // Load Recipes
    const storedRecipes = localStorage.getItem('rc_recipes');
    if (storedRecipes) {
        savedRecipes = JSON.parse(storedRecipes);
    } else {
        savedRecipes = [...defaultRecipes];
        localStorage.setItem('rc_recipes', JSON.stringify(savedRecipes));
    }
}

// Ensure items save triggers render and dropdown updates
function saveItemsToLocalStorage() {
    localStorage.setItem('rc_items', JSON.stringify(items));
    renderItemsList();
    updateItemSelectDropdown();
}

function saveRecipesToLocalStorage() {
    localStorage.setItem('rc_recipes', JSON.stringify(savedRecipes));
    renderSavedRecipesList();
    updateHeaderStats();
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
        default:
            return 'g';
    }
}

function convertToMinUnitQty(qty, unit) {
    if (unit === 'kg' || unit === 'L') {
        return qty * 1000;
    }
    return qty; // g, ml, EA
}

function convertQty(qty, fromUnit, toUnit) {
    if (fromUnit === toUnit) return qty;
    // weight
    if (fromUnit === 'kg' && toUnit === 'g') return qty * 1000;
    if (fromUnit === 'g' && toUnit === 'kg') return qty / 1000;
    // volume
    if (fromUnit === 'L' && toUnit === 'ml') return qty * 1000;
    if (fromUnit === 'ml' && toUnit === 'L') return qty / 1000;
    return qty; // EA or fallback
}

function calculateBaseUnitPrice(price, qty, unit) {
    const minQty = convertToMinUnitQty(qty, unit);
    if (minQty <= 0) return 0;
    return price / minQty;
}

// --- Event Listeners ---
function initEventListeners() {
    // Theme Toggle
    document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);

    // Item Master Form Submit
    const itemForm = document.getElementById('item-master-form');
    itemForm.addEventListener('submit', handleItemFormSubmit);

    // Cancel Edit Button
    document.getElementById('item-cancel-edit-btn').addEventListener('click', cancelItemEdit);

    // Item Search
    document.getElementById('search-item').addEventListener('input', renderItemsList);

    // Event Delegation: Item Master List Edit/Delete Buttons
    document.getElementById('items-list-container').addEventListener('click', (e) => {
        const card = e.target.closest('.item-card');
        if (!card) return;
        const id = card.dataset.id;

        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            editItem(id);
        } else if (deleteBtn) {
            deleteItem(id);
        }
    });

    // Recipe Item Select Event (to display correct usage unit)
    document.getElementById('recipe-item-select').addEventListener('change', handleRecipeItemSelectChange);

    // Add ingredient to recipe
    document.getElementById('add-recipe-item-btn').addEventListener('click', handleAddRecipeItem);

    // Event Delegation: Recipe Ingredients Table Delete Button
    document.getElementById('recipe-ingredients-tbody').addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.ingredient-row-delete-btn');
        if (deleteBtn) {
            const itemId = deleteBtn.dataset.itemId;
            removeRecipeIngredient(itemId);
        }
    });

    // Packaging Cost inputs
    document.getElementById('packaging-cost').addEventListener('input', (e) => {
        activeRecipe.packagingCost = parseFloat(e.target.value) || 0;
        renderRecipeSummary();
    });

    document.getElementById('recipe-name').addEventListener('input', (e) => {
        activeRecipe.name = e.target.value || '새 레시피';
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

    // Collapse Saved Recipes DB card when starting to enter/edit a recipe
    const recipeInputs = ['recipe-name', 'packaging-cost', 'recipe-item-select', 'recipe-item-qty'];
    recipeInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('focus', collapseSavedRecipesDB);
            el.addEventListener('input', collapseSavedRecipesDB);
        }
    });

    // Auth Event Listeners
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
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
}

// --- Item Form Actions ---
function handleItemFormSubmit(e) {
    e.preventDefault();

    const editId = document.getElementById('edit-item-id').value;
    const name = document.getElementById('item-name').value.trim();
    const brand = document.getElementById('item-brand').value.trim();
    const price = parseFloat(document.getElementById('purchase-price').value);
    const qty = parseFloat(document.getElementById('purchase-qty').value);
    const unit = document.getElementById('purchase-unit').value;

    if (!name || isNaN(price) || isNaN(qty)) {
        showToast('올바른 값을 입력해주세요.', 'danger');
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
            // Check compatible unit classes (weight vs volume vs EA)
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

            // Accumulate
            const convertedNewQty = convertQty(qty, unit, existingItem.unit);
            existingItem.qty += convertedNewQty;
            existingItem.price += price;
            if (brand) {
                existingItem.brand = brand; // Overwrite or update with latest brand
            }
            existingItem.basePrice = calculateBaseUnitPrice(existingItem.price, existingItem.qty, existingItem.unit);

            showToast(`"${existingItem.name}" 품목에 수량(${qty}${unit})과 가격(${price}원)이 누적 합산되었습니다.`, 'success');
        } else {
            // Add new item
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
    renderRecipeIngredientsTable();
}

function editItem(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    document.getElementById('edit-item-id').value = item.id;
    document.getElementById('item-name').value = item.name;
    document.getElementById('item-brand').value = item.brand || '';
    document.getElementById('purchase-price').value = item.price;
    document.getElementById('purchase-qty').value = item.qty;
    document.getElementById('purchase-unit').value = item.unit;

    // Toggle Buttons
    document.getElementById('item-submit-btn').querySelector('span').textContent = '품목 수정하기';
    document.getElementById('item-cancel-edit-btn').classList.remove('hidden');

    document.getElementById('item-name').focus();
}

function cancelItemEdit() {
    document.getElementById('edit-item-id').value = '';
    document.getElementById('item-master-form').reset();
    document.getElementById('item-submit-btn').querySelector('span').textContent = '품목 등록하기';
    document.getElementById('item-cancel-edit-btn').classList.add('hidden');
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

function handleAddRecipeItem() {
    collapseSavedRecipesDB();
    const itemSelect = document.getElementById('recipe-item-select');
    const itemId = itemSelect.value;
    const qtyInput = document.getElementById('recipe-item-qty');
    const qty = parseFloat(qtyInput.value);

    if (!itemId) {
        showToast('추가할 품목을 선택해주세요.', 'danger');
        return;
    }

    if (isNaN(qty) || qty <= 0) {
        showToast('사용 수량을 올바르게 입력해주세요.', 'danger');
        return;
    }

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    // Check if item already exists in recipe
    const existingIndex = activeRecipe.ingredients.findIndex(ing => ing.itemId === itemId);
    if (existingIndex > -1) {
        activeRecipe.ingredients[existingIndex].usageQty += qty;
        // Update snapshot to the current master values
        activeRecipe.ingredients[existingIndex].name = item.name;
        activeRecipe.ingredients[existingIndex].brand = item.brand;
        activeRecipe.ingredients[existingIndex].price = item.price;
        activeRecipe.ingredients[existingIndex].qty = item.qty;
        activeRecipe.ingredients[existingIndex].unit = item.unit;
        activeRecipe.ingredients[existingIndex].basePrice = item.basePrice;
        activeRecipe.ingredients[existingIndex].baseUnit = item.baseUnit;
        showToast(`이미 등록된 재료 "${item.name}"의 사용량이 합산되었습니다.`, 'success');
    } else {
        activeRecipe.ingredients.push({
            itemId,
            usageQty: qty,
            name: item.name,
            brand: item.brand,
            price: item.price,
            qty: item.qty,
            unit: item.unit,
            basePrice: item.basePrice,
            baseUnit: item.baseUnit
        });
        showToast(`"${item.name}" 재료가 레시피에 추가되었습니다.`, 'success');
    }

    // Reset usage input
    qtyInput.value = '';
    
    renderRecipeIngredientsTable();
}

function removeRecipeIngredient(itemId) {
    activeRecipe.ingredients = activeRecipe.ingredients.filter(ing => ing.itemId !== itemId);
    renderRecipeIngredientsTable();
    showToast('재료가 레시피에서 제외되었습니다.', 'success');
}

function resetActiveRecipe() {
    if (confirm('레시피의 모든 내용을 초기화하시겠습니까?')) {
        activeRecipe = {
            name: '새 레시피',
            packagingCost: 0,
            ingredients: []
        };
        
        document.getElementById('recipe-name').value = '새 레시피';
        document.getElementById('packaging-cost').value = 0;
        document.getElementById('recipe-item-select').value = '';
        document.getElementById('recipe-item-qty').value = '';
        document.getElementById('recipe-item-unit-display').textContent = '-';
        
        renderRecipeIngredientsTable();
        expandSavedRecipesDB();
        showToast('레시피가 초기화되었습니다.', 'success');
    }
}

function saveActiveRecipe() {
    if (!activeRecipe.name || activeRecipe.name.trim() === '') {
        showToast('레시피 이름을 입력해주세요.', 'danger');
        return;
    }

    if (activeRecipe.ingredients.length === 0) {
        showToast('최소 한 개 이상의 재료가 필요합니다.', 'danger');
        return;
    }

    // Update ingredients snapshot values to the CURRENT master list item properties upon saving
    const updatedIngredients = activeRecipe.ingredients.map(ing => {
        const item = items.find(i => i.id === ing.itemId);
        if (item) {
            return {
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
        return { ...ing }; // Fallback to existing snapshot properties if item is deleted from master list
    });

    const newSavedRecipe = {
        id: 'recipe-' + Date.now(),
        name: activeRecipe.name,
        packagingCost: activeRecipe.packagingCost,
        ingredients: updatedIngredients,
        createdAt: new Date().toISOString()
    };

    // Check if updating recipe with same name or save as new
    const existingIndex = savedRecipes.findIndex(r => r.name === activeRecipe.name);
    if (existingIndex > -1) {
        showToast('동일한 이름의 레시피가 이미 존재합니다 (중복).', 'danger');
        if (confirm(`동일한 이름의 레시피 "${activeRecipe.name}"이(가) 이미 존재합니다 (중복). 덮어쓰시겠습니까?`)) {
            savedRecipes[existingIndex] = {
                ...newSavedRecipe,
                id: savedRecipes[existingIndex].id // keep original ID
            };
            activeRecipe.ingredients = JSON.parse(JSON.stringify(updatedIngredients));
            renderRecipeIngredientsTable();
            showToast('중복된 레시피를 성공적으로 덮어썼습니다.', 'success');
        } else {
            return;
        }
    } else {
        savedRecipes.push(newSavedRecipe);
        activeRecipe.ingredients = JSON.parse(JSON.stringify(updatedIngredients));
        renderRecipeIngredientsTable();
        showToast('레시피가 성공적으로 저장되었습니다.', 'success');
    }

    saveRecipesToLocalStorage();
}

function loadSavedRecipe(recipeId) {
    const saved = savedRecipes.find(r => r.id === recipeId);
    if (!saved) return;

    activeRecipe = {
        name: saved.name,
        packagingCost: saved.packagingCost,
        ingredients: JSON.parse(JSON.stringify(saved.ingredients)) // Freeze historical prices in activeRecipe
    };

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
    updateItemSelectDropdown();
    renderRecipeIngredientsTable();
    renderSavedRecipesList();
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
        const brandHtml = item.brand ? `<span class="item-brand-txt">${escapeHtml(item.brand)}</span>` : '';
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
}

function updateItemSelectDropdown() {
    const select = document.getElementById('recipe-item-select');
    
    // Keep the default first option
    select.innerHTML = '<option value="">-- 품목을 선택하세요 --</option>';
    
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        const brandStr = item.brand ? ` [${item.brand}]` : '';
        option.textContent = `${item.name}${brandStr} (${item.basePrice.toFixed(1)}원/${item.baseUnit})`;
        select.appendChild(option);
    });
}

function renderRecipeIngredientsTable() {
    const tbody = document.getElementById('recipe-ingredients-tbody');
    
    if (activeRecipe.ingredients.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-table-row">
                <td colspan="6" class="text-center text-muted py-8">
                    레시피에 추가된 재료가 없습니다. 위에서 재료를 선택해 추가해보세요.
                </td>
            </tr>
        `;
        renderRecipeSummary();
        return;
    }

    tbody.innerHTML = activeRecipe.ingredients.map(ing => {
        const item = items.find(i => i.id === ing.itemId);
        
        // Extract snapshot properties with fallbacks
        const basePrice = ing.basePrice !== undefined ? ing.basePrice : (item ? item.basePrice : 0);
        const baseUnit = ing.baseUnit || (item ? item.baseUnit : '');
        const name = ing.name || (item ? item.name : '삭제된 품목');
        const brand = ing.brand || (item ? item.brand : '');
        const qty = ing.qty !== undefined ? ing.qty : (item ? item.qty : 0);
        const unit = ing.unit || (item ? item.unit : '');
        const price = ing.price !== undefined ? ing.price : (item ? item.price : 0);

        const cost = basePrice * ing.usageQty;
        const brandHtml = brand ? `<span class="item-brand-txt">${escapeHtml(brand)}</span>` : '';

        if (!item && ing.basePrice === undefined) {
            // Backward compatibility for deleted items without snapshots
            return `
                <tr class="error-row" data-item-id="${ing.itemId}">
                    <td colspan="5" class="text-muted">삭제된 품목 (제거 필요)</td>
                    <td class="text-center">
                        <button class="ingredient-row-delete-btn" data-item-id="${ing.itemId}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                    </td>
                </tr>
            `;
        }

        return `
            <tr data-item-id="${ing.itemId}">
                <td style="font-weight: 600;">
                    ${escapeHtml(name)}
                    ${brandHtml}
                </td>
                <td class="text-right text-muted">${formatNumber(qty)}${unit} / ${formatNumber(price)}원</td>
                <td class="text-right">${basePrice.toFixed(2)}원/${baseUnit}</td>
                <td class="text-right" style="font-weight: 500;">${formatNumber(ing.usageQty)} ${baseUnit}</td>
                <td class="text-right" style="font-weight: 700; color: var(--accent-success);">${formatNumber(Math.round(cost))}원</td>
                <td class="text-center">
                    <button class="ingredient-row-delete-btn" data-item-id="${ing.itemId}" title="제외">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    renderRecipeSummary();
}

function renderRecipeSummary() {
    let ingredientsCostTotal = 0;

    activeRecipe.ingredients.forEach(ing => {
        const item = items.find(i => i.id === ing.itemId);
        const basePrice = ing.basePrice !== undefined ? ing.basePrice : (item ? item.basePrice : 0);
        ingredientsCostTotal += basePrice * ing.usageQty;
    });

    ingredientsCostTotal = Math.round(ingredientsCostTotal);
    const packagingCost = Math.round(activeRecipe.packagingCost);
    const totalCost = ingredientsCostTotal + packagingCost;

    // Update Dashboard values
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
        const formattedDate = new Date(recipe.createdAt).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        gridHtml += `
            <div class="recipe-db-card" data-id="${recipe.id}">
                <div class="recipe-db-info">
                    <h3>${escapeHtml(recipe.name)}</h3>
                    <span class="recipe-db-date">저장일: ${formattedDate}</span>
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

// --- Authentication & Password Management ---
function initCredentials() {
    if (!localStorage.getItem('rc_user_id')) {
        localStorage.setItem('rc_user_id', 'admin');
    }
    if (!localStorage.getItem('rc_user_pw')) {
        localStorage.setItem('rc_user_pw', 'admin');
    }
}

function checkLoginState() {
    const isLoggedIn = sessionStorage.getItem('rc_logged_in') === 'true' || localStorage.getItem('rc_logged_in') === 'true';
    if (isLoggedIn) {
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        renderAll();
    } else {
        document.getElementById('login-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
}

function handleLoginSubmit(e) {
    e.preventDefault();
    const idInput = document.getElementById('login-id').value;
    const pwInput = document.getElementById('login-pw').value;
    const rememberMe = document.getElementById('remember-me').checked;

    const savedId = localStorage.getItem('rc_user_id') || 'admin';
    const savedPw = localStorage.getItem('rc_user_pw') || 'admin';

    if (idInput === savedId && pwInput === savedPw) {
        if (rememberMe) {
            localStorage.setItem('rc_logged_in', 'true');
        } else {
            sessionStorage.setItem('rc_logged_in', 'true');
        }
        
        // Reset form inputs
        document.getElementById('login-id').value = '';
        document.getElementById('login-pw').value = '';
        document.getElementById('remember-me').checked = false;

        checkLoginState();
        showToast('성공적으로 로그인했습니다.', 'success');
    } else {
        showToast('아이디 또는 비밀번호가 올바르지 않습니다.', 'danger');
    }
}

function handleLogout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        sessionStorage.removeItem('rc_logged_in');
        localStorage.removeItem('rc_logged_in');
        checkLoginState();
        showToast('로그아웃 되었습니다.', 'success');
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

function handlePwChangeSubmit(e) {
    e.preventDefault();
    const currentPw = document.getElementById('current-pw').value;
    const newPw = document.getElementById('new-pw').value;
    const newPwConfirm = document.getElementById('new-pw-confirm').value;

    const savedPw = localStorage.getItem('rc_user_pw') || 'admin';

    if (currentPw !== savedPw) {
        showToast('현재 비밀번호가 올바르지 않습니다.', 'danger');
        return;
    }

    if (newPw !== newPwConfirm) {
        showToast('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.', 'danger');
        return;
    }

    if (newPw.trim() === '') {
        showToast('새 비밀번호를 올바르게 입력해주세요.', 'danger');
        return;
    }

    localStorage.setItem('rc_user_pw', newPw);
    closePwChangeModal();
    showToast('비밀번호가 성공적으로 변경되었습니다.', 'success');
}
