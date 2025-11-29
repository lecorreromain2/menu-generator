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

// Initialisation sécurisée
try {
  firebase.initializeApp(firebaseConfig);
} catch (e) {
  console.error("Erreur initialisation Firebase:", e);
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
// 3. FONCTIONS GLOBALES (Navigation & UI)
// ==========================================

// --- Navigation Onglets ---
window.switchToTab = function(tabName) {
  document.querySelectorAll('.tab-content').forEach(t => { 
    t.classList.remove('active'); 
    t.classList.add('hidden'); 
  });
  document.querySelectorAll('.tab-bar .tab-btn').forEach(b => b.classList.remove('active'));
  
  const el = document.getElementById(tabName + 'Tab');
  if(el) { 
    el.classList.add('active'); 
    el.classList.remove('hidden'); 
  }
  
  const btn = document.querySelector(`.tab-bar .tab-btn[data-tab="${tabName}"]`);
  if(btn) btn.classList.add('active');
  
  // Actions spécifiques
  if (tabName === 'dishes') renderDishes();
  if (tabName === 'menus') renderMenus();
  if (tabName === 'config') {
    generateConfigChips(); 
    updateConfigUI();
  }
  
  document.getElementById('fabAdd')?.classList.toggle('hidden', tabName !== 'dishes');
  document.getElementById('fabMenu')?.classList.toggle('hidden', tabName !== 'menus');
};

// --- Modales ---
window.openModal = function(id) { document.getElementById(id)?.classList.add('active'); };
window.closeModal = function(id) { document.getElementById(id)?.classList.remove('active'); };

window.openAddDishModal = function() {
  editingDishId = null;
  document.getElementById('dishModalTitle').textContent = 'Nouveau plat';
  document.getElementById('saveDishBtn').textContent = 'Ajouter';
  document.getElementById('dishName').value = '';
  
  newDishSeasons = [];
  generateModalSeasonChips(); // Génération forcée
  
  document.getElementById('sportDay').checked = false;
  document.getElementById('vegetarian').checked = false;
  document.getElementById('grillades').checked = false;
  document.getElementById('mealLunch').checked = true;
  document.getElementById('mealDinner').checked = true;
  
  const fb = document.getElementById('dishNameFeedback'); if(fb) fb.textContent='';
  const sg = document.getElementById('dishSuggestions'); if(sg) sg.style.display='none';
  
  window.openModal('addDishModal');
};

window.openEditDishModal = function(dishId) {
  // Conversion en string pour comparaison sûre
  const dish = dishes.find(d => String(d.id) === String(dishId));
  if (!dish) return;

  editingDishId = dish.id;
  document.getElementById('dishModalTitle').textContent = 'Modifier le plat';
  document.getElementById('saveDishBtn').textContent = 'Modifier';
  document.getElementById('dishName').value = dish.name;
  
  newDishSeasons = [...(dish.seasons || [])]; 
  generateModalSeasonChips(); // Génération forcée
  
  document.getElementById('sportDay').checked = !!dish.sportDay;
  document.getElementById('vegetarian').checked = !!dish.vegetarian;
  document.getElementById('grillades').checked = !!dish.grillades;
  
  const isLunch = !dish.mealType || dish.mealType.includes('lunch');
  const isDinner = !dish.mealType || dish.mealType.includes('dinner');
  document.getElementById('mealLunch').checked = isLunch;
  document.getElementById('mealDinner').checked = isDinner;
  
  window.openModal('addDishModal');
};

// --- Gestion des Chips (Saisons) ---
function generateModalSeasonChips() {
  const container = document.getElementById('seasonsChips');
  if (!container) return;
  container.innerHTML = '';
  
  seasons.forEach(season => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    if (newDishSeasons.includes(season)) chip.classList.add('selected');
    chip.textContent = season;
    chip.onclick = () => {
      if (newDishSeasons.includes(season)) {
        newDishSeasons = newDishSeasons.filter(s => s !== season);
        chip.classList.remove('selected');
      } else {
        newDishSeasons.push(season);
        chip.classList.add('selected');
      }
    };
    container.appendChild(chip);
  });
}

