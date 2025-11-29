// ==========================================
// 1. CONFIGURATION & INITIALISATION FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCviy5lWve4UUaSpZTz9hnSPu16e_mO_2U",
  authDomain: "menu-generator-7c7bf.firebaseapp.com",
  databaseURL: "https://menu-generator-7c7bf-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "menu-generator-7c7bf",
  storageBucket: "menu-generator-7c7bf.firebasestorage.app",
  messagingSenderId: "760559115603",
  appId: "1:760559115603:web:30955099b520f65c3495a6"
};

// Initialisation immédiate et sécurisée
try {
  firebase.initializeApp(firebaseConfig);
} catch (e) {
  console.error("Erreur init Firebase:", e);
}
let database = typeof firebase !== 'undefined' ? firebase.database() : null;

// ==========================================
// 2. VARIABLES GLOBALES
// ==========================================
let groupId = localStorage.getItem('groupId') || '';
let dishes = [];
let menus = [];
let menuConfig = { 
  sportDays: [], 
  activeSeasons: ['Printemps', 'Été', 'Automne', 'Hiver'], 
  mealDuration: { lunch: 1, dinner: 1 } 
};
let newDishSeasons = [];
let editingDishId = null;
let activeFilters = [];

const seasons = ['Printemps', 'Été', 'Automne', 'Hiver'];
const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// ==========================================
// 3. FONCTIONS GLOBALES (DÉFINIES SUR WINDOW)
// ==========================================

// --- Navigation & Modales ---
window.switchToTab = function(tabName) {
  document.querySelectorAll('.tab-content').forEach(t => { t.classList.remove('active'); t.classList.add('hidden'); });
  document.querySelectorAll('.tab-bar .tab-btn').forEach(b => b.classList.remove('active'));
  
  const el = document.getElementById(tabName + 'Tab');
  if(el) { el.classList.add('active'); el.classList.remove('hidden'); }
  
  const btn = document.querySelector(`.tab-bar .tab-btn[data-tab="${tabName}"]`);
  if(btn) btn.classList.add('active');
  
  // Actions spécifiques par onglet
  if (tabName === 'dishes') renderDishes();
  if (tabName === 'menus') renderMenus();
  if (tabName === 'config') updateConfigDisplay();
  
  document.getElementById('fabAdd')?.classList.toggle('hidden', tabName !== 'dishes');
  document.getElementById('fabMenu')?.classList.toggle('hidden', tabName !== 'menus');
};

window.openModal = function(id) { document.getElementById(id)?.classList.add('active'); };
window.closeModal = function(id) { document.getElementById(id)?.classList.remove('active'); };

window.toggleMenuContent = function(id) {
  const content = document.getElementById(id);
  const icon = document.getElementById('icon-' + id);
  if (content && icon) {
    const isOpen = content.classList.contains('open');
    if (isOpen) { content.classList.remove('open'); icon.textContent = 'expand_more'; }
    else { content.classList.add('open'); icon.textContent = 'expand_less'; }
  }
};

// --- Actions Recettes ---
window.openAddDishModal = function() {
  editingDishId = null;
  document.getElementById('dishModalTitle').textContent = 'Nouveau plat';
  document.getElementById('saveDishBtn').textContent = 'Ajouter';
  document.getElementById('dishName').value = '';
  
  newDishSeasons = [];
  updateSeasonChipsUI(); // Reset visuel
  
  document.getElementById('sportDay').checked = false;
  document.getElementById('vegetarian').checked = false;
  document.getElementById('grillades').checked = false;
  document.getElementById('mealLunch').checked = true;
  document.getElementById('mealDinner').checked = true;
  
  window.openModal('addDishModal');
};

