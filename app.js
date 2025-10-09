// Firebase
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

// Global state
let groupId = localStorage.getItem('groupId') || '';
let menuConfig = { sportDays: [], mealDuration: { lunch: 1, dinner: 1 } };
let menus = [];

// Initialisation
window.onload = () => {
  initSportDaysChips();
  if (groupId) {
    showMainApp();
    listenToFirebase();
  }
};

// -----------------------------
// Groupes
// -----------------------------
function createGroup() {
  groupId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('groupId', groupId);
  database.ref(`groups/${groupId}`).set({ config: menuConfig });
  alert('✅ Nouveau groupe créé ! ID : ' + groupId);
  showMainApp();
  listenToFirebase();
}

function joinGroup() {
  const input = document.getElementById('groupIdInput').value.trim();
  if (!input) return alert('❌ Entrez un identifiant de groupe');
  groupId = input;
  localStorage.setItem('groupId', groupId);
  showMainApp();
  listenToFirebase();
}

function leaveGroup() {
  if (confirm('Voulez-vous vraiment quitter ce groupe ?')) {
    localStorage.removeItem('groupId');
    location.reload();
  }
}

function showMainApp() {
  document.getElementById('groupSetup').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  document.getElementById('syncBadge').classList.remove('hidden');
  document.getElementById('groupIdDisplay').textContent = 'Groupe: ' + groupId;
  document.getElementById('currentGroupId').textContent = groupId;
}

// -----------------------------
// Firebase
// -----------------------------
function listenToFirebase() {
  database.ref(`groups/${groupId}/config`).on('value', snap => {
    if (snap.val()) {
      menuConfig = snap.val();
      updateConfigUI();
    }
  });

  database.ref(`groups/${groupId}/menus`).on('value', snap => {
    const data = snap.val();
    menus = data ? Object.values(data) : [];
    renderMenus();
  });
}

// -----------------------------
// Configuration
// -----------------------------
const daysOfWeek = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

function initSportDaysChips() {
  const container = document.getElementById('sportDaysChips');
  container.innerHTML = '';
  daysOfWeek.forEach(day => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = day;
    chip.onclick = () => toggleSportDay(day);
    container.appendChild(chip);
  });
}

function toggleSportDay(day) {
  if (menuConfig.sportDays.includes(day))
    menuConfig.sportDays = menuConfig.sportDays.filter(d => d !== day);
  else
    menuConfig.sportDays.push(day);
  updateConfigUI();
  database.ref(`groups/${groupId}/config`).set(menuConfig);
}

function setMealDuration(meal, duration) {
  menuConfig.mealDuration[meal] = duration;
  updateConfigUI();
  database.ref(`groups/${groupId}/config`).set(menuConfig);
}

function updateConfigUI() {
  daysOfWeek.forEach(day => {
    const chip = document.querySelector(`#sportDaysChips .chip:nth-child(${daysOfWeek.indexOf(day)+1})`);
    if (chip) chip.classList.toggle('selected', menuConfig.sportDays.includes(day));
  });
  ['lunch1','lunch2','dinner1','dinner2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('selected');
  });
  document.getElementById('lunch' + menuConfig.mealDuration.lunch).classList.add('selected');
  document.getElementById('dinner' + menuConfig.mealDuration.dinner).classList.add('selected');
}

// -----------------------------
// Menus
// -----------------------------
function generateMenu() {
  const newMenu = {
    id: Date.now(),
    date: new Date().toLocaleDateString('fr-FR'),
    weekNumber: getWeekNumber(new Date()),
    schedule: daysOfWeek.map(day => ({
      day,
      isSportDay: menuConfig.sportDays.includes(day),
      lunch: 'Déjeuner libre',
      dinner: 'Dîner libre'
    }))
  };
  database.ref(`groups/${groupId}/menus/${newMenu.id}`).set(newMenu);
}

function renderMenus() {
  const container = document.getElementById('menusList');
  container.innerHTML = '';
  menus.slice().reverse().forEach(menu => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="card-title">
        <span class="material-icons">calendar_today</span>
        Semaine ${menu.weekNumber} - ${menu.date}</div>` +
      menu.schedule.map(d => `
        <div class="day-card">
          <strong>${d.day}</strong> ${d.isSportDay ? '💪' : ''}<br>
          <em>${d.lunch}</em> / <em>${d.dinner}</em>
        </div>`).join('');
    container.appendChild(card);
  });
}

// -----------------------------
// Utilitaires
// -----------------------------
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// -----------------------------
// Modales
// -----------------------------
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }