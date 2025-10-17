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
let menuConfig = { sportDays: [], mealDuration: { lunch: 1, dinner: 1 } };
let newDishSeasons = [];
let editingDishId = null;

const seasons = ['Printemps', 'Été', 'Automne', 'Hiver'];
const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// ===== NOTIFICATIONS =====

function showToast(message, duration = 3000) {
  const toast = document.getElementById('customToast');
  const toastMsg = document.getElementById('toastMessage');
  if (toast && toastMsg) {
    toastMsg.textContent = message;
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

// ===== GROUPE =====

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
  
  const syncIcon = document.getElementById('syncIcon');
  if (syncIcon) {
    syncIcon.title = `Groupe : ${groupId}`;
  }
  
  document.getElementById('currentGroupId').textContent = groupId;
  
  // Afficher l'onglet recettes par défaut
  switchTab('recipes');
}

function leaveGroup() {
  if (confirm('⚠️ Voulez-vous vraiment quitter ce groupe ?')) {
    localStorage.removeItem('groupId');
    location.reload();
  }
}

// ===== ONGLETS =====

function switchTab(tabName) {
  console.log('📂 Changement d\'onglet:', tabName);
  
  // Masquer tous les onglets
  document.querySelectorAll('.main-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  
  // Afficher l'onglet sélectionné
  const tabMap = {
    'recipes': 'recipesTab',
    'menus': 'menusTab',
    'settings': 'settingsTab'
  };
  
  const tabEl = document.getElementById(tabMap[tabName]);
  if (tabEl) {
    tabEl.classList.add('active');
  }
  
  // Activer le bouton de navigation
  const navBtn = document.querySelector(`[data-tab="${tabName}"]`);
  if (navBtn) {
    navBtn.classList.add('active');
  }
  
  // Mettre à jour l'affichage selon l'onglet
  if (tabName === 'recipes') {
    updateDishesTab();
  } else if (tabName === 'menus') {
    updateMenusTab();
  }
}

function updateDishesTab() {
  const list = document.getElementById('dishesList');
  const empty = document.getElementById('noDishes');
  const hasItems = document.querySelectorAll('#dishesContainer .dish-item').length > 0;

  if (hasItems) {
    if (list) list.classList.remove('hidden');
    if (empty) empty.style.display = 'none';
  } else {
    if (list) list.classList.add('hidden');
    if (empty) empty.style.display = 'flex';
  }
}

function updateMenusTab() {
  const empty = document.getElementById('noMenus');
  const hasItems = document.querySelectorAll('#menusList .card').length > 0;

  if (hasItems) {
    if (empty) empty.style.display = 'none';
  } else {
    if (empty) empty.style.display = 'flex';
  }
}
 
// ===== FIREBASE =====

function listenToFirebase() {
  if (typeof firebase === 'undefined' || firebase.apps.length === 0) {
    console.warn('⏳ Firebase non initialisé');
    setTimeout(listenToFirebase, 500);
    return;
  }

  if (!database) {
    console.warn('❌ Base non initialisée');
    return;
  }
  
  if (!groupId) {
    console.warn('⛔ Aucun groupId');
    showToast('❌ Aucun groupe sélectionné');
    return;
  }

  console.log('🎧 Écoute Firebase:', groupId);

  database.ref().off();

  const dishesRef = database.ref(`groups/${groupId}/dishes`);
  const menusRef = database.ref(`groups/${groupId}/menus`);
  const configRef = database.ref(`groups/${groupId}/config`);

  dishesRef.on('value', snapshot => {
    const data = snapshot.val();
    console.log('📡 Plats Firebase:', data);
    
    if (!data) {
      console.warn('⚠️ Aucun plat');
      dishes = [];
      renderDishes();
      updateSyncIcon(false);
      return;
    }

    const dishesArray = Object.entries(data).map(([key, value]) => ({
      ...value,
      id: key
    }));

    dishes = Object.values(
      dishesArray.reduce((acc, dish) => {
        if (!acc[dish.name] || acc[dish.name].id < dish.id) {
          acc[dish.name] = dish;
        }
        return acc;
      }, {})
    );

    console.log('✅ Plats:', dishes.length);
    renderDishes();
    updateSyncIcon(false);
  }, error => {
    console.error('❌ Erreur dishes:', error);
    updateSyncIcon(false, true);
  });

  menusRef.on('value', snapshot => {
    const data = snapshot.val();
    console.log('📡 Menus Firebase:', data);
    
    if (!data) {
      menus = [];
      renderMenus();
      return;
    }

    const menusArray = Object.entries(data).map(([key, value]) => ({
      ...value,
      id: key
    }));

    menus = Object.values(
      menusArray.reduce((acc, menu) => {
        if (!acc[menu.weekNumber] || acc[menu.weekNumber].id < menu.id) {
          acc[menu.weekNumber] = menu;
        }
        return acc;
      }, {})
    ).sort((a, b) => b.weekNumber - a.weekNumber);

    console.log('✅ Menus:', menus.length);
    renderMenus();
  }, error => {
    console.error('❌ Erreur menus:', error);
  });

  configRef.on('value', snapshot => {
    const data = snapshot.val();
    if (data) {
      menuConfig = data;
      updateConfigUI();
      console.log('✅ Config:', menuConfig);
    }
  }, error => {
    console.error('❌ Erreur config:', error);
  });
}

// ===== PLATS =====

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

function toggleSeasonChip(season, chip) {
  if (newDishSeasons.includes(season)) {
    newDishSeasons = newDishSeasons.filter(s => s !== season);
    chip.classList.remove('selected');
  } else {
    newDishSeasons.push(season);
    chip.classList.add('selected');
  }
}

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
  openModal('addDishModal');
}

function saveDish() {
  const name = document.getElementById('dishName').value.trim();
  if (!name) {
    showToast('❌ Veuillez entrer un nom de plat');
    return;
  }

  // ✅ Vérifier qu'au moins une saison est sélectionnée
  if (newDishSeasons.length === 0) {
    showToast('❌ Veuillez sélectionner au moins une saison');
    return;
  }

  const dish = {
    id: editingDishId || Date.now(),
    name: name,
    seasons: newDishSeasons,
    sportDay: document.getElementById('sportDay').checked,
    vegetarian: document.getElementById('vegetarian').checked,
    grillades: document.getElementById('grillades').checked
  };

  updateSyncIcon(true);
  database.ref(`groups/${groupId}/dishes/${dish.id}`).set(dish);
  
  const message = editingDishId ? '✅ Plat modifié !' : '✅ Plat ajouté !';
  showToast(message);
  
  // ✅ Réinitialiser le formulaire
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

function renderDishes(dishes = []) {
  const container = document.getElementById('dishesContainer');
  if (!container) {
    console.error('❌ Impossible de trouver #dishesContainer');
    return;
  }

  container.innerHTML = '';

  if (!dishes.length) {
    container.innerHTML = "<p class='empty'>Aucune recette disponible pour ce groupe.</p>";
    return;
  }

  dishes.forEach(dish => {
    const card = document.createElement('div');
    card.className = 'dish-card';
    card.innerHTML = `
      <div class="dish-info">
        <h3>${dish.name || 'Sans nom'}</h3>
        <p>${dish.sportDay ? '🏋️ Jour de sport' : '🍽️ Standard'}</p>
        ${dish.vegetarian ? '<p>🥦 Végétarien</p>' : ''}
        ${dish.grillades ? '<p>🔥 Grillades</p>' : ''}
      </div>
      <div class="dish-actions">
        <button class="btn btn-text" onclick="openEditDishModal(${JSON.stringify(dish).replace(/"/g, '&quot;')})">Modifier</button>
      </div>
    `;
    container.appendChild(card);
  });

  console.log(`🎨 ${dishes.length} recettes affichées`);
}


// ===== MENU =====

function generateMenu(targetWeekNumber = null) {
  const currentSeason = getCurrentSeason();
  const recentlyUsed = getRecentlyUsedDishes();
  
  // Si pas de numéro de semaine spécifié, générer pour la semaine prochaine
  const weekNumber = targetWeekNumber || (getWeekNumber(new Date()) + 1);
  
  // Filtrer les plats disponibles
  const availableDishes = dishes.filter(d => 
    !recentlyUsed.has(d.id) && 
    (d.seasons.length === 0 || d.seasons.includes(currentSeason))
  );

  if (availableDishes.length < 14) {
    showToast('❌ Pas assez de plats disponibles !', 5000);
    return;
  }

  const schedule = [];
  const usedInMenu = new Map(); // Compte combien de fois chaque plat est utilisé

  for (let i = 0; i < 7; i++) {
    const day = daysOfWeek[i];
    const isSportDay = menuConfig.sportDays.includes(day);
    
    // === DÉJEUNER ===
    let lunchDish = null;
    if (menuConfig.mealDuration.lunch === 2 && i > 0 && schedule[i - 1].lunch) {
      // Répéter le plat du jour précédent
      lunchDish = schedule[i - 1].lunch;
    } else {
      // Choisir un nouveau plat (max 2 fois dans le menu)
      const filtered = availableDishes.filter(d => 
        !usedInMenu.has(d.id) || usedInMenu.get(d.id) < 2
      );
      if (filtered.length > 0) {
        lunchDish = filtered[Math.floor(Math.random() * filtered.length)];
        usedInMenu.set(lunchDish.id, (usedInMenu.get(lunchDish.id) || 0) + 1);
      }
    }

    // === DÎNER ===
    let dinnerDish = null;
    if (menuConfig.mealDuration.dinner === 2 && i > 0 && schedule[i - 1].dinner) {
      // Répéter le plat du jour précédent
      dinnerDish = schedule[i - 1].dinner;
    } else {
      // Choisir un nouveau plat différent du déjeuner (max 2 fois dans le menu)
      const filtered = availableDishes.filter(d => 
        d.id !== lunchDish?.id && // Différent du déjeuner du même jour
        (!usedInMenu.has(d.id) || usedInMenu.get(d.id) < 2)
      );
      if (filtered.length > 0) {
        dinnerDish = filtered[Math.floor(Math.random() * filtered.length)];
        usedInMenu.set(dinnerDish.id, (usedInMenu.get(dinnerDish.id) || 0) + 1);
      }
    }

    schedule.push({ day, lunch: lunchDish, dinner: dinnerDish, isSportDay });
  }

  // Calculer les dates du lundi et dimanche de la semaine
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
  
  // Passer à l'onglet menus
  document.getElementById('dishesTab').classList.remove('active');
  document.getElementById('menusTab').classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-btn')[1].classList.add('active');
  updateMenusTab();
}

function regenerateMenu(menuId, weekNumber) {
  if (confirm('Voulez-vous régénérer ce menu ? L\'ancien sera remplacé.')) {
    // Supprimer l'ancien menu
    database.ref(`groups/${groupId}/menus/${menuId}`).remove();
    // Générer un nouveau menu pour la même semaine
    generateMenu(weekNumber);
  }
}

function renderMenus() {
  const container = document.getElementById('menusList');
  
  if (!container) {
    console.warn('⏳ Conteneur menus introuvable');
    return;
  }

  if (!menus || menus.length === 0) {
    container.innerHTML = '';
    updateMenusTab();
    return;
  }

  container.innerHTML = '';

  menus.forEach(menu => {
    const menuCard = document.createElement('div');
    menuCard.className = 'card';
    
    let scheduleHTML = '';
    if (Array.isArray(menu.schedule)) {
      menu.schedule.forEach(day => {
        scheduleHTML += `
          <div class="day-card">
            <div class="day-header">
              <span class="day-name">${day.day}</span>
              ${day.isSportDay ? '<span class="sport-badge">💪 Sport</span>' : ''}
            </div>
            <div class="meal">
              <div class="meal-label">Déjeuner</div>
              <div class="meal-name">${day.lunch?.name || 'Non défini'}</div>
            </div>
            <div class="meal">
              <div class="meal-label">Dîner</div>
              <div class="meal-name">${day.dinner?.name || 'Non défini'}</div>
            </div>
          </div>
        `;
      });
    }
    
    const dateRange = menu.startDate && menu.endDate 
      ? `Du ${menu.startDate} au ${menu.endDate}`
      : menu.date || '';
    
    menuCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div class="card-title" style="margin-bottom: 0;">
          <span class="material-icons">calendar_today</span>
          <div>
            <div>Semaine ${menu.weekNumber}</div>
            <div style="font-size: 12px; font-weight: 400; color: var(--md-on-surface-variant);">${dateRange}</div>
          </div>
        </div>
        <button class="icon-btn" onclick="regenerateMenu(${menu.id}, ${menu.weekNumber})" title="Régénérer ce menu">
          <span class="material-icons">refresh</span>
        </button>
      </div>
      ${scheduleHTML}
    `;
    
    container.appendChild(menuCard);
  });

  updateMenusTab();
}

// ===== CONFIGURATION =====

function toggleSportDay(day) {
  if (menuConfig.sportDays.includes(day)) {
    menuConfig.sportDays = menuConfig.sportDays.filter(d => d !== day);
  } else {
    menuConfig.sportDays.push(day);
  }
  database.ref(`groups/${groupId}/config`).set(menuConfig);
}

function setMealDuration(meal, duration) {
  menuConfig.mealDuration[meal] = duration;
  database.ref(`groups/${groupId}/config`).set(menuConfig);
}

function updateConfigUI() {
  daysOfWeek.forEach(day => {
    const chip = document.getElementById('sport_' + day);
    if (chip) {
      chip.classList.toggle('selected', menuConfig.sportDays.includes(day));
    }
  });

  ['lunch1', 'lunch2', 'dinner1', 'dinner2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('selected');
  });
  
  const lunch = document.getElementById('lunch' + menuConfig.mealDuration.lunch);
  const dinner = document.getElementById('dinner' + menuConfig.mealDuration.dinner);
  if (lunch) lunch.classList.add('selected');
  if (dinner) dinner.classList.add('selected');
}

// ===== UTILITAIRES =====

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getWeekDates(weekNumber) {
  const year = new Date().getFullYear();
  
  // Trouver le premier lundi de l'année
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  const daysToMonday = (dayOfWeek === 0 ? 1 : 8 - dayOfWeek);
  const firstMonday = new Date(year, 0, 1 + daysToMonday);
  
  // Calculer le lundi de la semaine demandée
  const monday = new Date(firstMonday);
  monday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  
  // Calculer le dimanche
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const formatDate = (date) => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${d}/${m}`;
  };
  
  return {
    monday: formatDate(monday),
    sunday: formatDate(sunday)
  };
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
  const recentMenus = menus.filter(m => currentWeek - m.weekNumber <= 3 && currentWeek - m.weekNumber >= 0);
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

// ===== PWA =====

let deferredPrompt;

function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => {
      console.log('✅ Service Worker enregistré');
    }).catch(err => {
      console.error('❌ Erreur SW:', err);
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const prompt = document.getElementById('installPrompt');
    if (prompt) prompt.classList.remove('hidden');
  });

  if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('✅ App installée');
  }
}

function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('✅ Installation acceptée');
        const prompt = document.getElementById('installPrompt');
        if (prompt) prompt.classList.add('hidden');
      }
      deferredPrompt = null;
    });
  }
}

