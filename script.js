// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCviy5lWve4UUaSpZTz9hnSPu16e_mO_2U",
  authDomain: "menu-generator-7c7bf.firebaseapp.com",
  databaseURL: "https://menu-generator-7c7bf-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "menu-generator-7c7bf",
  storageBucket: "menu-generator-7c7bf.firebasestorage.app",
  messagingSenderId: "760559115603",
  appId: "1:760559115603:web:30955099b520f65c3495a6"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Variables globales
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

// ===== HELPER : Icône Automatique =====
function getDishIcon(name) {
  const n = name.toLowerCase();
  if (n.includes('burger') || n.includes('sandwich')) return 'lunch_dining';
  if (n.includes('pizza')) return 'local_pizza';
  if (n.includes('salade') || n.includes('legume')) return 'eco';
  if (n.includes('pate') || n.includes('spaghetti')) return 'dinner_dining';
  if (n.includes('soupe') || n.includes('veloute')) return 'soup_kitchen';
  if (n.includes('gateau') || n.includes('dessert')) return 'cake';
  if (n.includes('cafe')) return 'coffee';
  if (n.includes('riz') || n.includes('curry')) return 'rice_bowl';
  if (n.includes('poisson') || n.includes('saumon')) return 'set_meal';
  if (n.includes('oeuf') || n.includes('omelette')) return 'egg_alt';
  if (n.includes('gratin')) return 'local_fire_department';
  return 'restaurant_menu'; 
}

// ===== MENU =====

function generateMenu(targetWeekNumber = null) {
  const currentSeason = getCurrentSeason();
  const recentlyUsed = getRecentlyUsedDishes();
  const weekNumber = targetWeekNumber || (getWeekNumber(new Date()) + 1);
  
  const activeSeasonsList = menuConfig.activeSeasons || [];
  
  // Filtrer les plats disponibles
  const availableDishes = dishes.filter(d => 
    !recentlyUsed.has(d.id) && 
    (d.seasons.length === 0 || 
     (d.seasons.includes(currentSeason) && activeSeasonsList.includes(currentSeason))
    )
  );

  if (availableDishes.length < 14) {
    showToast('❌ Pas assez de plats disponibles !', 5000);
    return;
  }

  const schedule = [];
  const usedInMenu = new Map(); 

  for (let i = 0; i < 7; i++) {
    const day = daysOfWeek[i];
    
    // === DÉJEUNER ===
    let lunchDish = null;
    if (menuConfig.mealDuration.lunch > 1 && i > 0 && (i % menuConfig.mealDuration.lunch) !== 0 && schedule[i - 1].lunch) {
      lunchDish = schedule[i - 1].lunch;
    } else {
      const filtered = availableDishes.filter(d => 
        (!d.mealType || d.mealType.includes('lunch')) &&
        (!usedInMenu.has(d.id) || usedInMenu.get(d.id) < 2)
      );
      if (filtered.length > 0) {
        lunchDish = filtered[Math.floor(Math.random() * filtered.length)];
        usedInMenu.set(lunchDish.id, (usedInMenu.get(lunchDish.id) || 0) + 1);
      }
    }

    // === DÎNER ===
    let dinnerDish = null;
    if (menuConfig.mealDuration.dinner > 1 && i > 0 && (i % menuConfig.mealDuration.dinner) !== 0 && schedule[i - 1].dinner) {
      dinnerDish = schedule[i - 1].dinner;
    } else {
      const filtered = availableDishes.filter(d => 
        d.id !== lunchDish?.id && 
        (!d.mealType || d.mealType.includes('dinner')) &&
        (!usedInMenu.has(d.id) || usedInMenu.get(d.id) < 2)
      );
      if (filtered.length > 0) {
        dinnerDish = filtered[Math.floor(Math.random() * filtered.length)];
        usedInMenu.set(dinnerDish.id, (usedInMenu.get(dinnerDish.id) || 0) + 1);
      }
    }

    const isSportDay = (menuConfig.sportDays || []).includes(day);
    schedule.push({ day, lunch: lunchDish, dinner: dinnerDish, isSportDay });
  }

  const weekDates = getWeekDates(weekNumber);
  const newMenu = {
    id: Date.now(),
    weekNumber: weekNumber,
    startDate: weekDates.monday,
    endDate: weekDates.sunday,
    schedule
  };

  updateSyncIcon(true);
  database.ref(`groups/${groupId}/menus/${newMenu.id}`).set(newMenu);
  showToast('✅ Menu généré !');
  switchToTab('menus');
}