window.openEditDishModal = function(dishId) {
  const dish = dishes.find(d => d.id == dishId); // Comparaison souple
  if (!dish) return;

  editingDishId = dish.id;
  document.getElementById('dishModalTitle').textContent = 'Modifier le plat';
  document.getElementById('saveDishBtn').textContent = 'Modifier';
  document.getElementById('dishName').value = dish.name;
  
  newDishSeasons = [...(dish.seasons || [])]; 
  updateSeasonChipsUI(); 
  
  document.getElementById('sportDay').checked = dish.sportDay || false;
  document.getElementById('vegetarian').checked = dish.vegetarian || false;
  document.getElementById('grillades').checked = dish.grillades || false;
  
  const isLunch = !dish.mealType || dish.mealType.includes('lunch');
  const isDinner = !dish.mealType || dish.mealType.includes('dinner');
  document.getElementById('mealLunch').checked = isLunch;
  document.getElementById('mealDinner').checked = isDinner;
  
  window.openModal('addDishModal');
};

window.saveDish = function() {
  const name = document.getElementById('dishName').value.trim();
  if (!name || newDishSeasons.length === 0) {
    return window.showToast('❌ Nom et saison requis');
  }

  const mealTypes = [];
  if (document.getElementById('mealLunch').checked) mealTypes.push('lunch');
  if (document.getElementById('mealDinner').checked) mealTypes.push('dinner');
  if (!mealTypes.length) mealTypes.push('lunch', 'dinner');

  const dish = {
    id: editingDishId || Date.now(),
    name: name,
    seasons: newDishSeasons,
    mealType: mealTypes,
    sportDay: document.getElementById('sportDay').checked,
    vegetarian: document.getElementById('vegetarian').checked,
    grillades: document.getElementById('grillades').checked
  };

  if(database) database.ref(`groups/${groupId}/dishes/${dish.id}`).set(dish);
  window.showToast('✅ Enregistré !');
  window.closeModal('addDishModal');
};

window.deleteDish = function(id) {
  if (confirm('Supprimer ce plat ?')) {
    if (database) database.ref(`groups/${groupId}/dishes/${id}`).remove();
    window.showToast('✅ Supprimé');
  }
};

window.toggleFilter = function(filter) {
  if (activeFilters.includes(filter)) {
    activeFilters = activeFilters.filter(f => f !== filter);
    document.getElementById('filter_' + filter).classList.remove('active');
  } else {
    activeFilters.push(filter);
    document.getElementById('filter_' + filter).classList.add('active');
  }
  renderDishes();
};

// --- Actions Saisons (Modal) ---
window.toggleSeasonChip = function(season) {
  if (!newDishSeasons) newDishSeasons = [];
  if (newDishSeasons.includes(season)) {
    newDishSeasons = newDishSeasons.filter(s => s !== season);
  } else {
    newDishSeasons.push(season);
  }
  updateSeasonChipsUI();
};

function updateSeasonChipsUI() {
  document.querySelectorAll('#seasonsChips .chip').forEach(chip => {
    chip.classList.toggle('selected', newDishSeasons.includes(chip.textContent));
  });
}

// --- Configuration (Toggle & Set) ---
window.toggleConfigSeason = function(season) {
  let list = menuConfig.activeSeasons || [];
  if (list.includes(season)) list = list.filter(s => s !== season);
  else list.push(season);
  menuConfig.activeSeasons = list;
  if (database) database.ref(`groups/${groupId}/config`).set(menuConfig);
};

window.toggleSportDay = function(day) {
  let list = menuConfig.sportDays || [];
  if (list.includes(day)) list = list.filter(d => d !== day);
  else list.push(day);
  menuConfig.sportDays = list;
  if (database) database.ref(`groups/${groupId}/config`).set(menuConfig);
};

window.setMealDuration = function(meal, duration) {
  menuConfig.mealDuration = menuConfig.mealDuration || { lunch: 1, dinner: 1 };
  menuConfig.mealDuration[meal] = duration;
  if (database) database.ref(`groups/${groupId}/config`).set(menuConfig);
};

// --- Utilitaires divers ---
window.copyGroupId = function() {
  if(navigator.clipboard) navigator.clipboard.writeText(groupId).then(() => window.showToast('📋 Copié !'));
  else prompt('ID :', groupId);
};

