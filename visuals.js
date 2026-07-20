/* Card Vault — gift visuals: bundled logos + MLB portraits + free photo warm-up
   Friend-ready: no GitHub tokens, no billed catalog spam. */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  const TEAM_FILES = {
    LAA: 'LAA', ARI: 'ARI', BAL: 'BAL', BOS: 'BOS', CHC: 'CHC', CIN: 'CIN', CLE: 'CLE',
    COL: 'COL', DET: 'DET', HOU: 'HOU', KC: 'KC', KCR: 'KC', LAD: 'LAD', WSH: 'WSH', WAS: 'WSH',
    WSN: 'WSH', NYM: 'NYM', OAK: 'OAK', ATH: 'OAK', PIT: 'PIT', SD: 'SD', SDP: 'SD', SEA: 'SEA',
    SF: 'SF', SFG: 'SF', STL: 'STL', TB: 'TB', TBR: 'TB', TEX: 'TEX', TOR: 'TOR', MIN: 'MIN',
    PHI: 'PHI', ATL: 'ATL', CWS: 'CWS', CHW: 'CWS', MIA: 'MIA', FLA: 'MIA', NYY: 'NYY', MIL: 'MIL'
  };

  const TEAM_ALIASES = {
    angels: 'LAA', 'los angeles angels': 'LAA', 'la angels': 'LAA', anaheim: 'LAA',
    diamondbacks: 'ARI', 'd-backs': 'ARI', dbacks: 'ARI', arizona: 'ARI',
    orioles: 'BAL', baltimore: 'BAL',
    'red sox': 'BOS', redsox: 'BOS', boston: 'BOS',
    cubs: 'CHC', 'chicago cubs': 'CHC',
    reds: 'CIN', cincinnati: 'CIN',
    guardians: 'CLE', indians: 'CLE', cleveland: 'CLE',
    rockies: 'COL', colorado: 'COL',
    tigers: 'DET', detroit: 'DET',
    astros: 'HOU', houston: 'HOU',
    royals: 'KC', 'kansas city': 'KC',
    dodgers: 'LAD', 'los angeles dodgers': 'LAD', 'la dodgers': 'LAD',
    nationals: 'WSH', washington: 'WSH',
    mets: 'NYM', 'new york mets': 'NYM',
    athletics: 'OAK', "a's": 'OAK', oakland: 'OAK',
    pirates: 'PIT', pittsburgh: 'PIT',
    padres: 'SD', 'san diego': 'SD',
    mariners: 'SEA', seattle: 'SEA',
    giants: 'SF', 'san francisco': 'SF',
    cardinals: 'STL', 'st. louis': 'STL', 'st louis': 'STL',
    rays: 'TB', 'tampa bay': 'TB', 'devil rays': 'TB',
    rangers: 'TEX', texas: 'TEX',
    'blue jays': 'TOR', bluejays: 'TOR', toronto: 'TOR',
    twins: 'MIN', minnesota: 'MIN',
    phillies: 'PHI', philadelphia: 'PHI',
    braves: 'ATL', atlanta: 'ATL',
    'white sox': 'CWS', whitesox: 'CWS', 'chicago white sox': 'CWS',
    marlins: 'MIA', miami: 'MIA', florida: 'MIA',
    yankees: 'NYY', 'new york yankees': 'NYY', 'ny yankees': 'NYY',
    brewers: 'MIL', milwaukee: 'MIL'
  };

  const BRAND_FILES = [
    { file: 'topps', re: /\btopps\b|stadium club|allen\s*&\s*ginter|gypsy queen|heritage/i },
    { file: 'bowman', re: /\bbowman\b/i },
    { file: 'panini', re: /\bpanini\b|\bprizm\b|\bdonruss\b|\boptic\b|\bchronicles\b|\bmosaic\b|\bselect\b/i },
    { file: 'upperdeck', re: /\bupper\s*deck\b|\bsp authentic\b/i },
    { file: 'fleer', re: /\bfleer\b/i }
  ];

  const TEAM_ORDER = [
    'NYY', 'BOS', 'LAD', 'CHC', 'ATL', 'HOU', 'PHI', 'NYM', 'SF', 'STL',
    'SEA', 'SD', 'TOR', 'TEX', 'MIN', 'CLE', 'DET', 'CWS', 'MIL', 'MIA',
    'TB', 'BAL', 'WSH', 'CIN', 'PIT', 'COL', 'ARI', 'KC', 'LAA', 'OAK'
  ];

  const TEAM_NAMES = {
    NYY: 'Yankees', BOS: 'Red Sox', LAD: 'Dodgers', CHC: 'Cubs', ATL: 'Braves',
    HOU: 'Astros', PHI: 'Phillies', NYM: 'Mets', SF: 'Giants', STL: 'Cardinals',
    SEA: 'Mariners', SD: 'Padres', TOR: 'Blue Jays', TEX: 'Rangers', MIN: 'Twins',
    CLE: 'Guardians', DET: 'Tigers', CWS: 'White Sox', MIL: 'Brewers', MIA: 'Marlins',
    TB: 'Rays', BAL: 'Orioles', WSH: 'Nationals', CIN: 'Reds', PIT: 'Pirates',
    COL: 'Rockies', ARI: 'Diamondbacks', KC: 'Royals', LAA: 'Angels', OAK: 'Athletics'
  };

  function asset(path) {
    try {
      return new URL(path, document.baseURI || location.href).href;
    } catch (e) {
      return path;
    }
  }

  function preloadUrl(url) {
    return new Promise((resolve) => {
      if (!url) return resolve(false);
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.decoding = 'async';
      img.src = url;
    });
  }

  window.teamAbbr = function teamAbbr(team) {
    const raw = String(team || '').trim();
    if (!raw) return '';
    const up = raw.toUpperCase().replace(/[^A-Z]/g, '');
    if (TEAM_FILES[up]) return TEAM_FILES[up];
    const key = raw.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
    if (TEAM_ALIASES[key]) return TEAM_ALIASES[key];
    for (const [alias, abbr] of Object.entries(TEAM_ALIASES)) {
      if (key.includes(alias)) return abbr;
    }
    return '';
  };

  window.teamLogoUrl = function teamLogoUrl(team) {
    const abbr = teamAbbr(team);
    return abbr ? asset('assets/teams/' + abbr + '.svg') : '';
  };

  window.brandLogoUrl = function brandLogoUrl(brandOrSet) {
    const s = String(brandOrSet || '');
    if (!s) return '';
    for (const b of BRAND_FILES) {
      if (b.re.test(s)) return asset('assets/brands/' + b.file + '.svg');
    }
    return '';
  };

  /** Official MLB headshot CDN — instant portrait when card scan photo isn’t cached yet. */
  window.mlbPortraitUrl = function mlbPortraitUrl(cOrName, size) {
    const w = size || 180;
    let mlbId = null;
    if (cOrName && typeof cOrName === 'object') {
      mlbId = cOrName.mlbId || (cOrName.mlb && cOrName.mlb.mlbId);
      if (!mlbId && typeof mlbLookupCached === 'function') {
        try {
          const hit = mlbLookupCached(cOrName);
          if (hit && hit.mlbId) mlbId = hit.mlbId;
        } catch (e) {}
      }
      if (!mlbId && typeof MLB_CAREER !== 'undefined' && MLB_CAREER.byName) {
        const id = MLB_CAREER.byName[String(cOrName.player || '').trim().toLowerCase()];
        if (id) mlbId = id;
      }
    } else if (typeof MLB_CAREER !== 'undefined' && MLB_CAREER.byName) {
      const id = MLB_CAREER.byName[String(cOrName || '').trim().toLowerCase()];
      if (id) mlbId = id;
    }
    if (!mlbId) return '';
    return 'https://img.mlbstatic.com/mlb-photos/image/upload/w_' + w + ',q_auto:best/v1/people/' +
      encodeURIComponent(mlbId) + '/headshot/67/current';
  };

  window.teamBadgeHtml = function teamBadgeHtml(team) {
    const url = teamLogoUrl(team);
    if (!url) return '';
    return '<img class="teamBadge" src="' + url + '" alt="" loading="lazy" decoding="async">';
  };

  window.brandMarkHtml = function brandMarkHtml(brand, setName) {
    const url = brandLogoUrl(brand) || brandLogoUrl(setName);
    if (!url) return '';
    return '<img class="brandMark" src="' + url + '" alt="" loading="lazy" decoding="async">';
  };

  window.cardThumb = function cardThumb(c, kind) {
    const cls = kind === 'gimg' ? 'gimg' : 'thumb';
    const icon = typeof sportIcon === 'function' ? sportIcon(c && c.sport) : '🃏';
    const badge = teamBadgeHtml(c && c.team);
    return '<div class="' + cls + '" id="im-' + c.id + '">' + icon + badge + '</div>';
  };

  window.cardMetaLine = function cardMetaLine(c, parts) {
    const mark = brandMarkHtml(c && c.brand, c && c.setName);
    const text = (parts || []).filter(Boolean).join(' · ');
    const safe = typeof esc === 'function' ? esc(text) : text;
    return mark + '<span class="metaTxt">' + safe + '</span>';
  };

  window.mlbLogoStripHtml = function mlbLogoStripHtml() {
    return '<div class="logoStrip" aria-label="MLB team logos">' +
      TEAM_ORDER.map((abbr) => {
        const url = asset('assets/teams/' + abbr + '.svg');
        return '<button type="button" class="logoChip" data-team-abbr="' + abbr + '" title="' +
          (TEAM_NAMES[abbr] || abbr) + '"><img src="' + url + '" alt="' + abbr +
          '" loading="lazy" decoding="async"></button>';
      }).join('') +
      '</div>';
  };

  window.wireLogoStrip = function wireLogoStrip(root) {
    (root || document).querySelectorAll('.logoChip[data-team-abbr]').forEach((btn) => {
      btn.onclick = () => {
        const abbr = btn.getAttribute('data-team-abbr');
        const qEl = typeof $ === 'function' ? $('q') : null;
        if (qEl) {
          qEl.classList.remove('isHidden');
          qEl.value = TEAM_NAMES[abbr] || abbr;
          if (typeof q !== 'undefined') q = qEl.value;
        }
        if (typeof tab !== 'undefined') tab = 'have';
        if (typeof render === 'function') render();
        if (typeof showToast === 'function') showToast((TEAM_NAMES[abbr] || abbr) + ' · filter');
      };
    });
  };

  async function preloadBundledLogos() {
    const urls = TEAM_ORDER.map((a) => asset('assets/teams/' + a + '.svg'))
      .concat(['topps', 'bowman', 'panini', 'upperdeck', 'fleer', 'mlb']
        .map((b) => asset('assets/brands/' + b + '.svg')));
    let n = 0;
    for (let i = 0; i < urls.length; i += 8) {
      const slice = urls.slice(i, i + 8);
      const ok = await Promise.all(slice.map(preloadUrl));
      n += ok.filter(Boolean).length;
    }
    return n;
  }

  async function preloadVaultPortraits() {
    if (!state || !Array.isArray(state.cards)) return 0;
    if (typeof loadMlbCareerJson === 'function' && !(MLB_CAREER && MLB_CAREER.loaded)) {
      try { await loadMlbCareerJson(); } catch (e) {}
    }
    const cards = state.cards.filter((c) => c.status !== 'sold').slice(0, 60);
    let n = 0;
    for (const c of cards) {
      const url = mlbPortraitUrl(c, 120);
      if (url && await preloadUrl(url)) n++;
    }
    return n;
  }

  /**
   * After thumbs fail to get a CardSight card image, paint MLB portrait + keep team badge.
   */
  window.applyPortraitFallback = function applyPortraitFallback(el, c) {
    if (!el || !c) return false;
    if (el.querySelector('img.cardPhoto')) return false;
    const url = mlbPortraitUrl(c, 180);
    if (!url) return false;
    const img = document.createElement('img');
    img.className = 'cardPhoto portraitFallback';
    img.alt = '';
    img.decoding = 'async';
    img.src = url;
    el.classList.remove('imgMiss');
    el.classList.add('hasPortrait');
    /* keep team badge if present */
    const badge = el.querySelector('.teamBadge');
    el.innerHTML = '';
    el.appendChild(img);
    if (badge) el.appendChild(badge);
    else if (c.team) {
      const b = document.createElement('div');
      b.innerHTML = teamBadgeHtml(c.team);
      if (b.firstChild) el.appendChild(b.firstChild);
    }
    return true;
  };

  window.warmGiftVisuals = async function warmGiftVisuals() {
    try {
      await preloadBundledLogos();
    } catch (e) {}

    try {
      if (typeof fillMissingPhotos === 'function' && state && state.cards && state.cards.length) {
        const need = state.cards.filter((c) => c.status !== 'sold' && c.csId && !c.imgId && !c.imgUrl);
        if (need.length) await fillMissingPhotos({ concurrency: 5, max: 80, silent: true });
      }
    } catch (e) {}

    try {
      await preloadVaultPortraits();
    } catch (e) {}

    /* Re-paint any still-empty thumbs with portraits */
    try {
      if (state && state.cards) {
        for (const c of state.cards) {
          const el = typeof $ === 'function' ? $('im-' + c.id) : null;
          if (el && !el.querySelector('img.cardPhoto') && !el.querySelector('img:not(.teamBadge)')) {
            applyPortraitFallback(el, c);
          }
        }
      }
    } catch (e) {}
  };
})();
