// ============================
// Configuration Firebase
// ============================
const firebaseConfig = {
  apiKey: "AIzaSyCviy5lWve4UUaSpZTz9hnSPu16e_mO_2UY",
  authDomain: "menu-generator-7c7bf.firebaseapp.com",
  databaseURL: "https://menu-generator-7c7bf-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "menu-generator-7c7bf",
  storageBucket: "menu-generator-7c7bf.firebasestorage.app",
  messagingSenderId: "760559115603",
  appId: "1:760559115603:web:30955099b520f65c3495a6"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ============================
// État global
// ============================
let groupId = localStorage.getItem('groupId') || '';
let prevGroupId = null;
let menuConfig = { sportDays: [], mealDuration: { lunch: 1, dinner: 1 } };
let dishes = [];
let menus = [];
let configSaveTimer = null;
const daysOfWeek = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const seasons = ['Printemps','Été','Automne','Hiver'];

// ============================
// Initialisation
// ============================
window.onload = () => {
  initSportDaysChips();
  initSeasonsChips();
  hideJoinBox(); // input caché par défaut

  if (groupId) {
    showMainApp();
    listenToFirebase();
  } else {
    // on reste sur l'écran de groupe
    document.getElementById('groupSetup').classList.remove('hidden');
  }
};

// ============================
// Groupes (création / rejoindre)
// ============================
function createGroup() {
  const id = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2,9);
  groupId = id;
  localStorage.setItem('groupId', groupId);
  // crée le nœud minimal si nécessaire
  database.ref(`groups/${groupId}`).set({ config: menuConfig })
    .then(() => {
      alert('✅ Groupe créé : ' + groupId);
      showMainApp();
      listenToFirebase();
    })
    .catch(err => {
      console.error(err);
      alert('Erreur lors de la création du groupe');
    });
}

function showJoinBox() {
  document.getElementById('joinGroupBox').classList.remove('hidden');
  document.getElementById('groupIdInput').focus();
}

function hideJoinBox() {
  document.getElementById('joinGroupBox').classList.add('hidden');
  document.getElementById('groupIdInput').value = '';
}

function joinGroupConfirm() {
  const input = document.getElementById('groupIdInput').value.trim();
  if (!input) return alert('Entrez un identifiant de groupe.');
  const triedId = input;
  // vérifie si existant
  database.ref(`groups/${triedId}`).once('value')
    .then(snapshot => {
      if (snapshot.exists()) {
        groupId = triedId;
        localStorage.setItem('groupId', groupId);
        // récupère config si existante
        const remote = snapshot.val();
        if (remote.config) menuConfig = remote.config;
        showMainApp();
        listenToFirebase();
      } else {
        // propose la création si n'existe pas
        if (confirm(`Le groupe ${triedId} n'existe pas. Voulez-vous le créer ?`)) {
          groupId = triedId;
          localStorage.setItem('groupId', groupId);
          database.ref(`groups/${groupId}`).set({ config: menuConfig })
            .then(() => {
              showMainApp();
              listenToFirebase();
              alert('Groupe créé : ' + groupId);
            }).catch(err => { console.error(err); alert('Erreur lors de la création'); });
        }
      }
    })
    .catch(err => {
      console.error(err);
      alert('Erreur lors de la connexion à Firebase');
    })
    .finally(() => hideJoinBox());
}

function leaveGroup() {
  if (!confirm("Quitter le groupe ?")) return;
  if (prevGroupId) {
    // detach listeners
    database.ref(`groups/${prevGroupId}/config`).off();
    database.ref(`groups/${prevGroupId}/dishes`).off();
    database.ref(`groups/${prevGroupId}/menus`).off();
    prevGroupId = null;
  }
  localStorage.removeItem('groupId');
  groupId = '';
  // reload pour revenir à l'écran de configuration proprement
  location.reload();
}

function showMainApp() {
  document.getElementById('groupSetup').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  document.getElementById('syncBadge').classList.remove('hidden');
  document.getElementById('groupIdDisplay').textContent = groupId;
  document.getElementById('currentGroupId').textContent = groupId;
}

// ============================
// Firebase listeners
// ============================
function listenToFirebase() {
  if (!groupId) return;

  // detach anciens listeners si changement
  if (prevGroupId && prevGroupId !== groupId) {
    database.ref(`groups/${prevGroupId}/config`).off();
    database.ref(`groups/${prevGroupId}/dishes`).off();
    database.ref(`groups/${prevGroupId}/menus`).off();
  }
  prevGroupId = groupId;

  // config
  database.ref(`groups/${groupId}/config`).on('value', snap => {
    const v = snap.val();
    if (v) {
      menuConfig = v;
      updateConfigUI();
    }
  });

  // dishes
  database.ref(`groups/${groupId}/dishes`).on('value', snap => {
    const v = snap.val();
    dishes = v ? Object.values(v) : [];
    renderRecipes();
  });

  // menus
  database.ref(`groups/${groupId}/menus`).on('value', snap => {
    const v = snap.val();
    menus = v ? Object.values(v) : [];
    renderMenus();
  });
}

// ============================
// Configuration UI & sauvegarde (debounced)
// ============================
function initSportDaysChips() {
  const container = document.getElementById('sportDaysChips');
  container.innerHTML = '';
  daysOfWeek.forEach(day => {
    const chip = document.createElement('div');
    chip.id = 'sport_' + day;
    chip.className = 'chip';
    chip.textContent = day;
    chip.onclick = () => { toggleSportDay(day); };
    container.appendChild(chip);
  });
}

