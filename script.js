const scoresContainer = document.getElementById('scores');
const updatedLabel = document.getElementById('last-updated');
const refreshButton = document.getElementById('refresh');
const logoutButton = document.getElementById('logout');
const authStatusLabel = document.getElementById('auth-status');
const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');
const cardTemplate = document.getElementById('score-card-template');

const USERS_STORAGE_KEY = 'fera_users_v1';
const SESSION_STORAGE_KEY = 'fera_session_v1';
const SCORE_CACHE_STORAGE_KEY = 'fera_score_cache_v1';

const FALLBACK_MATCHES = [
  {
    league: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    homeScore: 2,
    awayScore: 1,
    status: "72'"
  },
  {
    league: 'La Liga',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    homeScore: 1,
    awayScore: 1,
    status: "65'"
  },
  {
    league: 'Serie A',
    homeTeam: 'Inter',
    awayTeam: 'Milan',
    homeScore: 0,
    awayScore: 0,
    status: 'HT'
  }
];

let currentUser = null;

function parseStoredValue(key, fallbackValue) {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return fallbackValue;
    }

    return JSON.parse(value);
  } catch {
    return fallbackValue;
  }
}

function readUsers() {
  const users = parseStoredValue(USERS_STORAGE_KEY, []);
  return Array.isArray(users) ? users : [];
}

function saveUsers(users) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function readScoreCache() {
  const scoreCache = parseStoredValue(SCORE_CACHE_STORAGE_KEY, {});
  return scoreCache && typeof scoreCache === 'object' ? scoreCache : {};
}

function saveScoreCache(scoreCache) {
  localStorage.setItem(SCORE_CACHE_STORAGE_KEY, JSON.stringify(scoreCache));
}

function readSession() {
  const session = parseStoredValue(SESSION_STORAGE_KEY, null);

  if (!session || typeof session.username !== 'string') {
    return null;
  }

  return session;
}

function saveSession(username) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      username
    })
  );
}

function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function findUserByName(users, username) {
  const normalized = normalizeUsername(username);
  return users.find((user) => normalizeUsername(user.username) === normalized);
}

async function hashPassword(password) {
  if (window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(password);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  }

  return btoa(password);
}

function setAuthStatus(message, isError = false) {
  authStatusLabel.textContent = message;
  authStatusLabel.classList.toggle('is-error', isError);
}

function setCurrentUser(username) {
  currentUser = username;

  if (username) {
    saveSession(username);
    setAuthStatus(`Signed in as ${username}.`);
    logoutButton.hidden = false;
    refreshButton.disabled = false;
    return;
  }

  clearSession();
  setAuthStatus('Not logged in.');
  logoutButton.hidden = true;
  refreshButton.disabled = true;
  updatedLabel.textContent = 'Log in to load live scores.';
  renderScores([]);
}

function loadCachedMatches(username) {
  const scoreCache = readScoreCache();
  const matches = scoreCache[normalizeUsername(username)];
  return Array.isArray(matches) ? matches : [];
}

function cacheMatches(username, matches) {
  const scoreCache = readScoreCache();
  scoreCache[normalizeUsername(username)] = matches;
  saveScoreCache(scoreCache);
}

function renderScores(matches) {
  scoresContainer.replaceChildren();

  if (!matches.length) {
    scoresContainer.textContent = 'No live matches right now.';
    return;
  }

  matches.forEach((match) => {
    const fragment = cardTemplate.content.cloneNode(true);
    fragment.querySelector('.league').textContent = match.league;
    fragment.querySelector('.teams').textContent = `${match.homeTeam} vs ${match.awayTeam}`;
    fragment.querySelector('.score').textContent = `${match.homeScore} - ${match.awayScore}`;
    fragment.querySelector('.status').textContent = match.status;
    scoresContainer.appendChild(fragment);
  });
}

function mapEspnEvents(events) {
  return (events || []).slice(0, 12).map((event) => {
    const competition = event.competitions?.[0];
    const home = competition?.competitors?.find((team) => team.homeAway === 'home');
    const away = competition?.competitors?.find((team) => team.homeAway === 'away');

    return {
      league: event.leagues?.[0]?.name || 'Football League',
      homeTeam: home?.team?.shortDisplayName || 'Home',
      awayTeam: away?.team?.shortDisplayName || 'Away',
      homeScore: home?.score || 0,
      awayScore: away?.score || 0,
      status: event.status?.type?.shortDetail || 'Live'
    };
  });
}

async function loadScores() {
  if (!currentUser) {
    setAuthStatus('Log in to load live scores.');
    return;
  }

  refreshButton.disabled = true;

  try {
    const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard');

    if (!response.ok) {
      throw new Error('Failed to fetch live scores');
    }

    const data = await response.json();
    const matches = mapEspnEvents(data.events);
    const resolvedMatches = matches.length ? matches : FALLBACK_MATCHES;
    cacheMatches(currentUser, resolvedMatches);
    renderScores(resolvedMatches);
  } catch {
    const cachedMatches = loadCachedMatches(currentUser);
    renderScores(cachedMatches.length ? cachedMatches : FALLBACK_MATCHES);
  } finally {
    updatedLabel.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    refreshButton.disabled = false;
  }
}

async function handleSignup(event) {
  event.preventDefault();
  const formData = new FormData(signupForm);
  const username = (formData.get('username') || '').toString().trim();
  const password = (formData.get('password') || '').toString();

  if (username.length < 3 || password.length < 6) {
    setAuthStatus('Username must be 3+ chars and password 6+ chars.', true);
    return;
  }

  const users = readUsers();

  if (findUserByName(users, username)) {
    setAuthStatus('That username already exists.', true);
    return;
  }

  const passwordHash = await hashPassword(password);
  users.push({
    username,
    passwordHash
  });
  saveUsers(users);
  signupForm.reset();
  setAuthStatus('Account created. You can now log in.');
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const username = (formData.get('username') || '').toString().trim();
  const password = (formData.get('password') || '').toString();
  const users = readUsers();
  const user = findUserByName(users, username);

  if (!user) {
    setAuthStatus('User not found.', true);
    return;
  }

  const passwordHash = await hashPassword(password);

  if (passwordHash !== user.passwordHash) {
    setAuthStatus('Invalid credentials.', true);
    return;
  }

  loginForm.reset();
  setCurrentUser(user.username);
  const cachedMatches = loadCachedMatches(user.username);

  if (cachedMatches.length) {
    renderScores(cachedMatches);
    updatedLabel.textContent = 'Showing cached scores. Refreshing live data…';
  }

  loadScores();
}

function handleLogout() {
  setCurrentUser(null);
}

function initializeAuth() {
  const existingSession = readSession();

  if (!existingSession) {
    setCurrentUser(null);
    return;
  }

  const user = findUserByName(readUsers(), existingSession.username);

  if (!user) {
    setCurrentUser(null);
    return;
  }

  setCurrentUser(user.username);
  const cachedMatches = loadCachedMatches(user.username);

  if (cachedMatches.length) {
    renderScores(cachedMatches);
    updatedLabel.textContent = 'Showing cached scores. Refreshing live data…';
  }

  loadScores();
}

signupForm.addEventListener('submit', handleSignup);
loginForm.addEventListener('submit', handleLogin);
logoutButton.addEventListener('click', handleLogout);
refreshButton.addEventListener('click', loadScores);
initializeAuth();
setInterval(loadScores, 60000);