window.showToast = function(msg) {
  const t = document.getElementById('customToast');
  const m = document.getElementById('toastMessage');
  if(t && m) { m.innerHTML = msg; t.classList.remove('hidden'); t.classList.add('show'); setTimeout(() => { t.classList.remove('show'); setTimeout(()=>t.classList.add('hidden'), 300); }, 3000); }
};

window.leaveGroup = function() {
  if(confirm('Quitter le groupe ?')) { localStorage.removeItem('groupId'); location.reload(); }
};

// ==========================================
// 4. RENDU & LOGIQUE INTERNE
// ==========================================

function updateConfigDisplay() {
  // Reconstruire les chips à chaque fois pour éviter qu'ils disparaissent
  const sportContainer = document.getElementById('sportDaysChipsDisplay');
  const seasonContainer = document.getElementById('seasonFilterChipsDisplay');
  
  if (sportContainer) {
    sportContainer.innerHTML = '';
    daysOfWeek.forEach(day => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = day;
      chip.id = 'sport_display_' + day;
      chip.onclick = () => window.toggleSportDay(day);
      sportContainer.appendChild(chip);
    });
  }
  
  if (seasonContainer) {
    seasonContainer.innerHTML = '';
    seasons.forEach(season => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = season;
      chip.id = 'season_display_' + season; 
      chip.onclick = () => window.toggleConfigSeason(season); 
      seasonContainer.appendChild(chip);
    });
  }
  
  const el = document.getElementById('currentGroupIdDisplay');
  if(el) el.textContent = groupId;
  
  updateConfigUIState();
}

function updateConfigUIState() {
  const sportList = menuConfig.sportDays || [];
  const seasonList = menuConfig.activeSeasons || [];
  
  // Mise à jour des classes 'selected'
  daysOfWeek.forEach(day => {
    document.getElementById('sport_display_' + day)?.classList.toggle('selected', sportList.includes(day));
  });
  seasons.forEach(season => {
    document.getElementById('season_display_' + season)?.classList.toggle('selected', seasonList.includes(season));
  });
  
  const md = menuConfig.mealDuration || { lunch: 1, dinner: 1 };
  ['lunch1Display', 'lunch2Display', 'dinner1Display', 'dinner2Display'].forEach(id => {
    document.getElementById(id)?.classList.remove('selected');
  });
  document.getElementById('lunch' + md.lunch + 'Display')?.classList.add('selected');
  document.getElementById('dinner' + md.dinner + 'Display')?.classList.add('selected');
}