function updateConfigUI() {
  // sport days (multi)
  daysOfWeek.forEach(day => {
    const el = document.getElementById('sport_' + day);
    if (!el) return;
    el.classList.toggle('selected', menuConfig.sportDays && menuConfig.sportDays.includes(day));
  });
  // lunch/dinner (single)
  ['lunch1','lunch2','dinner1','dinner2'].forEach(id => {
    const e = document.getElementById(id);
    if (e) e.classList.remove('selected');
  });
  const lunchId = 'lunch' + (menuConfig.mealDuration?.lunch || 1);
  const dinnerId = 'dinner' + (menuConfig.mealDuration?.dinner || 1);
  if (document.getElementById(lunchId)) document.getElementById(lunchId).classList.add('selected');
  if (document.getElementById(dinnerId)) document.getElementById(dinnerId).classList.add('selected');
}

function saveConfigDebounced() {
  if (!groupId) return;
  if (configSaveTimer) clearTimeout(configSaveTimer);
  configSaveTimer = setTimeout(() => {
    database.ref(`groups/${groupId}/config`).set(menuConfig).catch(err => console.error(err));
  }, 150);
}

function toggleSportDay(day) {
  if (!menuConfig.sportDays) menuConfig.sportDays = [];
  if (menuConfig.sportDays.includes(day)) {
    menuConfig.sportDays = menuConfig.sportDays.filter(d => d !== day);
  } else {
    menuConfig.sportDays.push(day);
  }
  updateConfigUI();     // update immédiate pour l'UX
  saveConfigDebounced();
}

function setMealDuration(meal, duration) {
  if (!menuConfig.mealDuration) menuConfig.mealDuration = { lunch:1, dinner:1 };
  menuConfig.mealDuration[meal] = duration;
  updateConfigUI();
  saveConfigDebounced();
}

// ============================
// Add / remove recipes
// ============================
function initSeasonsChips() {
  const container = document.getElementById('seasonsChips');
  container.innerHTML = '';
  seasons.forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.id = 'season_' + s;
    chip.textContent = s;
    chip.onclick = () => chip.classList.toggle('selected');
    container.appendChild(chip);
  });
}

function addRecipe() {
  if (!groupId) return alert('Vous devez être dans un groupe pour ajouter une recette.');
  const name = document.getElementById('recipeName').value.trim();
  if (!name) return alert('Entrez un nom de recette.');
  const seasonsChosen = seasons.filter(s => document.getElementById('season_' + s).classList.contains('selected'));
  const sportDay = document.getElementById('recipeSportDay').checked;
  const vegetarian = document.getElementById('recipeVegetarian').checked;
  const grill = document.getElementById('recipeGrill').checked;

  const id = Date.now().toString();
  const recipe = { id, name, seasons: seasonsChosen, sportDay, vegetarian, grill };

  database.ref(`groups/${groupId}/dishes/${id}`).set(recipe)
    .then(() => {
      // reset form & close modal
      document.getElementById('recipeName').value = '';
      seasons.forEach(s => document.getElementById('season_' + s).classList.remove('selected'));
      document.getElementById('recipeSportDay').checked = false;
      document.getElementById('recipeVegetarian').checked = false;
      document.getElementById('recipeGrill').checked = false;
      closeModal('addRecipeModal');
    })
    .catch(err => { console.error(err); alert('Erreur lors de l\'ajout'); });
}

function renderRecipes() {
  const container = document.getElementById('recipesContainer');
  container.innerHTML = '';
  if (!dishes || dishes.length === 0) {
    container.innerHTML = '<div class="info-text">Aucune recette pour le moment. Ajoutez-en une !</div>';
    return;
  }
  dishes.forEach(d => {
    const el = document.createElement('div');
    el.className = 'recipe-item';
    const left = document.createElement('div');
    left.innerHTML = `<div style="font-weight:600">${escapeHtml(d.name)}</div>
                      <div class="meta">${d.seasons?.join(', ') || 'Toutes saisons'} ${d.vegetarian ? ' • Végé' : ''}</div>`;
    const right = document.createElement('div');
    right.innerHTML = `<button class="delete-btn" onclick="deleteRecipe('${d.id}')"><span class="material-icons">delete</span></button>`;
    el.appendChild(left);
    el.appendChild(right);
    container.appendChild(el);
  });
}

function deleteRecipe(id) {
  if (!confirm('Supprimer cette recette ?')) return;
  database.ref(`groups/${groupId}/dishes/${id}`).remove().catch(err => console.error(err));
}

// ============================
// Generate & render menus (simple)
// ============================
function generateMenu() {
  if (!groupId) return alert('Rejoignez ou créez un groupe d\'abord.');
  const schedule = daysOfWeek.map(day => ({
    day,
    isSportDay: menuConfig.sportDays?.includes(day) || false,
    lunch: 'Libre',
    dinner: 'Libre'
  }));
  const newMenu = {
    id: Date.now().toString(),
    date: new Date().toLocaleDateString('fr-FR'),
    weekNumber: getWeekNumber(new Date()),
    schedule
  };
  database.ref(`groups/${groupId}/menus/${newMenu.id}`).set(newMenu).catch(err => console.error(err));
}

function renderMenus() {
  const container = document.getElementById('menusContainer');
  container.innerHTML = '';
  if (!menus || menus.length === 0) {
    container.innerHTML = '<div class="info-text">Aucun menu généré pour le moment.</div>';
    return;
  }
  menus.slice().reverse().forEach(menu => {
    const card = document.createElement('div');
    card.className = 'day-card';
    const header = document.createElement('div');
    header.innerHTML = `<strong>Semaine ${menu.weekNumber} — ${menu.date}</strong>`;
    card.appendChild(header);
    menu.schedule.forEach(d => {
      const item = document.createElement('div');
      item.style.marginTop = '8px';