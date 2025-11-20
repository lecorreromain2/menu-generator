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
// MISE À JOUR : Ajout de activeSeasons
let menuConfig = { sportDays: [], activeSeasons: ['Printemps', 'Été', 'Automne', 'Hiver'], mealDuration: { lunch: 1, dinner: 1 } };
let newDishSeasons = [];
let editingDishId = null;

const seasons = ['Printemps', 'Été', 'Automne', 'Hiver'];
const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// ===== MENU =====

function generateMenu(targetWeekNumber = null) {
  const currentSeason = getCurrentSeason();
  const recentlyUsed = getRecentlyUsedDishes();
  
  // Si pas de numéro de semaine spécifié, générer pour la semaine prochaine
  const weekNumber = targetWeekNumber || (getWeekNumber(new Date()) + 1);
  
  // Filtrer les plats disponibles
  // NOUVEAU FILTRE : (d.seasons.length === 0 || (d.seasons.includes(currentSeason) && menuConfig.activeSeasons.includes(currentSeason)))
  const activeSeasonsList = menuConfig.activeSeasons || [];
  
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
  const usedInMenu = new Map(); // Compte combien de fois chaque plat est utilisé

  for (let i = 0; i < 7; i++) {
    const day = daysOfWeek[i];
    const isSportDay = (menuConfig.sportDays || []).includes(day);
    
    // === DÉJEUNER ===
    let lunchDish = null;
    // Correction: Assurer la bonne gestion de la répétition
    // Répéter uniquement si la durée est > 1 ET que l'on n'est PAS au début d'un nouveau cycle de répétition
    if (menuConfig.mealDuration.lunch > 1 && i > 0 && (i % menuConfig.mealDuration.lunch) !== 0 && schedule[i - 1].lunch) {
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
    // Correction: Assurer la bonne gestion de la répétition
    // Répéter uniquement si la durée est > 1 ET que l'on n'est PAS au début d'un nouveau cycle de répétition
    if (menuConfig.mealDuration.dinner > 1 && i > 0 && (i % menuConfig.mealDuration.dinner) !== 0 && schedule[i - 1].dinner) {
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
  switchToTab('menus');
}

function regenerateMenu(menuId, weekNumber) {
  if (confirm('Voulez-vous régénérer ce menu ? L\'ancien sera remplacé.')) {
    // Supprimer l'ancien menu
    database.ref(`groups/${groupId}/menus/${menuId}`).remove();
    // Générer un nouveau menu pour la même semaine
    generateMenu(weekNumber);
  }
}

function renderMenus(menusArray = menus) {
  const container = document.getElementById('menusList');
  const empty = document.getElementById('noMenus');
  
  if (!container) {
    console.error('❌ Impossible de trouver #menusList');
    return;
  }

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
    // Nouvelle structure avec en-tête jour/sport et grille déjeuner/dîner
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

  console.log(`📅 ${menusArray.length} menus affichés`);
}

// ===== CONFIGURATION =====

// NOUVEAU : Toggle pour les saisons dans la config
function toggleConfigSeason(season) {
  // Sécurité: Assurer que c'est un tableau avant d'inclure/filtrer
  menuConfig.activeSeasons = menuConfig.activeSeasons || []; 
  
  if (menuConfig.activeSeasons.includes(season)) {
    menuConfig.activeSeasons = menuConfig.activeSeasons.filter(s => s !== season);
  } else {
    menuConfig.activeSeasons.push(season);
  }
  database.ref(`groups/${groupId}/config`).set(menuConfig);
}


function toggleSportDay(day) {
  // Sécurité: Assurer que c'est un tableau avant d'inclure/filtrer
  menuConfig.sportDays = menuConfig.sportDays || []; 
  
  if (menuConfig.sportDays.includes(day)) {
    menuConfig.sportDays = menuConfig.sportDays.filter(d => d !== day);
  } else {
    menuConfig.sportDays.push(day);
  }
  database.ref(`groups/${groupId}/config`).set(menuConfig);
}

function setMealDuration(meal, duration) {
  menuConfig.mealDuration = menuConfig.mealDuration || { lunch: 1, dinner: 1 }; // Sécurité
  menuConfig.mealDuration[meal] = duration;
  database.ref(`groups/${groupId}/config`).set(menuConfig);
}

function updateConfigUI() {
  // Correction: Utiliser une liste de jours de sport sécurisée (vide si undefined)
  const sportDaysList = menuConfig.sportDays || [];
  
  // NOUVEAU : Liste de saisons actives sécurisée
  const activeSeasonsList = menuConfig.activeSeasons || [];

  // Mettre à jour les chips de jours de sport (modal)
  daysOfWeek.forEach(day => {
    const chip = document.getElementById('sport_' + day);
    if (chip) {
      // Utilisation de la liste sécurisée
      chip.classList.toggle('selected', sportDaysList.includes(day));
    }
    // Mettre à jour aussi dans l'affichage de l'onglet config
    const chipDisplay = document.getElementById('sport_display_' + day);
    if (chipDisplay) {
      // Utilisation de la liste sécurisée
      chipDisplay.classList.toggle('selected', sportDaysList.includes(day));
    }
  });
  
  // NOUVEAU : Mettre à jour les chips de saisons (affichage config)
  seasons.forEach(season => {
    const chipDisplay = document.getElementById('season_display_' + season);
    if (chipDisplay) {
      chipDisplay.classList.toggle('selected', activeSeasonsList.includes(season));
    }
  });


  // Mettre à jour les chips de durée des repas (modal)
  // Sécurité pour mealDuration
  const mealDuration = menuConfig.mealDuration || { lunch: 1, dinner: 1 };
  
  ['lunch1', 'lunch2', 'dinner1', 'dinner2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('selected');
  });
  
  const lunch = document.getElementById('lunch' + mealDuration.lunch);
  const dinner = document.getElementById('dinner' + mealDuration.dinner);
  if (lunch) lunch.classList.add('selected');
  if (dinner) dinner.classList.add('selected');
  
  // Mettre à jour les chips de durée des repas (affichage config)
  ['lunch1Display', 'lunch2Display', 'dinner1Display', 'dinner2Display'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('selected');
  });
  
  const lunchDisplay = document.getElementById('lunch' + mealDuration.lunch + 'Display');
  const dinnerDisplay = document.getElementById('dinner' + mealDuration.dinner + 'Display');
  if (lunchDisplay) lunchDisplay.classList.add('selected');
  if (dinnerDisplay) dinnerDisplay.classList.add('selected');
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
  
  // Correction: Ajouter une vérification pour s'assurer que 'm' et 'm.weekNumber' existent
  const recentMenus = menus.filter(m => 
    m && m.weekNumber !== undefined && 
    currentWeek - m.weekNumber <= 3 && 
    currentWeek - m.weekNumber >= 0
  );
  
  const usedDishIds = new Set
