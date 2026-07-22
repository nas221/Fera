import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(repoRoot, 'script.js'), 'utf8');

const flushPromises = async (times = 5) => {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
};

const makeEvent = ({
  league = 'Premier League',
  homeTeam = 'Arsenal',
  awayTeam = 'Chelsea',
  homeScore = '2',
  awayScore = '1',
  status = "72'"
} = {}) => ({
  leagues: [{ name: league }],
  competitions: [
    {
      competitors: [
        { homeAway: 'home', score: homeScore, team: { shortDisplayName: homeTeam } },
        { homeAway: 'away', score: awayScore, team: { shortDisplayName: awayTeam } }
      ]
    }
  ],
  status: { type: { shortDetail: status } }
});

async function setupPage(fetchImpl) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://127.0.0.1/index.html' });
  const { window } = dom;
  const fetchMock = vi.fn(fetchImpl);
  const intervalMock = vi.fn();

  window.fetch = fetchMock;
  window.setInterval = intervalMock;
  vi.spyOn(window.Date.prototype, 'toLocaleTimeString').mockReturnValue('10:00:00 AM');
  window.eval(script);
  await flushPromises();

  return {
    window,
    document: window.document,
    fetchMock,
    intervalMock,
    close: () => {
      vi.restoreAllMocks();
      window.close();
    }
  };
}

describe('website integration', () => {
  it('renders the main UI and schedules periodic refresh', async () => {
    const page = await setupPage(async () => ({ ok: true, json: async () => ({ events: [makeEvent()] }) }));

    expect(page.document.querySelector('h1')?.textContent).toBe('Football Live Scores');
    expect(page.document.querySelector('#refresh')).not.toBeNull();
    expect(page.document.querySelector('#scores')).not.toBeNull();
    expect(page.document.querySelector('#score-card-template')).not.toBeNull();
    expect(page.intervalMock).toHaveBeenCalledTimes(1);
    expect(page.intervalMock).toHaveBeenCalledWith(expect.any(Function), 60000);

    page.close();
  });

  it('renders live scores returned from the API', async () => {
    const page = await setupPage(async () => ({
      ok: true,
      json: async () =>
        ({
          events: [
            makeEvent({
              league: 'Bundesliga',
              homeTeam: 'Bayern',
              awayTeam: 'Dortmund',
              homeScore: '3',
              awayScore: '2',
              status: "89'"
            })
          ]
        })
    }));

    const card = page.document.querySelector('.score-card');
    expect(card).not.toBeNull();
    expect(card.querySelector('.league')?.textContent).toBe('Bundesliga');
    expect(card.querySelector('.teams')?.textContent).toBe('Bayern vs Dortmund');
    expect(card.querySelector('.score')?.textContent).toBe('3 - 2');
    expect(card.querySelector('.status')?.textContent).toBe("89'");
    expect(page.document.querySelector('#last-updated')?.textContent).toBe('Last updated: 10:00:00 AM');
    expect(page.document.querySelector('#refresh')?.disabled).toBe(false);

    page.close();
  });

  it('uses fallback matches when API response is not successful', async () => {
    const page = await setupPage(async () => ({ ok: false }));
    const cards = page.document.querySelectorAll('.score-card');

    expect(cards).toHaveLength(3);
    expect(cards[0].querySelector('.league')?.textContent).toBe('Premier League');
    expect(cards[1].querySelector('.league')?.textContent).toBe('La Liga');
    expect(cards[2].querySelector('.league')?.textContent).toBe('Serie A');

    page.close();
  });

  it('uses fallback matches when API returns no events', async () => {
    const page = await setupPage(async () => ({ ok: true, json: async () => ({ events: [] }) }));
    const cards = page.document.querySelectorAll('.score-card');

    expect(cards).toHaveLength(3);
    expect(page.document.querySelector('.teams')?.textContent).toBe('Arsenal vs Chelsea');

    page.close();
  });

  it('disables the refresh button while loading and refreshes scores on click', async () => {
    let resolveResponse;
    const pendingResponse = new Promise((resolve) => {
      resolveResponse = resolve;
    });
    let requestCount = 0;
    const page = await setupPage(async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return pendingResponse;
      }

      return {
        ok: true,
        json: async () =>
          ({
            events: [makeEvent({ homeTeam: 'Inter', awayTeam: 'Milan', homeScore: '1', awayScore: '0' })]
          })
      };
    });

    const refreshButton = page.document.querySelector('#refresh');
    expect(refreshButton.disabled).toBe(true);

    resolveResponse({
      ok: true,
      json: async () =>
        ({
          events: [makeEvent({ homeTeam: 'Liverpool', awayTeam: 'Everton', homeScore: '2', awayScore: '0' })]
        })
    });
    await flushPromises();

    expect(refreshButton.disabled).toBe(false);
    expect(page.document.querySelector('.teams')?.textContent).toBe('Liverpool vs Everton');

    refreshButton.click();
    await flushPromises();

    expect(page.fetchMock).toHaveBeenCalledTimes(2);
    expect(page.document.querySelector('.teams')?.textContent).toBe('Inter vs Milan');

    page.close();
  });
});
