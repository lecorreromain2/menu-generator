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

// Initialize Firebase (mode compat)
const app = firebase.initializeApp(firebaseConfig);
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

// Initialisation
window.onload = function() {
  initSeasonChips();
  initSportDaysChips();
  
if (groupId) {
  console.log('🔗 Reconnexion au groupe :', groupId);
  showMainApp();
  listenToFirebase();
} else {
  console.log('🕓 Aucun groupe actif au démarrage');
}

  setupPWA();// ✅ Initialise le tooltip après que le DOM est prêt
  const syncIcon = document.getElementById('syncIcon');
  const tooltip = document.getElementById('tooltip');
  if (syncIcon && tooltip) {
    function showTooltip(text, event) {
  if (!tooltip) return; // ✅ évite l'erreur si l'élément n'existe pas
  tooltip.textContent = text;
  tooltip.style.left = event.pageX + 'px';
  tooltip.style.top = event.pageY + 'px';
  tooltip.classList.add('show');
}

   function hideTooltip() {
  if (!tooltip) return; // ✅ sécurité
  tooltip.classList.remove('show');
}

    syncIcon.addEventListener('mouseenter', (e) => showTooltip(`Groupe : ${groupId}`, e));
    syncIcon.addEventListener('mouseleave', hideTooltip);

    // Pour les écrans tactiles : clic long
    let touchTimer;
    syncIcon.addEventListener('touchstart', (e) => {
      touchTimer = setTimeout(() => showTooltip(`Groupe : ${groupId}`, e.touches[0]), 500);
    });
    syncIcon.addEventListener('touchend', () => {
      clearTimeout(touchTimer);
      hideTooltip();
    });
  }
};

// ===== NOTIFICATIONS =====

function showToast(message, duration = 3000) {
  const toast = document.getElementById('customToast');
  document.getElementById('toastMessage').textContent = message;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, duration);
}

function updateSyncIcon(syncing, error = false) {
  const indicator = document.getElementById('syncIndicator');
  const icon = document.getElementById('syncIcon');
  
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
  
  // ✅ Affiche le groupe en infobulle sur l’icône de synchronisation
  const syncIcon = document.getElementById('syncIcon');
  syncIcon.title = `Groupe : ${groupId}`;
  
  document.getElementById('currentGroupId').textContent = groupId;
  showTab('dishes');
}

function leaveGroup() {
  if (confirm('⚠️ Voulez-vous vraiment quitter ce groupe ?')) {
    localStorage.removeItem('groupId');
    location.reload();
  }
}

// ===== ONGLETS =====

function showTab(tabName, event) {
  // Masquer tous les onglets
  document.getElementById('dishesTab').classList.remove('active');
  document.getElementById('menusTab').classList.remove('active');
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  
  // Afficher l'onglet sélectionné
  const tabEl = document.getElementById(tabName + 'Tab');
  if (tabEl) tabEl.classList.add('active');

  // ✅ Sécurité : ne pas accéder à event.target si event est undefined
  if (event && event.target) {
    event.target.classList.add('active');
  }

  // Mettre à jour l'état des onglets
  if (tabName === 'dishes') {
    updateDishesTab();
  } else if (tabName === 'menus') {
    updateMenusTab();
  }
}

// === Met à jour l'état d'affichage selon les plats présents ===
function updateDishesTab() {
  const list = document.getElementById('dishesList');
  const empty = document.getElementById('noDishes');
  const hasItems = document.querySelectorAll('#dishesContainer .dish-item').length > 0;

  if (hasItems) {
    list.classList.remove('hidden');
    empty.style.display = 'none';
  } else {
    list.classList.add('hidden');
    empty.style.display = 'flex';
  }
}

// === Met à jour l'affichage de l'onglet "Menus" ===
function updateMenusTab() {
  const list = document.getElementById('menusList');
  const empty = document.getElementById('noMenus');
  const hasItems = document.querySelectorAll('#menusContainer .menu-item').length > 0;

  if (hasItems) {
    list.classList.remove('hidden');
    empty.style.display = 'none';
  } else {
    list.classList.add('hidden');
    empty.style.display = 'flex';
  }
}