function regenerateMenu(menuId, weekNumber) {
  if (confirm('Voulez-vous régénérer ce menu ? L\'ancien sera remplacé.')) {
    database.ref(`groups/${groupId}/menus/${menuId}`).remove();
    generateMenu(weekNumber);
  }
}

function renderMenus(menusArray = menus) {
  const container = document.getElementById('menusList');
  const empty = document.getElementById('noMenus');
  if (!container) return;

  container.innerHTML = '';

  if (!menusArray.length) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  menusArray.forEach(menu => {
    const card = document.createElement('div');
    card.className = 'card';

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
        </div>
      `;
    });

    card.innerHTML = `
      <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap: 12px;">
          <span class="material-icons">calendar_today</span>
          Semaine ${menu.weekNumber} (${menu.startDate} → ${menu.endDate})
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="icon-btn" title="Régénérer" onclick="regenerateMenu(${menu.id}, ${menu.weekNumber})">
            <span class="material-icons">refresh</span>
          </button>
          <button class="icon-btn" title="Afficher/masquer" onclick="toggleMenuContent('content-${menu.id}')">
            <span id="icon-content-${menu.id}" class="material-icons">expand_less</span>
          </button>
        </div>
      </div>
      <div id="content-${menu.id}" class="menu-collapse open">
        ${scheduleHTML}
      </div>
    `;
    container.appendChild(card);
  });
}

// ===== CONFIGURATION =====

function toggleConfigSeason(season) {
  menuConfig.activeSeasons = menuConfig.activeSeasons || []; 
  if (menuConfig.activeSeasons.includes(season)) {
    menuConfig.activeSeasons = menuConfig.activeSeasons.filter(s => s !== season);
  } else {
    menuConfig.activeSeasons.push(season);
  }
  database.ref(`groups/${groupId}/config`).set(menuConfig);
}

function toggleSportDay(day) {
  menuConfig.sportDays = menuConfig.sportDays || []; 
  if (menuConfig.sportDays.includes(day)) {
    menuConfig.sportDays = menuConfig.sportDays.filter(d => d !== day);
  } else {
    menuConfig.sportDays.push(day);
  }
  database.ref(`groups/${groupId}/config`).set(menuConfig);
}

function setMealDuration(meal, duration) {
  menuConfig.mealDuration = menuConfig.mealDuration || { lunch: 1, dinner: 1 };
  menuConfig.mealDuration[meal] = duration;
  database.ref(`groups/${groupId}/config`).set(menuConfig);
}

function updateConfigUI() {
  const sportDaysList = menuConfig.sportDays || [];
  const activeSeasonsList = menuConfig.activeSeasons || [];

  daysOfWeek.forEach(day => {
    const chip = document.getElementById('sport_' + day);
    if (chip) chip.classList.toggle('selected', sportDaysList.includes(day));
    const chipDisplay = document.getElementById('sport_display_' + day);
    if (chipDisplay) chipDisplay.classList.toggle('selected', sportDaysList.includes(day));
  });
  
  seasons.forEach(season => {
    const chipDisplay = document.getElementById('season_display_' + season);
    if (chipDisplay) chipDisplay.classList.toggle('selected', activeSeasonsList.includes(season));
  });

  const mealDuration = menuConfig.mealDuration || { lunch: 1, dinner: 1 };
  ['lunch1', 'lunch2', 'dinner1', 'dinner2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('selected');
  });
  
  const l1d = document.getElementById('lunch' + mealDuration.lunch + 'Display');
  if (l1d) l1d.classList.add('selected');
  const d1d = document.getElementById('dinner' + mealDuration.dinner + 'Display');
  if (d1d) d1d.classList.add('selected');
}

// ===== PLATS & FILTRES =====

function toggleFilter(filter) {
  if (activeFilters.includes(filter)) {
    activeFilters = activeFilters.filter(f => f !== filter);
    document.getElementById('filter_' + filter).classList.remove('active');
  } else {
    activeFilters.push(filter);
    document.getElementById('filter_' + filter).classList.add('active');
  }
  renderDishes();
}

function renderDishes() {
  let filteredDishes = dishes.filter(d => {
    if (activeFilters.length === 0) return true;
    let match = true;
    if (activeFilters.includes('lunch') && d.mealType && !d.mealType.includes('lunch')) match = false;
    if (activeFilters.includes('dinner') && d.mealType && !d.mealType.includes('dinner')) match = false;
    if (activeFilters.includes('sport') && !d.sportDay) match = false;
    if (activeFilters.includes('vege') && !d.vegetarian) match = false;
    if (activeFilters.includes('summer') && !d.seasons.includes('Été')) match = false;
    if (activeFilters.includes('winter') && !d.seasons.includes('Hiver')) match = false;
    return match;
  });

  filteredDishes.sort((a, b) => a.name.localeCompare(b.name));

  const container = document.getElementById('dishesContainer');
  const listWrapper = document.getElementById('dishesList');
  const emptyState = document.getElementById('noDishes');
  const countSpan = document.getElementById('dishCount');

  if (!container) return;
  container.innerHTML = '';

  if (!filteredDishes.length) {
    if (listWrapper) listWrapper.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (listWrapper) listWrapper.classList.remove('hidden');
  if (countSpan) countSpan.textContent = filteredDishes.length.toString();

  filteredDishes.forEach(dish => {
    const isLunch = !dish.mealType || dish.mealType.includes('lunch');
    const isDinner = !dish.mealType || dish.mealType.includes('dinner');
    let mealTags = '';
    if (isLunch && isDinner) mealTags = '<span class="tag tag-meal">Midi/Soir</span>';
    else if (isLunch) mealTags = '<span class="tag tag-meal">Midi</span>';
    else if (isDinner) mealTags = '<span class="tag tag-meal">Soir</span>';

    const iconName = getDishIcon(dish.name);

    const cardWrapper = document.createElement('div');
    cardWrapper.className = 'dish-card-wrapper';
    
    cardWrapper.innerHTML = `
      <div class="dish-card-content">
        <div class="dish-icon-area">
           <span class="material-icons">${iconName}</span>
        </div>
        <div class="dish-info">
          <h3>${dish.name}</h3>
          <div class="tags">
              ${mealTags}
              ${dish.seasons.map(s => {
  let seasonClass = 'tag-season';
  if (s === 'Printemps') seasonClass = 'tag-spring';
  if (s === 'Été') seasonClass = 'tag-summer';
  if (s === 'Automne') seasonClass = 'tag-autumn';
  if (s === 'Hiver') seasonClass = 'tag-winter';
  return `<span class="tag ${seasonClass}">${s}</span>`;
}).join('')}
              ${dish.sportDay ? '<span class="tag tag-sport">Sport</span>' : ''}
              ${dish.vegetarian ? '<span class="tag tag-veg">Végé</span>' : ''}
              ${dish.grillades ? '<span class="tag tag-grill">Grill</span>' : ''}
          </div>
        </div>
        <div class="swipe-hint">
           <span class="material-icons">chevron_left</span>
        </div>
      </div>
      <div class="dish-actions-swipe">
        <button class="action-btn edit" onclick='openEditDishModal(${JSON.stringify(dish).replace(/"/g, "&quot;")})'>
            <span class="material-icons">edit</span>
        </button>
        <button class="action-btn delete" onclick='deleteDish("${dish.id}")'>
            <span class="material-icons">delete</span>
        </button>
      </div>
    `;
    container.appendChild(cardWrapper);
  });
}

// ===== MODALES & ACTIONS PLATS =====

function openAddDishModal() {
  editingDishId = null;
  document.getElementById('dishModalTitle').textContent = 'Nouveau plat';
  document.getElementById('saveDishBtn').textContent = 'Ajouter';
  document.getElementById('dishName').value = '';
  
  newDishSeasons = [];
  document.querySelectorAll('#seasonsChips .chip').forEach(chip => chip.classList.remove('selected'));
  
  document.getElementById('sportDay').checked = false;
  document.getElementById('vegetarian').checked = false;
  document.getElementById('grillades').checked = false;
  
  document.getElementById('mealLunch').checked = true;
  document.getElementById('mealDinner').checked = true;
  
  const dishNameFeedback = document.getElementById('dishNameFeedback');
  if (dishNameFeedback) {
    dishNameFeedback.textContent = '';
    dishNameFeedback.className = 'input-feedback';
  }
  const dishSuggestions = document.getElementById('dishSuggestions');
  if (dishSuggestions) {
    dishSuggestions.innerHTML = '';
    dishSuggestions.style.display = 'none';
  }
  
  openModal('addDishModal');
}

function openEditDishModal(dish) {
  editingDishId = dish.id;
  document.getElementById('dishModalTitle').textContent = 'Modifier le plat';
  document.getElementById('saveDishBtn').textContent = 'Modifier';
  document.getElementById('dishName').value = dish.name;
  
  newDishSeasons = [...dish.seasons];
  document.querySelectorAll('#seasonsChips .chip').forEach(chip => {
    chip.classList.toggle('selected', newDishSeasons.includes(chip.textContent));
  });
  
  document.getElementById('sportDay').checked = dish.sportDay || false;
  document.getElementById('vegetarian').checked = dish.vegetarian || false;
  document.getElementById('grillades').checked = dish.grillades || false;
  
  const isLunch = !dish.mealType || dish.mealType.includes('lunch');
  const isDinner = !dish.mealType || dish.mealType.includes('dinner');
  document.getElementById('mealLunch').checked = isLunch;
  document.getElementById('mealDinner').checked = isDinner;
  
  const dishNameFeedback = document.getElementById('dishNameFeedback');
  if (dishNameFeedback) dishNameFeedback.textContent = '';
  const dishSuggestions = document.getElementById('dishSuggestions');
  if (dishSuggestions) {
    dishSuggestions.innerHTML = '';
    dishSuggestions.style.display = 'none';
  }
  
  openModal('addDishModal');
}

function saveDish() {
  const name = document.getElementById('dishName').value.trim();
  if (!name) {
    showToast('❌ Veuillez entrer un nom de plat');
    return;
  }

  if (newDishSeasons.length === 0) {
    showToast('❌ Veuillez sélectionner au moins une saison');
    return;
  }

  const mealTypes = [];
  if (document.getElementById('mealLunch').checked) mealTypes.push('lunch');
  if (document.getElementById('mealDinner').checked) mealTypes.push('dinner');
  if (mealTypes.length === 0) mealTypes.push('lunch', 'dinner');

  const dish = {
    id: editingDishId || Date.now(),
    name: name,
    seasons: newDishSeasons,
    mealType: mealTypes,
    sportDay: document.getElementById('sportDay').checked,
    vegetarian: document.getElementById('vegetarian').checked,
    grillades: document.getElementById('grillades').checked
  };

  updateSyncIcon(true);
  database.ref(`groups/${groupId}/dishes/${dish.id}`).set(dish);
  
  const message = editingDishId ? '✅ Plat modifié !' : '✅ Plat ajouté !';
  showToast(message);
  
  editingDishId = null;
  newDishSeasons = [];
  closeModal('addDishModal');
}

function deleteDish(id) {
  if (confirm('Voulez-vous vraiment supprimer ce plat ?')) {
    updateSyncIcon(true);
    database.ref(`groups/${groupId}/dishes/${id}`).remove();
    showToast('✅ Plat supprimé');
  }
}

// ===== GROUPE & UTILITAIRES SYSTEME =====

function showGroupTypeSelection() {
  document.getElementById('groupTypeSelection').classList.remove('hidden');
  document.getElementById('joinGroupForm').classList.add('hidden');
}

function showCreateGroup() {
  document.getElementById('groupTypeSelection').classList.add('hidden');
  document.getElementById('joinGroupForm').classList.add('hidden');
  
  const newGroupId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  groupId = newGroupId;
  localStorage.setItem('groupId', groupId);
  
  showToast('✅ Groupe créé !');
  alert('ID du groupe :\n\n' + groupId + '\n\nPartagez cet ID avec vos amis !');
  
  showMainApp();
  listenToFirebase();
}

function showJoinGroup() {
  document.getElementById('groupTypeSelection').classList.add('hidden');
  document.getElementById('joinGroupForm').classList.remove('hidden');
}

function joinGroup() {
  const input = document.getElementById('groupIdInput').value.trim();
  if (!input) {
    showToast('❌ Veuillez entrer un ID de groupe');
    return;
  }
  groupId = input;
  localStorage.setItem('groupId', groupId);
  showMainApp();
  listenToFirebase();
  showToast('✅ Groupe rejoint !');
}

function showMainApp() {
  document.getElementById('groupSetup').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  document.getElementById('syncIndicator').classList.remove('hidden');
  document.getElementById('tabBar').classList.remove('hidden');
  
  const syncIcon = document.getElementById('syncIcon');
  if (syncIcon) syncIcon.title = `Groupe : ${groupId}`;
  
  const el = document.getElementById('currentGroupIdDisplay');
  if (el) el.textContent = groupId;
  
  switchToTab('dishes');
}

function leaveGroup() {
  if (confirm('⚠️ Voulez-vous vraiment quitter ce groupe ?')) {
    localStorage.removeItem('groupId');
    location.reload();
  }
}

function copyGroupId() {
  const id = (typeof groupId !== 'undefined' && groupId) ? groupId :
             (document.getElementById('currentGroupIdDisplay')?.textContent || '').trim();

  if (!id) {
    showToast('❌ Aucun ID de groupe disponible');
    return;
  }

  const flashCopyIcon = () => {
    const btn = document.querySelector('button[onclick="copyGroupId()"]') || document.getElementById('copyGroupBtn');
    if (!btn) return;
    const icon = btn.querySelector('.material-icons') || btn;
    const old = icon.textContent;
    icon.textContent = 'check';
    setTimeout(() => { icon.textContent = old; }, 1000);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(id).then(() => {
      showToast('📋 ID copié !');
      flashCopyIcon();
    }).catch((err) => {
      fallbackCopy(id, flashCopyIcon);
    });
    return;
  }
  fallbackCopy(id, flashCopyIcon);
}

function fallbackCopy(text, onSuccess) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) {
      showToast('📋 ID copié (fallback) !');
      if (typeof onSuccess === 'function') onSuccess();
    } else {
      prompt('Copiez manuellement l\'ID (Ctrl/Cmd+C puis Entrée) :', text);
    }
  } catch (e) {
    prompt('Copiez manuellement l\'ID (Ctrl/Cmd+C puis Entrée) :', text);
  }
}

function switchToTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
    tab.classList.add('hidden');
  });
  document.querySelectorAll('.tab-bar .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const tabEl = document.getElementById(`${tabName}Tab`);
  if (tabEl) {
    tabEl.classList.add('active');
    tabEl.classList.remove('hidden');
  }
  const activeBtn = document.querySelector(`.tab-bar .tab-btn[data-tab="${tabName}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  
  if (tabName === 'dishes') updateDishesTab();
  else if (tabName === 'menus') updateMenusTab();
  else if (tabName === 'config') updateConfigDisplay();
  
  document.getElementById('fabAdd')?.classList.toggle('hidden', tabName !== 'dishes');
  document.getElementById('fabMenu')?.classList.toggle('hidden', tabName !== 'menus');
}

function updateDishesTab() {
  const list = document.getElementById('dishesList');
  const empty = document.getElementById('noDishes');
  const hasItems = document.querySelectorAll('#dishesContainer .dish-card-wrapper').length > 0;
  if (hasItems) {
    if (list) list.classList.remove('hidden');
    if (empty) empty.classList.add('hidden');
  } else {
    if (list) list.classList.add('hidden');
    if (empty) empty.classList.remove('hidden');
  }
}

function updateMenusTab() {
  const empty = document.getElementById('noMenus');
  const hasItems = document.querySelectorAll('#menusList .card').length > 0;
  if (hasItems) {
    if (empty) empty.classList.add('hidden');
  } else {
    if (empty) empty.classList.remove('hidden');
  }
}

function updateConfigDisplay() {
  const sportDaysContainer = document.getElementById('sportDaysChipsDisplay');
  const sportDaysList = menuConfig.sportDays || [];
  
  if (sportDaysContainer && sportDaysContainer.children.length === 0) {
    daysOfWeek.forEach(day => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = day;
      chip.id = 'sport_display_' + day;
      chip.onclick = () => toggleSportDay(day);
      if (sportDaysList.includes(day)) chip.classList.add('selected');
      sportDaysContainer.appendChild(chip);
    });
  } else if (sportDaysContainer) {
    daysOfWeek.forEach(day => {
        const chipDisplay = document.getElementById('sport_display_' + day);
        if (chipDisplay) chipDisplay.classList.toggle('selected', sportDaysList.includes(day));
    });
  }

  const seasonDaysContainer = document.getElementById('seasonFilterChipsDisplay');
  const activeSeasonsList = menuConfig.activeSeasons || [];
  
  if (seasonDaysContainer && seasonDaysContainer.children.length === 0) {
    seasons.forEach(season => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = season;
      chip.id = 'season_display_' + season; 
      chip.onclick = () => toggleConfigSeason(season); 
      if (activeSeasonsList.includes(season)) chip.classList.add('selected');
      seasonDaysContainer.appendChild(chip);
    });
  } else if (seasonDaysContainer) {
    seasons.forEach(season => {
        const chipDisplay = document.getElementById('season_display_' + season);
        if (chipDisplay) chipDisplay.classList.toggle('selected', activeSeasonsList.includes(season));
    });
  }
  
  const groupIdDisplay = document.getElementById('currentGroupIdDisplay');
  if (groupIdDisplay) groupIdDisplay.textContent = groupId;
  updateConfigUI(); 
}

function listenToFirebase() {
  if (typeof firebase === 'undefined' || firebase.apps.length === 0) {
    setTimeout(listenToFirebase, 500);
    return;
  }
  if (!database || !groupId) return;

  database.ref().off();
  const dishesRef = database.ref(`groups/${groupId}/dishes`);
  const menusRef = database.ref(`groups/${groupId}/menus`);
  const configRef = database.ref(`groups/${groupId}/config`);

  dishesRef.on('value', snapshot => {
    const data = snapshot.val();
    if (!data) {
      dishes = [];
      renderDishes();
      updateSyncIcon(false);
      return;
    }
    const dishesArray = Object.entries(data)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => ({ ...value, id: key }));
    
    dishes = Object.values(dishesArray.reduce((acc, dish) => {
      if (!acc[dish.name] || acc[dish.name].id < dish.id) acc[dish.name] = dish;
      return acc;
    }, {}));
    
    renderDishes();
    updateSyncIcon(false);
  });

  menusRef.on('value', snapshot => {
    const data = snapshot.val();
    if (!data) {
      menus = [];
      renderMenus();
      return;
    }
    const menusArray = Object.entries(data)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => ({ ...value, id: key }));
    
    menus = Object.values(menusArray.reduce((acc, menu) => {
      if (!acc[menu.weekNumber] || acc[menu.weekNumber].id < menu.id) acc[menu.weekNumber] = menu;
      return acc;
    }, {})).sort((a, b) => b.weekNumber - a.weekNumber);
    
    renderMenus();
  });

  configRef.on('value', snapshot => {
    const data = snapshot.val();
    const defaults = { sportDays: [], activeSeasons: seasons, mealDuration: { lunch: 1, dinner: 1 } };
    if (data) {
      menuConfig = { ...defaults, ...data }; 
    } else {
      menuConfig = defaults;
    }
    updateConfigUI();
  });
}