function generateConfigChips() {
  const seasonContainer = document.getElementById('seasonFilterChipsDisplay');
  if (seasonContainer) {
    seasonContainer.innerHTML = '';
    const activeList = menuConfig.activeSeasons || [];
    seasons.forEach(season => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      if (activeList.includes(season)) chip.classList.add('selected');
      chip.textContent = season;
      chip.onclick = () => window.toggleConfigSeason(season);
      seasonContainer.appendChild(chip);
    });
  }

  const sportContainer = document.getElementById('sportDaysChipsDisplay');
  if (sportContainer) {
    sportContainer.innerHTML = '';
    const sportList = menuConfig.sportDays || [];
    daysOfWeek.forEach(day => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      if (sportList.includes(day)) chip.classList.add('selected');
      chip.textContent = day;
      chip.onclick = () => window.toggleSportDay(day);
      sportContainer.appendChild(chip);
    });
  }
}

// ==========================================
// 4. LOGIQUE MÉTIER & AFFICHAGE
// ==========================================

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
    list?.classList.add('hidden');
    empty?.classList.remove('hidden');
    return;
  }
  
  empty?.classList.add('hidden');
  list?.classList.remove('hidden');

  filtered.forEach(dish => {
    // Tags Repas
    const isLunch = !dish.mealType || dish.mealType.includes('lunch');
    const isDinner = !dish.mealType || dish.mealType.includes('dinner');
    let mealTags = '';
    if (isLunch && isDinner) mealTags = '<span class="tag tag-mixed">Midi & Soir</span>';
    else if (isLunch) mealTags = '<span class="tag tag-lunch">☀️ Midi</span>';
    else if (isDinner) mealTags = '<span class="tag tag-dinner">🌙 Soir</span>';

    // Tags Saisons
    const seasonsHtml = (dish.seasons || []).map(s => {
      let c='tag-season';
      if(s==='Printemps')c='tag-spring';
      if(s==='Été')c='tag-summer';
      if(s==='Automne')c='tag-autumn';
      if(s==='Hiver')c='tag-winter';
      return `<span class="tag ${c}">${s}</span>`;
    }).join('');

    const iconName = getDishIcon(dish.name);
    
    // CORRECTION CRITIQUE : Conversion en String avant replace pour éviter le crash sur les nombres
    const safeId = String(dish.id).replace(/'/g, "\\'");

    const div = document.createElement('div');
    div.className = 'dish-card-wrapper';
    div.innerHTML = `
      <div class="dish-card-content">
        <div class="dish-icon-area"><span class="material-icons">${iconName}</span></div>
        <div class="dish-info">
          <h3>${dish.name}</h3>
          <div class="tags">
              ${mealTags}
              ${seasonsHtml}
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
    document.getElementById('noMenus')?.classList.remove('hidden');
    return;
  }
  document.getElementById('noMenus')?.classList.add('hidden');

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

// --- Config Update ---
function updateConfigUI() {
  // Les chips sont regénérés par generateConfigChips() lors du switch d'onglet
  
  // Durées
  const md = menuConfig.mealDuration || { lunch: 1, dinner: 1 };
  ['lunch1Display', 'lunch2Display', 'dinner1Display', 'dinner2Display'].forEach(id => {
    document.getElementById(id)?.classList.remove('selected');
  });
  document.getElementById('lunch' + md.lunch + 'Display')?.classList.add('selected');
  document.getElementById('dinner' + md.dinner + 'Display')?.classList.add('selected');
  
  // ID Groupe
  const el = document.getElementById('currentGroupIdDisplay');
  if(el) el.textContent = groupId;
}

// ==========================================
// 5. ACTIONS GLOBALES (Window)
// ==========================================

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

window.generateMenu = function() {
  const currentWeek = getWeekNumber(new Date()) + 1;
  const activeSeasonsList = menuConfig.activeSeasons || [];
  const currentSeason = getCurrentSeason();
  const recentlyUsed = getRecentlyUsedDishes();

  const available = dishes.filter(d => 
    !recentlyUsed.has(d.id) && 
    (d.seasons.length === 0 || 
     (d.seasons.includes(currentSeason) && activeSeasonsList.includes(currentSeason))
    )
  );

  if (available.length < 14) return window.showToast('❌ Pas assez de plats !');

  const schedule = [];
  const used = new Map();

  for (let i = 0; i < 7; i++) {
    const day = daysOfWeek[i];
    
    // Lunch
    let lunch = null;
    if (menuConfig.mealDuration.lunch > 1 && i > 0 && (i % menuConfig.mealDuration.lunch) !== 0 && schedule[i - 1].lunch) {
      lunch = schedule[i - 1].lunch;
    } else {
      const opts = available.filter(d => (!d.mealType || d.mealType.includes('lunch')) && (!used.has(d.id) || used.get(d.id) < 2));
      if (opts.length) { lunch = opts[Math.floor(Math.random() * opts.length)]; if(lunch) used.set(lunch.id, (used.get(lunch.id)||0)+1); }
    }

    // Dinner
    let dinner = null;
    if (menuConfig.mealDuration.dinner > 1 && i > 0 && (i % menuConfig.mealDuration.dinner) !== 0 && schedule[i - 1].dinner) {
      dinner = schedule[i - 1].dinner;
    } else {
      const opts = available.filter(d => d.id !== lunch?.id && (!d.mealType || d.mealType.includes('dinner')) && (!used.has(d.id) || used.get(d.id) < 2));
      if (opts.length) { dinner = opts[Math.floor(Math.random() * opts.length)]; if(dinner) used.set(dinner.id, (used.get(dinner.id)||0)+1); }
    }

    schedule.push({ 
      day, lunch, dinner, 
      isSportDay: (menuConfig.sportDays || []).includes(day) 
    });
  }

  const weekDates = getWeekDates(currentWeek);
  const newMenu = { id: Date.now(), weekNumber: currentWeek, startDate: weekDates.monday, endDate: weekDates.sunday, schedule };
  
  if(database) database.ref(`groups/${groupId}/menus/${newMenu.id}`).set(newMenu);
  window.showToast('✅ Menu généré !');
  window.switchToTab('menus');
};

window.regenerateMenu = function(menuId, weekNumber) {
  if (confirm('Régénérer ?')) {
    if (database) database.ref(`groups/${groupId}/menus/${menuId}`).remove();
    window.generateMenu(weekNumber - 1);
  }
};

window.toggleMenuContent = function(id) {
  const content = document.getElementById(id);
  const icon = document.getElementById('icon-' + id);
  if (content && icon) {
    const isOpen = content.classList.contains('open');
    if (isOpen) { content.classList.remove('open'); icon.textContent = 'expand_more'; }
    else { content.classList.add('open'); icon.textContent = 'expand_less'; }
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

window.showToast = function(msg) {
  const t = document.getElementById('customToast');
  const m = document.getElementById('toastMessage');
  if(t && m) { m.innerHTML = msg; t.classList.remove('hidden'); t.classList.add('show'); setTimeout(() => { t.classList.remove('show'); setTimeout(()=>t.classList.add('hidden'), 300); }, 3000); }
};

// --- Firebase Sync ---
function initFirebaseAndListen() {
  if (typeof firebase === 'undefined' || !firebase.database) {
    setTimeout(initFirebaseAndListen, 200); 
    return;
  }
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  database = firebase.database();

  if (groupId) {
    database.ref().off();
    database.ref(`groups/${groupId}/dishes`).on('value', s => {
      const d = s.val();
      dishes = d ? Object.values(d).map(v => ({...v, id: v.id || v.name})) : [];
      renderDishes();
    });
    database.ref(`groups/${groupId}/menus`).on('value', s => {
      const d = s.val();
      menus = d ? Object.values(d).sort((a,b) => b.weekNumber - a.weekNumber) : [];
      renderMenus();
      updateWidgetData();
    });
    database.ref(`groups/${groupId}/config`).on('value', s => {
      const d = s.val();
      const def = { sportDays: [], activeSeasons: seasons, mealDuration: { lunch: 1, dinner: 1 } };
      menuConfig = d ? { ...def, ...d } : def;
      // Rafraichir l'UI seulement si on est sur l'onglet config (évite les bugs visuels)
      if(document.getElementById('configTab').classList.contains('active')) {
        updateConfigUI(); // Ceci déclenchera aussi generateConfigChips via switchToTab si besoin, mais on peut le laisser ici
      }
    });
  }
}

// Helpers
function getDishIcon(name) {
  if (!name) return 'restaurant_menu';
  const n = name.toLowerCase();
  if (n.includes('burger') || n.includes('sandwich') || n.includes('bagel')) return 'lunch_dining';
  if (n.includes('pizza')) return 'local_pizza';
  if (n.includes('salade') || n.includes('legume') || n.includes('tomate')) return 'eco';
  if (n.includes('pate') || n.includes('spaghetti') || n.includes('lasagne')) return 'dinner_dining';
  if (n.includes('soupe') || n.includes('veloute')) return 'soup_kitchen';
  if (n.includes('gateau') || n.includes('dessert') || n.includes('tarte')) return 'cake';
  if (n.includes('cafe')) return 'coffee';
  if (n.includes('riz') || n.includes('curry') || n.includes('paella')) return 'rice_bowl';
  if (n.includes('poisson') || n.includes('saumon') || n.includes('crevette')) return 'set_meal';
  if (n.includes('oeuf') || n.includes('omelette')) return 'egg_alt';
  if (n.includes('gratin') || n.includes('quiche')) return 'local_fire_department';
  if (n.includes('poulet') || n.includes('viande') || n.includes('steak')) return 'restaurant';
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

// Navigation Groupe
window.showGroupTypeSelection = function() {
  document.getElementById('groupTypeSelection').classList.remove('hidden');
  document.getElementById('joinGroupForm').classList.add('hidden');
};
window.showCreateGroup = function() {
  const newGroupId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  groupId = newGroupId;
  localStorage.setItem('groupId', groupId);
  window.showMainApp();
  initFirebaseAndListen();
};
window.showJoinGroup = function() {
  document.getElementById('groupTypeSelection').classList.add('hidden');
  document.getElementById('joinGroupForm').classList.remove('hidden');
};
window.joinGroup = function() {
  const v = document.getElementById('groupIdInput').value.trim();
  if(v) { groupId=v; localStorage.setItem('groupId', groupId); window.showMainApp(); initFirebaseAndListen(); }
  else window.showToast('❌ ID requis');
};
window.showMainApp = function() {
  document.getElementById('groupSetup').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  document.getElementById('syncIndicator').classList.remove('hidden');
  document.getElementById('tabBar').classList.remove('hidden');
  const el = document.getElementById('currentGroupIdDisplay');
  if(el) el.textContent = groupId;
  window.switchToTab('dishes');
};
window.leaveGroup = function() {
  if(confirm('Quitter ?')) { localStorage.removeItem('groupId'); location.reload(); }
};
window.copyGroupId = function() {
  if(navigator.clipboard) navigator.clipboard.writeText(groupId).then(() => window.showToast('📋 Copié !'));
  else prompt('ID :', groupId);
};

// PWA
function setupPWA() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js'); }
window.installApp = function() { if(deferredPrompt) deferredPrompt.prompt(); };

// Initialisation
window.onload = function() {
  console.log('App Started');
  
  // Input Listener
  const input = document.getElementById('dishName');
  if(input) {
    input.addEventListener('input', () => {
      const val = input.value.toLowerCase();
      const sugg = document.getElementById('dishSuggestions');
      const fb = document.getElementById('dishNameFeedback');
      
      if(!val) { 
        sugg.style.display='none'; 
        fb.textContent=''; fb.className='input-feedback';
        return; 
      }
      
      const exists = dishes.some(d => d.name.toLowerCase() === val);
      fb.innerHTML = exists ? 
        '<span class="material-icons" style="font-size:16px; vertical-align:text-bottom;">warning</span> Déjà existant' : 
        '<span class="material-icons" style="font-size:16px; vertical-align:text-bottom;">check_circle</span> Nouveau';
      fb.className = exists ? 'input-feedback duplicate' : 'input-feedback ok';

      const matches = dishes.filter(d => d.name.toLowerCase().includes(val) && d.name.toLowerCase() !== val).slice(0,5);
      if(matches.length) {
        sugg.innerHTML = `<div class="sugg-heading">Suggestions :</div>` + matches.map(d=>`<div class="sugg-item" onclick="document.getElementById('dishName').value='${d.name}'; this.parentNode.style.display='none'">${d.name}</div>`).join('');
        sugg.style.display = 'block';
      } else sugg.style.display = 'none';
    });
  }

  setupPWA();
  
  if (groupId) {
    window.showMainApp();
    initFirebaseAndListen();
  } else {
    window.showGroupTypeSelection();
  }
};