// ===== TOOLTIP =====

function setupTooltip() {
  const syncIcon = document.getElementById('syncIcon');
  const tooltip = document.getElementById('tooltip');
  
  if (!syncIcon || !tooltip) return;

  function showTooltip(text, event) {
    tooltip.textContent = text;
    tooltip.style.left = event.pageX + 'px';
    tooltip.style.top = event.pageY + 'px';
    tooltip.classList.add('show');
  }

  function hideTooltip() {
    tooltip.classList.remove('show');
  }

  syncIcon.addEventListener('mouseenter', (e) => showTooltip(`Groupe : ${groupId}`, e));
  syncIcon.addEventListener('mouseleave', hideTooltip);

  let touchTimer;
  syncIcon.addEventListener('touchstart', (e) => {
    touchTimer = setTimeout(() => showTooltip(`Groupe : ${groupId}`, e.touches[0]), 500);
  });
  syncIcon.addEventListener('touchend', () => {
    clearTimeout(touchTimer);
    hideTooltip();
  });
}

function toggleMenuContent(id) {
  const content = document.getElementById(id);
  const icon = document.getElementById('icon-' + id);
  if (!content || !icon) return;

  const isVisible = content.style.display === 'block';
  content.style.display = isVisible ? 'none' : 'block';
  icon.textContent = isVisible ? 'expand_more' : 'expand_less';
}


