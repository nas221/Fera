const scoresContainer = document.getElementById('scores');
const updatedLabel = document.getElementById('last-updated');
const refreshButton = document.getElementById('refresh');
const cardTemplate = document.getElementById('score-card-template');

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

function getStatusType(statusText) {
  const text = String(statusText || '').toUpperCase();

  if (text.includes('FT') || text.includes('AET') || text.includes('PEN')) {
    return 'finished';
  }

  if (text.includes('HT')) {
    return 'half';
  }

  if (text.includes("'") || text.includes('LIVE')) {
    return 'live';
  }

  return 'upcoming';
}

function renderScores(matches) {
  scoresContainer.replaceChildren();
  scoresContainer.removeAttribute('aria-busy');

  if (!matches.length) {
    scoresContainer.textContent = 'No live matches right now.';
    return;
  }

  matches.forEach((match) => {
    const fragment = cardTemplate.content.cloneNode(true);
    fragment.querySelector('.league').textContent = match.league;
    fragment.querySelector('.teams').textContent = `${match.homeTeam} vs ${match.awayTeam}`;
    fragment.querySelector('.score').textContent = `${match.homeScore} - ${match.awayScore}`;
    const statusElement = fragment.querySelector('.status');
    const statusType = getStatusType(match.status);
    statusElement.textContent = match.status;
    statusElement.classList.add(`status-${statusType}`);
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
  refreshButton.disabled = true;
  scoresContainer.setAttribute('aria-busy', 'true');
  updatedLabel.textContent = 'Updating live scores…';

  try {
    const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard');

    if (!response.ok) {
      throw new Error('Failed to fetch live scores');
    }

    const data = await response.json();
    const matches = mapEspnEvents(data.events);
    renderScores(matches.length ? matches : FALLBACK_MATCHES);
    updatedLabel.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
  } catch {
    renderScores(FALLBACK_MATCHES);
    updatedLabel.textContent = `Showing sample scores · Updated: ${new Date().toLocaleTimeString()}`;
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener('click', loadScores);
loadScores();
setInterval(loadScores, 60000);