// ===== FIREBASE =====

function listenToFirebase() {
  if (!groupId) {
    console.warn('⛔ Aucun groupId défini, impossible d’écouter Firebase.');
    showToast('❌ Aucun groupe sélectionné.');
    return;
  }

  console.log('🎧 Nouvelle écoute Firebase sur le groupe :', groupId);

  // 🔄 Supprimer toute ancienne écoute pour éviter les doublons
  database.ref().off();

  // ⏳ Laisse le temps à Firebase de créer les nœuds
  setTimeout(() => {
    const dishesRef = database.ref(`groups/${groupId}/dishes`);
    const menusRef = database.ref(`groups/${groupId}/menus`);
    const configRef = database.ref(`groups/${groupId}/config`);

    dishesRef.on('value', snapshot => {
      const data = snapshot.val();
      if (!data) {
        console.warn('⚠️ Aucun plat trouvé dans Firebase pour', groupId);
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
          if (!acc[dish.name] || acc[dish.name].id < dish.id)
            acc[dish.name] = dish;
          return acc;
        }, {})
      );

      console.log('✅ Plats récupérés depuis Firebase :', dishes.length);
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

      const menusArray = Object.entries(data).map(([key, value]) => ({
        ...value,
        id: key
      }));

      menus = Object.values(
        menusArray.reduce((acc, menu) => {
          if (!acc[menu.weekNumber] || acc[menu.weekNumber].id < menu.id)
            acc[menu.weekNumber] = menu;
          return acc;
        }, {})
      ).sort((a, b) => b.weekNumber - a.weekNumber);

      renderMenus();
    });

    configRef.on('value', snapshot => {
      const data = snapshot.val();
      if (data) {
        menuConfig = data;
        updateConfigUI();
      }
    });
  }, 500); // ⏳ Délai court pour garantir que les nœuds existent
}

// ===== PLATS =====

function initSeasonChips() {
  const container = document.getElementById('seasonsChips');
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
  
  closeModal('addDishModal');
}

function deleteDish(id) {
  if (confirm('Voulez-vous vraiment supprimer ce plat ?')) {
    updateSyncIcon(true);
    database.ref(`groups/${groupId}/dishes/${id}`).remove();
    showToast('✅ Plat supprimé');
  }
}

// === Affiche la liste des plats ===
function renderDishes() {
  const container = document.getElementById('dishesContainer');
  const listWrapper = document.getElementById('dishesList');
  const countEl = document.getElementById('dishCount');

  // Si pas de plats
  if (!dishes || dishes.length === 0) {
    container.innerHTML = '';
    countEl.textContent = 0;
    updateDishesTab();
    return;
  }

  // Nettoyer le conteneur avant rendu
  container.innerHTML = '';

  // Construire chaque plat
  dishes.forEach(dish => {
    const dishEl = document.createElement('div');
    dishEl.className = 'dish-item';

    // --- Construction des tags ---
    let tagsHTML = '';

    if (Array.isArray(dish.seasons)) {
      dish.seasons.forEach(s => {
        tagsHTML += `<span class="tag">${s}</span>`;
      });
    }

    if (dish.sportDay) tagsHTML += `<span class="tag tag-blue">Sport</span>`;
    if (dish.vegetarian) tagsHTML += `<span class="tag tag-green">Végé</span>`;
    if (dish.grillades) tagsHTML += `<span class="tag tag-orange">Grill</span>`;

    // --- Structure HTML du plat ---
    dishEl.innerHTML = `
      <div style="flex: 1;">
        <div class="dish-name">${dish.name}</div>
        <div class="tags">${tagsHTML}</div>
      </div>
      <div style="display: flex; gap: 4px;">
        <button class="icon-btn edit-btn">
          <span class="material-icons">edit</span>
        </button>
        <button class="icon-btn delete-btn">
          <span class="material-icons">delete</span>
        </button>
      </div>
    `;

    // --- Gestion des boutons ---
    dishEl.querySelector('.edit-btn').addEventListener('click', () => openEditDishModal(dish));
    dishEl.querySelector('.delete-btn').addEventListener('click', () => deleteDish(dish.id));

    container.appendChild(dishEl);
  });

  // Met à jour le compteur selon les plats affichés
  countEl.textContent = document.querySelectorAll('#dishesContainer .dish-item').length;

  // ✅ Appel unique ici (aucune récursion)
  updateDishesTab();
}


