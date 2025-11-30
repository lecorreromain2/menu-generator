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
  mealDuration: { lunch: 1, dinner: 1 },
  childMode: false,
  childName: 'Enfant'
};
let newDishSeasons = [];
let editingDishId = null;
let activeFilters = [];

const seasons = ['Printemps', 'Été', 'Automne', 'Hiver'];
const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// ==========================================
// 3. FONCTIONS UTILITAIRES (Helpers)
// ==========================================

window.getDishIcon = function(name) {
  if (!name || typeof name !== 'string') return 'restaurant_menu';
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
};

window.getWeekNumber = function(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
};

window.getWeekDates = function(wn) {
  const y = new Date().getFullYear();
  const d = new Date(y, 0, 1 + (wn - 1) * 7);
  const diff = d.getDate() - d.getDay() + (d.getDay() == 0 ? -6:1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(new Date(monday).setDate(monday.getDate() + 6));
  const fmt = (dt) => dt.getDate().toString().padStart(2,'0') + '/' + (dt.getMonth()+1).toString().padStart(2,'0');
  return { monday: fmt(monday), sunday: fmt(sunday) };
};

window.getCurrentSeason = function() {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'Printemps';
  if (m >= 5 && m <= 7) return 'Été';
  if (m >= 8 && m <= 10) return 'Automne';
  return 'Hiver';
};

window.getRecentlyUsedDishes = function() {
  const cw = window.getWeekNumber(new Date());
  const rm = menus.filter(m => m && m.weekNumber && cw - m.weekNumber <= 3 && cw - m.weekNumber >= 0);
  const used = new Set();
  rm.forEach(m => m.schedule.forEach(d => { 
    if(d.lunch) used.add(d.lunch.id); 
    if(d.lunchChild) used.add(d.lunchChild.id);
    if(d.dinner) used.add(d.dinner.id);
    if(d.dinnerChild) used.add(d.dinnerChild.id);
  }));
  return used;
};

// ==========================================
// 4. FONCTIONS UI & NAVIGATION
// ==========================================

window.showToast = function(msg) {
  const t = document.getElementById('customToast');
  const m = document.getElementById('toastMessage');
  if(t && m) { m.innerHTML = msg; t.classList.remove('hidden'); t.classList.add('show'); setTimeout(() => { t.classList.remove('show'); setTimeout(()=>t.classList.add('hidden'), 300); }, 3000); }
};

window.updateSyncIcon = function(sync) {
  const i = document.getElementById('syncIndicator');
  const ic = document.getElementById('syncIcon');
  if(!i || !ic) return;
  if(sync) { i.classList.remove('hidden', 'error'); ic.textContent = 'sync'; } 
  else { i.classList.remove('hidden', 'error'); ic.textContent = 'check_circle'; }
};

window.switchToTab = function(tabName) {
  document.querySelectorAll('.tab-content').forEach(t => { t.classList.remove('active'); t.classList.add('hidden'); });
  document.querySelectorAll('.tab-bar .tab-btn').forEach(b => b.classList.remove('active'));
  
  const el = document.getElementById(tabName + 'Tab');
  if(el) { el.classList.add('active'); el.classList.remove('hidden'); }
  
  const btn = document.querySelector(`.tab-bar .tab-btn[data-tab="${tabName}"]`);
  if(btn) btn.classList.add('active');
  
  if (tabName === 'dishes') window.renderDishes();
  if (tabName === 'menus') window.renderMenus();
  if (tabName === 'config') { window.generateConfigChips(); window.updateConfigUI(); }
  
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

// --- Modales Recettes ---
window.openAddDishModal = function() {
  editingDishId = null;
  document.getElementById('dishModalTitle').textContent = 'Nouveau plat';
  document.getElementById('saveDishBtn').textContent = 'Ajouter';
  document.getElementById('dishName').value = '';
  
  newDishSeasons = [];
  window.generateModalSeasonChips();
  
  document.getElementById('sportDay').checked = false;
  document.getElementById('vegetarian').checked = false;
  document.getElementById('grillades').checked = false;
  document.getElementById('mealLunch').checked = true;
  document.getElementById('mealDinner').checked = true;
  
  const targetSection = document.getElementById('targetSection');
  if (targetSection) {
    if (menuConfig.childMode) {
        targetSection.classList.remove('hidden');
        document.getElementById('targetChildLabel').textContent = menuConfig.childName || 'Enfant';
        document.getElementById('targetParents').checked = true;
        document.getElementById('targetChild').checked = true;
    } else {
        targetSection.classList.add('hidden');
    }
  }
  
  const fb = document.getElementById('dishNameFeedback'); if(fb) fb.textContent='';
  const sg = document.getElementById('dishSuggestions'); if(sg) sg.style.display='none';
  
  window.openModal('addDishModal');
};

window.openEditDishModal = function(dishId) {
  const dish = dishes.find(d => String(d.id) === String(dishId));
  if (!dish) return;

  editingDishId = dish.id;
  document.getElementById('dishModalTitle').textContent = 'Modifier le plat';
  document.getElementById('saveDishBtn').textContent = 'Modifier';
  document.getElementById('dishName').value = dish.name;
  
  newDishSeasons = [...(dish.seasons || [])]; 
  window.generateModalSeasonChips(); 
  
  document.getElementById('sportDay').checked = !!dish.sportDay;
  document.getElementById('vegetarian').checked = !!dish.vegetarian;
  document.getElementById('grillades').checked = !!dish.grillades;
  
  const isLunch = !dish.mealType || dish.mealType.includes('lunch');
  const isDinner = !dish.mealType || dish.mealType.includes('dinner');
  document.getElementById('mealLunch').checked = isLunch;
  document.getElementById('mealDinner').checked = isDinner;
  
  const targetSection = document.getElementById('targetSection');
  if (targetSection) {
    if (menuConfig.childMode) {
        targetSection.classList.remove('hidden');
        document.getElementById('targetChildLabel').textContent = menuConfig.childName || 'Enfant';
        const targets = dish.target || ['parents', 'child'];
        document.getElementById('targetParents').checked = targets.includes('parents');
        document.getElementById('targetChild').checked = targets.includes('child');
    } else {
        targetSection.classList.add('hidden');
    }
  }
  
  window.openModal('addDishModal');
};

// ==========================================
// 5. LOGIQUE MÉTIER (ACTIONS)
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

  let targets = ['parents', 'child'];
  if (menuConfig.childMode) {
    targets = [];
    if (document.getElementById('targetParents').checked) targets.push('parents');
    if (document.getElementById('targetChild').checked) targets.push('child');
    if (targets.length === 0) targets = ['parents', 'child'];
  }

  const dish = {
    id: editingDishId || Date.now(),
    name: name,
    seasons: newDishSeasons,
    mealType: mealTypes,
    target: targets,
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

// Sélection Intelligente
function pickDish(available, usedMap, excludeId = null, mealTypeFilter = null, targetFilter = null) {
  let candidates = available.filter(d => 
    (!excludeId || d.id !== excludeId) && 
    (!mealTypeFilter || !d.mealType || d.mealType.includes(mealTypeFilter)) &&
    (!usedMap.has(d.id) || usedMap.get(d.id) < 2)
  );

  if (targetFilter) {
    candidates = candidates.filter(d => {
      const targets = d.target || ['parents', 'child']; 
      return targets.includes(targetFilter);
    });
  }

  if (candidates.length === 0) return null;
  const dish = candidates[Math.floor(Math.random() * candidates.length)];
  usedMap.set(dish.id, (usedMap.get(dish.id) || 0) + 1);
  return dish;
}

window.generateMenu = function(targetWeekNumber = null) {
  const currentSeason = window.getCurrentSeason();
  const recentlyUsed = window.getRecentlyUsedDishes();
  const weekNumber = targetWeekNumber || (window.getWeekNumber(new Date()) + 1);
  const activeSeasonsList = menuConfig.activeSeasons || [];
  
  const availableDishes = dishes.filter(d => 
    !recentlyUsed.has(d.id) && 
    (d.seasons.length === 0 || 
     (d.seasons.includes(currentSeason) && activeSeasonsList.includes(currentSeason))
    )
  );

  if (availableDishes.length < 14) return window.showToast('❌ Pas assez de plats !');

  const schedule = [];
  const usedInMenu = new Map(); 

  for (let i = 0; i < 7; i++) {
    const day = daysOfWeek[i];
    
    // Lunch
    let lunch = null;
    let lunchChild = null;

    if (menuConfig.mealDuration.lunch > 1 && i > 0 && (i % menuConfig.mealDuration.lunch) !== 0 && schedule[i - 1].lunch) {
      lunch = schedule[i - 1].lunch;
    } else {
      lunch = pickDish(availableDishes, usedInMenu, null, 'lunch', 'parents');
    }

    if (menuConfig.childMode && lunch) {
      const targets = lunch.target || ['parents', 'child'];
      if (!targets.includes('child')) {
        if (menuConfig.mealDuration.lunch > 1 && i > 0 && (i % menuConfig.mealDuration.lunch) !== 0 && schedule[i - 1].lunchChild) {
          lunchChild = schedule[i - 1].lunchChild;
        } else {
          lunchChild = pickDish(availableDishes, usedInMenu, lunch.id, 'lunch', 'child');
        }
      }
    }

    // Dinner
    let dinner = null;
    let dinnerChild = null;

    if (menuConfig.mealDuration.dinner > 1 && i > 0 && (i % menuConfig.mealDuration.dinner) !== 0 && schedule[i - 1].dinner) {
      dinner = schedule[i - 1].dinner;
    } else {
      dinner = pickDish(availableDishes, usedInMenu, lunch?.id, 'dinner', 'parents');
    }

    if (menuConfig.childMode && dinner) {
      const targets = dinner.target || ['parents', 'child'];
      if (!targets.includes('child')) {
        if (menuConfig.mealDuration.dinner > 1 && i > 0 && (i % menuConfig.mealDuration.dinner) !== 0 && schedule[i - 1].dinnerChild) {
          dinnerChild = schedule[i - 1].dinnerChild;
        } else {
          dinnerChild = pickDish(availableDishes, usedInMenu, dinner.id, 'dinner', 'child');
        }
      }
    }

    schedule.push({ 
      day, lunch, lunchChild, dinner, dinnerChild, 
      isSportDay: (menuConfig.sportDays || []).includes(day) 
    });
  }

  const weekDates = window.getWeekDates(weekNumber);
  const newMenu = { id: Date.now(), weekNumber, startDate: weekDates.monday, endDate: weekDates.sunday, schedule };
  
  if(database) database.ref(`groups/${groupId}/menus/${newMenu.id}`).set(newMenu);
  window.showToast('✅ Menu généré !');
  window.switchToTab('menus');
};

window.regenerateMenu = function(menuId, weekNumber) {
  if (confirm('Régénérer ?')) {
    if (database) database.ref(`groups/${groupId}/menus/${menuId}`).remove();
    window.generateMenu(weekNumber);
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
  window.renderDishes();
};

window.toggleChildMode = function() {
  menuConfig.childMode = document.getElementById('childModeToggle').checked;
  const div = document.getElementById('childConfigContent');
  if(menuConfig.childMode) div.classList.remove('hidden'); else div.classList.add('hidden');
  if (database) database.ref(`groups/${groupId}/config`).set(menuConfig);
};

window.saveChildName = function() {
  menuConfig.childName = document.getElementById('childNameInput').value;
  if (database) database.ref(`groups/${groupId}/config`).set(menuConfig);
};

window.toggleConfigSeason = function(season) {
  let list = menuConfig.activeSeasons || [];
  if (list.includes(season)) list = list.filter(s => s !== season); else list.push(season);
  menuConfig.activeSeasons = list;
  if (database) database.ref(`groups/${groupId}/config`).set(menuConfig);
};

window.toggleSportDay = function(day) {
  let list = menuConfig.sportDays || [];
  if (list.includes(day)) list = list.filter(d => d !== day); else list.push(day);
  menuConfig.sportDays = list;
  if (database) database.ref(`groups/${groupId}/config`).set(menuConfig);
};

window.setMealDuration = function(meal, duration) {
  menuConfig.mealDuration = menuConfig.mealDuration || { lunch: 1, dinner: 1 };
  menuConfig.mealDuration[meal] = duration;
  if (database) database.ref(`groups/${groupId}/config`).set(menuConfig);
};

// ==========================================
// 6. GESTION GROUPE
// ==========================================

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
  document.getElementById('tabBar').classList.remove('hidden');
  document.getElementById('currentGroupIdDisplay').textContent = groupId;
  window.switchToTab('dishes');
};
window.copyGroupId = function() {
  if(navigator.clipboard) navigator.clipboard.writeText(groupId).then(() => window.showToast('📋 Copié !'));
  else prompt('ID :', groupId);
};
window.leaveGroup = function() {
  if(confirm('Quitter ?')) { localStorage.removeItem('groupId'); location.reload(); }
};

// ==========================================
// 7. AFFICHAGE (RENDERS)
// ==========================================

window.renderDishes = function() {
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
  
  if (filtered.length === 0) { list?.classList.add('hidden'); empty?.classList.remove('hidden'); return; }
  empty?.classList.add('hidden'); list?.classList.remove('hidden');

  filtered.forEach(dish => {
    // SECURITE BOUCLE : Try-Catch pour éviter qu'une seule recette plante tout
    try {
      const isLunch = !dish.mealType || dish.mealType.includes('lunch');
      const isDinner = !dish.mealType || dish.mealType.includes('dinner');
      let mealTags = '';
      if (isLunch && isDinner) mealTags = '<span class="tag tag-mixed">Midi & Soir</span>';
      else if (isLunch) mealTags = '<span class="tag tag-lunch">☀️ Midi</span>';
      else if (isDinner) mealTags = '<span class="tag tag-dinner">🌙 Soir</span>';
      
      let targetTag = '';
      const targets = dish.target || ['parents', 'child'];
      if (targets.length === 1) {
         if(targets.includes('child')) targetTag = `<span class="tag tag-target-child">👶 ${menuConfig.childName||'Enfant'}</span>`;
         else targetTag = '<span class="tag tag-target-parents">👫 Parents</span>';
      }

      const iconName = window.getDishIcon(dish.name);
      // SECURITE ID
      const safeId = String(dish.id).replace(/'/g, "\\'").replace(/"/g, "&quot;");

      const div = document.createElement('div');
      div.className = 'dish-card-wrapper';
      div.innerHTML = `
        <div class="dish-card-content">
          <div class="dish-icon-area"><span class="material-icons">${iconName}</span></div>
          <div class="dish-info">
            <h3>${dish.name}</h3>
            <div class="tags">
                ${targetTag}
                ${mealTags}
                ${(dish.seasons||[]).map(s => {
                    let c='tag-season';
                    if(s==='Printemps')c='tag-spring';
                    if(s==='Été')c='tag-summer';
                    if(s==='Automne')c='tag-autumn';
                    if(s==='Hiver')c='tag-winter';
                    return `<span class="tag ${c}">${s}</span>`
                }).join('')}
                ${dish.sportDay ? '<span class="tag tag-sport">Sport</span>' : ''}
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
    } catch (err) {
      console.error("Erreur affichage recette:", dish, err);
    }
  });
};

window.renderMenus = function() {
  const container = document.getElementById('menusList');
  if (!container) return;
  container.innerHTML = '';
  
  if (!menus.length) { document.getElementById('noMenus')?.classList.remove('hidden'); return; }
  document.getElementById('noMenus')?.classList.add('hidden');

  menus.forEach((menu, index) => {
    try {
      const div = document.createElement('div');
      div.className = 'card';
      let scheduleHTML = '';
      
      menu.schedule.forEach(day => {
        let lunchDisplay = `<div class="meal-name">${day.lunch ? day.lunch.name : '-'}</div>`;
        if (day.lunchChild) {
          lunchDisplay = `<div class="meal-split"><div class="meal-name">${day.lunch ? day.lunch.name : '-'}</div><div class="child-meal"><span class="material-icons">child_care</span> ${day.lunchChild.name}</div></div>`;
        }
        let dinnerDisplay = `<div class="meal-name">${day.dinner ? day.dinner.name : '-'}</div>`;
        if (day.dinnerChild) {
          dinnerDisplay = `<div class="meal-split"><div class="meal-name">${day.dinner ? day.dinner.name : '-'}</div><div class="child-meal"><span class="material-icons">child_care</span> ${day.dinnerChild.name}</div></div>`;
        }

        scheduleHTML += `
          <div class="day-card">
            <div class="day-header-new">
              <div class="day-name-large">${day.day}</div>
              ${day.isSportDay ? '<span class="sport-tag">🏋️ JOUR DE SPORT</span>' : ''}
            </div>
            <div class="meal-grid">
              <div class="meal-column meal-lunch">
                <div class="meal-label">Déjeuner</div>
                ${lunchDisplay}
              </div>
              <div class="meal-separator"></div>
              <div class="meal-column meal-dinner">
                <div class="meal-label">Dîner</div>
                ${dinnerDisplay}
              </div>
            </div>
          </div>`;
      });

      const isOpen = index === 0 ? 'open' : '';
      const iconName = index === 0 ? 'expand_less' : 'expand_more';

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
              <span id="icon-content-${menu.id}" class="material-icons">${iconName}</span>
            </button>
          </div>
        </div>
        <div id="content-${menu.id}" class="menu-collapse ${isOpen}">${scheduleHTML}</div>`;
      container.appendChild(div);
    } catch(e) { console.error(e); }
  });
};

window.generateConfigChips = function() {
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
};

window.generateModalSeasonChips = function() {
  const container = document.getElementById('seasonsChips');
  if (!container) return;
  container.innerHTML = '';
  seasons.forEach(season => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    if (newDishSeasons.includes(season)) chip.classList.add('selected');
    chip.textContent = season;
    chip.onclick = () => window.toggleSeasonChip(season);
    container.appendChild(chip);
  });
};

window.updateSeasonChipsUI = function() {
  document.querySelectorAll('#seasonsChips .chip').forEach(chip => {
    chip.classList.toggle('selected', newDishSeasons.includes(chip.textContent));
  });
};

window.updateConfigUI = function() {
  const md = menuConfig.mealDuration || { lunch: 1, dinner: 1 };
  ['lunch1Display', 'lunch2Display', 'dinner1Display', 'dinner2Display'].forEach(id => {
    document.getElementById(id)?.classList.remove('selected');
  });
  document.getElementById('lunch' + md.lunch + 'Display')?.classList.add('selected');
  document.getElementById('dinner' + md.dinner + 'Display')?.classList.add('selected');
  
  const childToggle = document.getElementById('childModeToggle');
  const childInput = document.getElementById('childNameInput');
  const childContent = document.getElementById('childConfigContent');
  
  if (childToggle) childToggle.checked = !!menuConfig.childMode;
  if (childInput) childInput.value = menuConfig.childName || 'Enfant';
  if (childContent) {
    if (menuConfig.childMode) childContent.classList.remove('hidden');
    else childContent.classList.add('hidden');
  }
};

// ==========================================
// 8. INITIALISATION & LISTENERS
// ==========================================

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
      window.renderDishes();
    });
    database.ref(`groups/${groupId}/menus`).on('value', s => {
      const d = s.val();
      if (!d) {
         menus = [];
      } else {
         const all = Object.entries(d).map(([k, v]) => ({...v, id: k}));
         const unique = {};
         all.forEach(m => { 
             if(m.weekNumber && (!unique[m.weekNumber] || String(m.id).localeCompare(String(unique[m.weekNumber].id)) > 0)) 
                unique[m.weekNumber] = m; 
         });
         menus = Object.values(unique).sort((a,b) => b.weekNumber - a.weekNumber);
      }
      window.renderMenus();
      updateWidgetData();
    });
    database.ref(`groups/${groupId}/config`).on('value', s => {
      const d = s.val();
      const def = { sportDays: [], activeSeasons: seasons, mealDuration: { lunch: 1, dinner: 1 }, childMode: false, childName: 'Enfant' };
      menuConfig = d ? { ...def, ...d } : def;
      if(!document.getElementById('configTab').classList.contains('hidden')) {
         window.generateConfigChips();
         window.updateConfigUI();
      }
    });
  }
}