// ===== INITIALISATION =====

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
  }

  setupPWA();
};

function showTab(tabName) {
  console.log('🔁 Affichage onglet :', tabName);

  // Masquer tous les contenus
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.style.display = 'none';
  });

  // Retirer la classe active sur tous les boutons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Afficher le bon contenu
  const activeTab = document.getElementById(tabName);
  if (activeTab) activeTab.style.display = 'block';

  // Activer le bon bouton
  const activeBtn = document.querySelector(`[onclick="showTab('${tabName}')"]`);
  if (activeBtn) activeBtn.classList.add('active');
}


window.onload = () => {
  console.log('✅ Initialisation interface');

  // Afficher la tab bar
  const tabBar = document.getElementById('tabBar');
  if (tabBar) tabBar.style.display = 'flex';

  // Montrer l'onglet "Recettes" par défaut
  showTab('dishes');
};


// Exposer les fonctions globalement pour les onclick HTML
window.showGroupTypeSelection = showGroupTypeSelection;
window.showCreateGroup = showCreateGroup;
window.showJoinGroup = showJoinGroup;
window.joinGroup = joinGroup;
window.leaveGroup = leaveGroup;
window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.openAddDishModal = openAddDishModal;
window.saveDish = saveDish;
window.generateMenu = generateMenu;
window.regenerateMenu = regenerateMenu;
window.toggleMenuContent = toggleMenuContent;
window.setMealDuration = setMealDuration;
window.installApp = installApp;
