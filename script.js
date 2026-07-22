const scoresContainer = document.getElementById('scores');
const updatedLabel = document.getElementById('last-updated');
const refreshButton = document.getElementById('refresh');
const cardTemplate = document.getElementById('score-card-template');
const playerSearchForm = document.getElementById('player-search-form');
const playerQueryInput = document.getElementById('player-query');
const playerSearchButton = document.getElementById('player-search-button');
const searchFeedback = document.getElementById('search-feedback');
const playerResults = document.getElementById('player-results');
const playerCardTemplate = document.getElementById('player-card-template');

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

function renderPlayers(players) {
  playerResults.replaceChildren();

  if (!players.length) {
    searchFeedback.textContent = 'No Premier League players found on Wikipedia for that search.';
    return;
  }

  searchFeedback.textContent = `Found ${players.length} Premier League player${players.length === 1 ? '' : 's'}.`;

  players.forEach((player) => {
    const fragment = playerCardTemplate.content.cloneNode(true);
    const image = fragment.querySelector('.player-image');
    fragment.querySelector('.player-name').textContent = player.name;
    fragment.querySelector('.player-summary').textContent = player.summary;
    const link = fragment.querySelector('.player-link');
    link.href = player.pageUrl;

    if (player.imageUrl) {
      image.src = player.imageUrl;
      image.alt = `${player.name} portrait`;
      image.hidden = false;
    }

    playerResults.appendChild(fragment);
  });
}

function stripHtml(text = '') {
  const temp = document.createElement('div');
  temp.innerHTML = text;
  return temp.textContent || '';
}

async function searchPremierLeaguePlayers(query) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const searchUrl = new URL('https://en.wikipedia.org/w/api.php');
  searchUrl.searchParams.set('action', 'query');
  searchUrl.searchParams.set('list', 'search');
  searchUrl.searchParams.set('srsearch', `${trimmedQuery} Premier League footballer`);
  searchUrl.searchParams.set('srlimit', '8');
  searchUrl.searchParams.set('format', 'json');
  searchUrl.searchParams.set('origin', '*');

  const searchResponse = await fetch(searchUrl.toString());
  if (!searchResponse.ok) {
    throw new Error('Wikipedia search failed');
  }

  const searchData = await searchResponse.json();
  const candidates = (searchData.query?.search || []).filter((result) =>
    /premier league/i.test(result.snippet || '')
  );

  if (!candidates.length) {
    return [];
  }

  const pageTitles = candidates.map((result) => result.title).join('|');
  const detailsUrl = new URL('https://en.wikipedia.org/w/api.php');
  detailsUrl.searchParams.set('action', 'query');
  detailsUrl.searchParams.set('prop', 'extracts|pageimages');
  detailsUrl.searchParams.set('exintro', '1');
  detailsUrl.searchParams.set('explaintext', '1');
  detailsUrl.searchParams.set('piprop', 'thumbnail');
  detailsUrl.searchParams.set('pithumbsize', '320');
  detailsUrl.searchParams.set('titles', pageTitles);
  detailsUrl.searchParams.set('format', 'json');
  detailsUrl.searchParams.set('origin', '*');

  const detailsResponse = await fetch(detailsUrl.toString());
  if (!detailsResponse.ok) {
    throw new Error('Wikipedia player details fetch failed');
  }

  const detailsData = await detailsResponse.json();
  const pages = Object.values(detailsData.query?.pages || {});
  const players = pages
    .map((page) => {
      const summary = (page.extract || '').trim();
      return {
        name: page.title,
        summary: summary || 'No summary available.',
        imageUrl: page.thumbnail?.source || '',
        pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`
      };
    })
    .filter((player) => /premier league/i.test(player.summary));

  if (players.length) {
    return players.slice(0, 6);
  }

  return candidates.slice(0, 6).map((candidate) => ({
    name: candidate.title,
    summary: stripHtml(candidate.snippet) || 'Premier League player listing on Wikipedia.',
    imageUrl: '',
    pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(candidate.title.replace(/ /g, '_'))}`
  }));
}

async function loadScores() {
  refreshButton.disabled = true;

  try {
    const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard');

    if (!response.ok) {
      throw new Error('Failed to fetch live scores');
    }

    const data = await response.json();
    const matches = mapEspnEvents(data.events);
    renderScores(matches.length ? matches : FALLBACK_MATCHES);
  } catch {
    renderScores(FALLBACK_MATCHES);
  } finally {
    updatedLabel.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener('click', loadScores);
loadScores();
setInterval(loadScores, 60000);

playerSearchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  playerSearchButton.disabled = true;
  searchFeedback.textContent = 'Searching Wikipedia…';

  try {
    const players = await searchPremierLeaguePlayers(playerQueryInput.value);
    renderPlayers(players);
  } catch {
    playerResults.replaceChildren();
    searchFeedback.textContent = 'Unable to search Wikipedia right now. Please try again.';
  } finally {
    playerSearchButton.disabled = false;
  }
});