function setupTooltip() {
  const syncIcon = document.getElementById('syncIcon');
  if (!syncIcon) return;
  syncIcon.addEventListener('touchstart', () => {
    setTimeout(() => window.showToast(`Groupe : ${groupId}`), 500);
  });
}

function setupPWA() { 
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js'); 
}

window.installApp = function() { 
  if(deferredPrompt) deferredPrompt.prompt(); 
};

window.onload = function() {
  console.log('App Started vFINAL-SAFE');
  setupPWA();
  
  const input = document.getElementById('dishName');
  if(input) {
    input.addEventListener('input', () => {
      const val = input.value.trim().toLowerCase();
      const sugg = document.getElementById('dishSuggestions');
      const fb = document.getElementById('dishNameFeedback');
      if(!val) { sugg.style.display='none'; fb.textContent=''; return; }
      
      const exists = dishes.some(d => d.name.toLowerCase() === val);
      fb.innerHTML = exists ? '⚠️ Existant' : '✅ Nouveau';
      fb.className = exists ? 'input-feedback duplicate' : 'input-feedback ok';

      const matches = dishes.filter(d => d.name.toLowerCase().includes(val) && d.name.toLowerCase() !== val).slice(0,5);
      if(matches.length) {
        sugg.innerHTML = `<div class="sugg-heading">Suggestions :</div>` + matches.map(d=>`<div class="sugg-item" onclick="document.getElementById('dishName').value='${d.name}'; this.parentNode.style.display='none'">${d.name}</div>`).join('');
        sugg.style.display = 'block';
      } else sugg.style.display = 'none';
    });
  }

  if (groupId) {
    window.showMainApp();
    initFirebaseAndListen();
  } else {
    window.showGroupTypeSelection();
  }
};