// ===== MENU =====

function generateMenu() {
  const currentSeason = getCurrentSeason();
  const recentlyUsed = getRecentlyUsedDishes();

  // Plats filtrés selon saison + non utilisés récemment
  const availableDishes = dishes.filter(d => 
    !recentlyUsed.has(d.id) && 
    (d.seasons.length === 0 || d.seasons.includes(currentSeason))
  );

  const totalDishes = dishes.length;
  const usableDishes = availableDishes.length;
  const requiredDishes = 14; // 7 jours × 2 repas

console.table(availableDishes);

  if (usableDishes < requiredDishes) {
    // 💡 Message explicatif détaillé
    let details = `Vous avez ${usableDishes} plat${usableDishes > 1 ? 's' : ''} utilisable${usableDishes > 1 ? 's' : ''} sur ${requiredDishes} nécessaires.`;
    
    if (totalDishes === 0) {
      details += `\n\n➡️ Ajoutez vos premières recettes avant de générer un menu.`;
    } else if (usableDishes === 0) {
      details += `\n\n➡️ Aucun plat disponible pour la saison "${currentSeason}" ou les 3 dernières semaines.`;
    } else {
      details += `\n\n➡️ Certains plats ont peut-être été utilisés récemment ou ne correspondent pas à la saison "${currentSeason}".`;
    }

    showToast('❌ Pas assez de plats disponibles !\n\n' + details, 6000);
    console.warn(details);
    return;
  }

  const schedule = [];
  const usedInMenu = new Set();

  for (let i = 0; i < 7; i++) {
    const day = daysOfWeek[i];
    const isSportDay = menuConfig.sportDays.includes(day);
    
    let lunchDish = null;
    if (menuConfig.mealDuration.lunch === 2 && i > 0 && schedule[i - 1].lunch) {
      lunchDish = schedule[i - 1].lunch;
    } else {
      const filtered = availableDishes.filter(d => !usedInMenu.has(d.id));
      if (filtered.length > 0) {
        lunchDish = filtered[Math.floor(Math.random() * filtered.length)];
        usedInMenu.add(lunchDish.id);
      }
    }

    let dinnerDish = null;
    if (menuConfig.mealDuration.dinner === 2 && i > 0 && schedule[i - 1].dinner) {
      dinnerDish = schedule[i - 1].dinner;
    } else {
      const filtered = availableDishes.filter(d => !usedInMenu.has(d.id));
      if (filtered.length > 0) {
        dinnerDish = filtered[Math.floor(Math.random() * filtered.length)];
        usedInMenu.add(dinnerDish.id);
      }
    }

    schedule.push({ day, lunch: lunchDish, dinner: dinnerDish, isSportDay });
  }

  const newMenu = {
    id: Date.now(),
    weekNumber: getWeekNumber(new Date()),
    date: new Date().toLocaleDateString('fr-FR'),
    schedule
  };

  updateSyncIcon(true);
  database.ref(`groups/${groupId}/menus/${newMenu.id}`).set(newMenu);
  showToast('✅ Menu généré !');
  showTab('menus');
}