function initSeasonChips() {
  const container = document.getElementById('seasonsChips');
  if (!container) return;
  seasons.forEach(season => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = season;
    chip.onclick = () => toggleSeasonChip(season, chip);
    container.appendChild(chip);
  });
}

function initSportDaysChips() {
  const container = document.getElementById('sportDaysChips');
  if (!container) return;
  daysOfWeek.forEach(day => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = day;
    chip.id = 'sport_' + day;
    chip.onclick = () => toggleSportDay(day);
    container.appendChild(chip);
  });
}

function showToast(message, duration = 3000) {
  const toast = document.getElementById('customToast');
  const toastMsg = document.getElementById('toastMessage');
  if (toast && toastMsg) {
    toastMsg.innerHTML = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, duration);
  }
}

function updateSyncIcon(syncing, error = false) {
  const indicator = document.getElementById('syncIndicator');
  const icon = document.getElementById('syncIcon');
  if (!indicator || !icon) return;
  if (syncing) {
    indicator.classList.remove('hidden', 'error');
    icon.textContent = 'sync';
  } else if (error) {
    indicator.classList.remove('hidden');
    indicator.classList.add('error');
    icon.textContent = 'error';
  } else {
    indicator.classList.remove('hidden', 'error');
    icon.textContent = 'check_circle';
  }
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getWeekDates(weekNumber) {
  const year = new Date().getFullYear();
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  const daysToMonday = (dayOfWeek === 0 ? 1 : 8 - dayOfWeek);
  const firstMonday = new Date(year, 0, 1 + daysToMonday);
  const monday = new Date(firstMonday);
  monday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const formatDate = (date) => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${d}/${m}`;
  };
  return { monday: formatDate(monday), sunday: formatDate(sunday) };
}

function getCurrentSeason() {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'Printemps';
  if (month >= 5 && month <= 7) return 'Été';
  if (month >= 8 && month <= 10) return 'Automne';
  return 'Hiver';
}

function getRecentlyUsedDishes() {
  const currentWeek = getWeekNumber(new Date());
  const recentMenus = menus.filter(m => 
    m && m.weekNumber !== undefined && 
    currentWeek - m.weekNumber <= 3 && 
    currentWeek - m.weekNumber >= 0
  );
  const usedDishIds = new Set();
  recentMenus.forEach(menu => {
    menu.schedule.forEach(day => {
      if (day.lunch) usedDishIds.add(day.lunch.id);
      if (day.dinner) usedDishIds.add(day.dinner.id);
    });
  });
  return usedDishIds;
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function toggleMenuContent(id) {
  const content = document.getElementById(id);
  const icon = document.getElementById('icon-' + id);
  const isOpen = content.classList.contains('open');
  if (isOpen) {
    content.classList.remove('open');
    icon.textContent = 'expand_more';
  } else {
    content.classList.add('open');
    icon.textContent = 'expand_less';
  }
}

// --- EVENTS LISTENERS ---
const dishNameInputEl = document.getElementById('dishName');
if (dishNameInputEl) {
  dishNameInputEl.addEventListener('input', () => {
    const value = dishNameInputEl.value.trim().toLowerCase();
    const dishNameFeedback = document.getElementById('dishNameFeedback');
    const dishSuggestions = document.getElementById('dishSuggestions');
    
    if (!value) {
      dishNameFeedback.textContent = '';
      dishNameFeedback.className = 'input-feedback';
      dishSuggestions.innerHTML = '';
      dishSuggestions.style.display = 'none';
      return;
    }

    const existsExact = dishes.some(d => d.name.toLowerCase() === value);
    if (existsExact) {
      dishNameFeedback.innerHTML = '<span class="material-icons" style="font-size:16px; vertical-align:text-bottom;">warning</span> Une recette avec ce nom existe déjà';
      dishNameFeedback.className = 'input-feedback duplicate';
    } else {
      dishNameFeedback.innerHTML = '<span class="material-icons" style="font-size:16px; vertical-align:text-bottom;">check_circle</span> Aucun doublon exact';
      dishNameFeedback.className = 'input-feedback ok';
    }

    const suggestions = dishes
      .filter(d => d.name.toLowerCase().includes(value) && d.name.toLowerCase() !== value)
      .slice(0, 5);

    if (suggestions.length === 0) {
      dishSuggestions.innerHTML = '';
      dishSuggestions.style.display = 'none';
    } else {
      dishSuggestions.style.display = 'block';
      dishSuggestions.innerHTML = `
        <div class="sugg-heading">Suggestions :</div>
        ${suggestions.map(d => `<div class="sugg-item">${d.name}</div>`).join('')}
      `;
    }

    document.querySelectorAll('.sugg-item').forEach(el => {
      el.addEventListener('click', () => {
        dishNameInputEl.value = el.textContent;
        dishNameInputEl.dispatchEvent(new Event('input'));
        dishSuggestions.innerHTML = '';
        dishSuggestions.style.display = 'none';
      });
    });
  });
}

// ===== EXPORTS =====
window.showGroupTypeSelection = showGroupTypeSelection;
window.showCreateGroup = showCreateGroup;
window.showJoinGroup = showJoinGroup;
window.joinGroup = joinGroup;
window.leaveGroup = leaveGroup;
window.switchToTab = switchToTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.openAddDishModal = openAddDishModal;
window.saveDish = saveDish;
window.generateMenu = generateMenu;
window.regenerateMenu = regenerateMenu;
window.toggleMenuContent = toggleMenuContent;
window.setMealDuration = setMealDuration;
window.installApp = installApp;
window.copyGroupId = copyGroupId;
window.openEditDishModal = openEditDishModal;
window.deleteDish = deleteDish;
window.toggleFilter = toggleFilter;

// ===== INITIALISATION (À LA FIN POUR ÊTRE SÛR) =====
window.onload = function() {
  console.log('🌐 Chargement...');
  
  initSeasonChips();
  initSportDaysChips();
  setupTooltip();
  
  if (groupId) {
    console.log('🔗 Groupe existant:', groupId);
    showMainApp();
    listenToFirebase();
  } else {
    console.log('🕓 Aucun groupe');
    showGroupTypeSelection();
  }

  setupPWA();
};
