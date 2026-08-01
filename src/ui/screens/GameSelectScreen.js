import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';
import { GAME_REGISTRY } from '../../data/gameRegistry.js';
import gameManager from '../../core/GameManager.js';
import i18n from '../../core/I18nManager.js';

export class GameSelectScreen {
  constructor() {
    this.element = null;
    this._grid = null;
  }

  render() {
    const section = document.createElement('section');
    section.className = 'screen game-select-screen';

    this._backBtn = document.createElement('button');
    this._backBtn.className = 'crystal-btn back-btn';
    this._backBtn.type = 'button';
    this._backBtn.addEventListener('click', () => {
      bus.emit(EVENTS.UI_CLICK);
      bus.emit(EVENTS.NAV_SHOW_MAIN_MENU);
    });

    this._heading = document.createElement('h2');
    this._heading.className = 'screen-title';

    const grid = document.createElement('div');
    grid.className = 'game-grid';
    this._grid = grid;

    section.append(this._backBtn, this._heading, grid);
    this.element = section;

    this._applyTranslations();
    bus.on(EVENTS.LANGUAGE_CHANGED, () => {
      this._applyTranslations();
      if (!this.element.classList.contains('hidden')) this.onShow();
    });

    return section;
  }

  _applyTranslations() {
    this._backBtn.textContent = i18n.t('menu');
    this._heading.textContent = i18n.t('selectModule');
  }

  onShow() {
    this._grid.replaceChildren(
      ...GAME_REGISTRY.map((entry) => this._buildCard(entry))
    );
  }

  _buildCard(entry) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'game-card' + (entry.comingSoon ? ' game-card--soon' : '');
    card.disabled = !!entry.comingSoon;
    card.setAttribute('aria-label', entry.title);

    const art = document.createElement('img');
    art.className = 'game-card-art';
    art.src = entry.cardArt;
    art.alt = entry.title;
    art.loading = 'lazy';
    art.addEventListener('error', () => {
      art.style.display = 'none';
    }, { once: true });

    const info = document.createElement('div');
    info.className = 'game-card-info';

    const title = document.createElement('span');
    title.className = 'game-card-title';
    title.textContent = entry.title;

    const sub = document.createElement('span');
    sub.className = 'game-card-sub';
    sub.textContent = entry.comingSoon ? 'Coming Soon' : 'Tap to Play';

    info.append(title, sub);
    card.append(art, info);

    if (!entry.comingSoon) {
      const best = gameManager.getHighScore(entry.id);
      if (best > 0) {
        const hs = document.createElement('span');
        hs.className = 'game-card-highscore';
        hs.textContent = `${i18n.t('best')} ${best}`;
        card.appendChild(hs);
      }

      card.addEventListener('click', () => {
        bus.emit(EVENTS.UI_CLICK);
        bus.emit(EVENTS.NAV_LOAD_GAME, entry.id);
      });
    }

    return card;
  }
}