// === Affiche la liste des menus générés ===
function renderMenus() {
  const container = document.getElementById('menusContainer');
  const countEl = document.getElementById('menuCount');

    // ✅ Sécurité : si les éléments ne sont pas encore dans le DOM, on annule
  if (!container || !countEl) {
    console.warn('⏳ Conteneur des menus introuvable, rendu annulé pour le moment.');
    return;
  }

  if (!menus || menus.length === 0) {
    container.innerHTML = '';
    countEl.textContent = 0;
    updateMenusTab();
    return;
  }

  // Vide le conteneur avant affichage
  container.innerHTML = '';

  menus.forEach(menu => {
    const menuEl = document.createElement('div');
    menuEl.className = 'menu-item';

    // Nom de la semaine
    const weekTitle = `Semaine ${menu.weekNumber}`;

    // Construction du planning jour / repas
    let scheduleHTML = '';
    if (Array.isArray(menu.schedule)) {
      menu.schedule.forEach(day => {
        scheduleHTML += `
          <div class="menu-day">
            <div class="menu-day-title">${day.day}</div>
            <div class="menu-meals">
              <div><strong>Midi :</strong> ${day.lunch || '-'}</div>
              <div><strong>Soir :</strong> ${day.dinner || '-'}</div>
            </div>
          </div>
        `;
      });
    }

    // Structure HTML finale
    menuEl.innerHTML = `
      <div class="menu-header">
        <div class="menu-title">${weekTitle}</div>
        <div class="menu-actions">
          <button class="icon-btn view-btn" title="Voir le menu">
            <span class="material-icons">visibility</span>
          </button>
          <button class="icon-btn delete-btn" title="Supprimer le menu">
            <span class="material-icons">delete</span>
          </button>
        </div>
      </div>
      <div class="menu-body">${scheduleHTML}</div>
    `;

    // Gestion des boutons
    menuEl.querySelector('.view-btn').addEventListener('click', () => openMenuModal(menu));
    menuEl.querySelector('.delete-btn').addEventListener('click', () => deleteMenu(menu.id));

    container.appendChild(menuEl);
  });

  // Mise à jour du compteur
  countEl.textContent = document.querySelectorAll('#menusContainer .menu-item').length;

  // ✅ Appel unique ici
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
    document.getElementById(id).classList.remove('selected');
  });
  document.getElementById('lunch' + menuConfig.mealDuration.lunch).classList.add('selected');
  document.getElementById('dinner' + menuConfig.mealDuration.dinner).classList.add('selected');
}

// ===== UTILITAIRES =====

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
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
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// ===== PWA =====

let deferredPrompt;

function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => {
      console.log('✅ Service Worker enregistré');
    }).catch(err => {
      console.error('❌ Erreur Service Worker:', err);
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installPrompt').classList.remove('hidden');
  });

  if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('✅ Application installée');
  }
}

function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('✅ Application installée');
        document.getElementById('installPrompt').classList.add('hidden');
      }
      deferredPrompt = null;
    });
  }
}

const syncIcon = document.getElementById('syncIcon');
const tooltip = document.getElementById('tooltip');

function showTooltip(text, event) {
  tooltip.textContent = text;
  tooltip.style.left = event.pageX + 'px';
  tooltip.style.top = event.pageY + 'px';
  tooltip.classList.add('show');
}

function hideTooltip() {
  if (!tooltip) return;
  tooltip.classList.remove('show');
}

syncIcon.addEventListener('mouseenter', (e) => showTooltip(`Groupe : ${groupId}`, e));
syncIcon.addEventListener('mouseleave', hideTooltip);

// Pour les écrans tactiles : clic long (500ms)
let touchTimer;
syncIcon.addEventListener('touchstart', (e) => {
  touchTimer = setTimeout(() => showTooltip(`Groupe : ${groupId}`, e.touches[0]), 500);
});
syncIcon.addEventListener('touchend', () => {
  clearTimeout(touchTimer);
  hideTooltip();
});

// === Rendre accessibles les fonctions globales depuis le HTML ===
window.showGroupTypeSelection = showGroupTypeSelection;
window.showCreateGroup = showCreateGroup;
window.showJoinGroup = showJoinGroup;
window.joinGroup = joinGroup;
window.leaveGroup = leaveGroup;