function renderDishes() {
  const container = document.getElementById('dishesContainer');
  if (!container) return;
  container.innerHTML = '';

  let filtered = dishes.filter(d => {
    if (activeFilters.length === 0) return true;
    let m = true;
    if (activeFilters.includes('lunch') && d.mealType && !d.mealType.includes('lunch')) m = false;
    if (activeFilters.includes('dinner') && d.mealType && !d.mealType.includes('dinner')) m = false;
    if (activeFilters.includes('sport') && !d.sportDay) m = false;
    if (activeFilters.includes('vege') && !d.vegetarian) m = false;
    if (activeFilters.includes('summer') && !d.seasons.includes('Été')) m = false;
    if (activeFilters.includes('winter') && !d.seasons.includes('Hiver')) m = false;
    return m;
  });

  filtered.sort((a, b) => a.name.localeCompare(b.name));
  
  document.getElementById('dishCount').textContent = filtered.length;
  const list = document.getElementById('dishesList');
  const empty = document.getElementById('noDishes');
  
  if (filtered.length === 0) {
    list.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  list.classList.remove('hidden');

  filtered.forEach(dish => {
    const isLunch = !dish.mealType || dish.mealType.includes('lunch');
    const isDinner = !dish.mealType || dish.mealType.includes('dinner');
    let mealTags = '';
    if (isLunch && isDinner) mealTags = '<span class="tag tag-mixed">Midi & Soir</span>';
    else if (isLunch) mealTags = '<span class="tag tag-lunch">☀️ Midi</span>';
    else if (isDinner) mealTags = '<span class="tag tag-dinner">🌙 Soir</span>';

    const iconName = getDishIcon(dish.name);
    // Échappement des apostrophes pour le onclick
    const safeId = dish.id.replace(/'/g, "\\'");
    const safeObj = JSON.stringify(dish).replace(/"/g, "&quot;");

    const div = document.createElement('div');
    div.className = 'dish-card-wrapper';
    div.innerHTML = `
      <div class="dish-card-content">
        <div class="dish-icon-area"><span class="material-icons">${iconName}</span></div>
        <div class="dish-info">
          <h3>${dish.name}</h3>
          <div class="tags">
              ${mealTags}
              ${(dish.seasons||[]).map(s => `<span class="tag tag-season">${s}</span>`).join('')}
              ${dish.sportDay ? '<span class="tag tag-sport">Sport</span>' : ''}
              ${dish.vegetarian ? '<span class="tag tag-veg">Végé</span>' : ''}
              ${dish.grillades ? '<span class="tag tag-grill">Grill</span>' : ''}
          </div>
        </div>
        <div class="swipe-hint"><span class="material-icons">chevron_left</span></div>
      </div>
      <div class="dish-actions-swipe">
        <button class="action-btn edit" onclick="openEditDishModal('${safeId}')">
            <span class="material-icons">edit</span>
        </button>
        <button class="action-btn delete" onclick="deleteDish('${safeId}')">
            <span class="material-icons">delete</span>
        </button>
      </div>`;
    container.appendChild(div);
  });
}

function renderMenus() {
  const container = document.getElementById('menusList');
  if (!container) return;
  container.innerHTML = '';
  
  if (!menus.length) {
    document.getElementById('noMenus').classList.remove('hidden');
    return;
  }
  document.getElementById('noMenus').classList.add('hidden');

  menus.forEach(menu => {
    const div = document.createElement('div');
    div.className = 'card';
    let scheduleHTML = '';
    
    menu.schedule.forEach(day => {
      scheduleHTML += `
        <div class="day-card">
          <div class="day-header-new">
            <div class="day-name-large">${day.day}</div>
            ${day.isSportDay ? '<span class="sport-tag">🏋️ JOUR DE SPORT</span>' : ''}
          </div>
          <div class="meal-grid">
            <div class="meal-column meal-lunch">
              <div class="meal-label">Déjeuner</div>
              <div class="meal-name">${day.lunch ? day.lunch.name : '-'}</div>
            </div>
            <div class="meal-separator"></div>
            <div class="meal-column meal-dinner">
              <div class="meal-label">Dîner</div>
              <div class="meal-name">${day.dinner ? day.dinner.name : '-'}</div>
            </div>
          </div>
        </div>`;
    });

    div.innerHTML = `
      <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap: 12px;">
          <span class="material-icons">calendar_today</span>
          Semaine ${menu.weekNumber} (${menu.startDate} → ${menu.endDate})
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="icon-btn" onclick="window.regenerateMenu(${menu.id}, ${menu.weekNumber})">
            <span class="material-icons">refresh</span>
          </button>
          <button class="icon-btn" onclick="window.toggleMenuContent('content-${menu.id}')">
            <span id="icon-content-${menu.id}" class="material-icons">expand_less</span>
          </button>
        </div>
      </div>
      <div id="content-${menu.id}" class="menu-collapse open">${scheduleHTML}</div>`;
    container.appendChild(div);
  });
}

// ===== UTILS (Helpers) =====
function getDishIcon(name) {
  if (!name) return 'restaurant_menu';
  const n = name.toLowerCase();
  if (n.includes('burger')) return 'lunch_dining';
  if (n.includes('pizza')) return 'local_pizza';
  if (n.includes('salade')) return 'eco';
  return 'restaurant_menu'; 
}
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}
function getWeekDates(wn) {
  const y = new Date().getFullYear();
  const d = new Date(y, 0, 1 + (wn - 1) * 7);
  const day = d.getDay();
  const diff = d.getDate() - day + (day == 0 ? -6:1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(new Date(monday).setDate(monday.getDate() + 6));
  const fmt = (dt) => dt.getDate().toString().padStart(2,'0') + '/' + (dt.getMonth()+1).toString().padStart(2,'0');
  return { monday: fmt(monday), sunday: fmt(sunday) };
}
function getCurrentSeason() {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'Printemps';
  if (m >= 5 && m <= 7) return 'Été';
  if (m >= 8 && m <= 10) return 'Automne';
  return 'Hiver';
}
function getRecentlyUsedDishes() {
  const cw = getWeekNumber(new Date());
  const rm = menus.filter(m => m && m.weekNumber && cw - m.weekNumber <= 3 && cw - m.weekNumber >= 0);
  const used = new Set();
  rm.forEach(m => m.schedule.forEach(d => { if(d.lunch) used.add(d.lunch.id); if(d.dinner) used.add(d.dinner.id); }));
  return used;
}

// ===== FIREBASE LISTENER =====
function listenToGroupData() {
  if(!database || !groupId) return;
  
  database.ref(`groups/${groupId}/dishes`).on('value', s => {
    const d = s.val();
    dishes = d ? Object.values(d).map(v => ({...v, id: v.id || v.name})) : [];
    renderDishes();
  });
  
  database.ref(`groups/${groupId}/menus`).on('value', s => {
    const d = s.val();
    menus = d ? Object.values(d).sort((a,b) => b.weekNumber - a.weekNumber) : [];
    renderMenus();
  });
  
  database.ref(`groups/${groupId}/config`).on('value', s => {
    const d = s.val();
    const def = { sportDays: [], activeSeasons: seasons, mealDuration: { lunch: 1, dinner: 1 } };
    menuConfig = d ? { ...def, ...d } : def;
    updateConfigUIState();
  });
}

// ===== INITIALISATION =====
window.onload = function() {
  // Init Chips (Modal)
  const seasonContainer = document.getElementById('seasonsChips');
  if(seasonContainer) {
    seasonContainer.innerHTML = '';
    seasons.forEach(s => {
      const c = document.createElement('div');
      c.className = 'chip';
      c.textContent = s;
      c.onclick = () => window.toggleSeasonChip(s);
      seasonContainer.appendChild(c);
    });
  }
  
  // Init App
  if (groupId) {
    document.getElementById('groupSetup').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('tabBar').classList.remove('hidden');
    document.getElementById('currentGroupIdDisplay').textContent = groupId;
    window.switchToTab('dishes');
    listenToGroupData();
  } else {
    document.getElementById('groupTypeSelection').classList.remove('hidden');
  }
  
  // Install PWA
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
};

// Exports manquants (Menu Gen)
window.generateMenu = function() {
  const cw = getWeekNumber(new Date());
  const newMenu = { id: Date.now(), weekNumber: cw+1, startDate: getWeekDates(cw+1).monday, endDate: getWeekDates(cw+1).sunday, schedule: [] };
  // (Logique simplifiée pour test)
  for(let i=0; i<7; i++) newMenu.schedule.push({ day: daysOfWeek[i], lunch: null, dinner: null, isSportDay: false });
  if(database) database.ref(`groups/${groupId}/menus/${newMenu.id}`).set(newMenu);
};

// Exports navigation (Group)
window.showCreateGroup = function() {
  groupId = 'group_' + Date.now();
  localStorage.setItem('groupId', groupId);
  location.reload();
};
window.showJoinGroup = function() {
  document.getElementById('groupTypeSelection').classList.add('hidden');
  document.getElementById('joinGroupForm').classList.remove('hidden');
};
window.joinGroup = function() {
  const v = document.getElementById('groupIdInput').value;
  if(v) { groupId=v; localStorage.setItem('groupId', groupId); location.reload(); }
};
