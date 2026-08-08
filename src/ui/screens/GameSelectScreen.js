import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';
import { GAME_REGISTRY } from '../../data/gameRegistry.js';
import gameManager from '../../core/GameManager.js';
import i18n from '../../core/I18nManager.js';

/**
 * GameSelectScreen.js  --  the "Intermediate Menu"
 * -----------------------------------------------------------------
 * Fully data-driven: this file knows nothing about any individual
 * game's rules, art style, or mechanics -- only the registry entries
 * (id, title, card art, high score). Adding a 10th game never touches
 * this file; it only touches gameRegistry.js.
 *
 * Decoupling in practice: clicking a card does not call into
 * GameManager directly. It emits EVENTS.NAV_LOAD_GAME on the shared
 * bus. GameManager happens to be listening, but this file doesn't
 * know or care that it is -- swap GameManager out entirely and this
 * screen doesn't need a single line changed.
 * -----------------------------------------------------------------
 */
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
      // card badges ("BEST ###") are language-dependent text too
      if (!this.element.classList.contains('hidden')) this.onShow();
    });

    return section;
  }

  _applyTranslations() {
    this._backBtn.textContent = i18n.t('menu');
    this._heading.textContent = i18n.t('selectModule');
  }

  /** Called by UIManager whenever this screen becomes visible -- refresh
   *  high scores in case a run just finished. */
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
    // If a card art URL 404s or is unreachable, fail visibly instead of
    // showing a broken-image icon inside a premium 3D card.
    art.addEventListener('error', () => card.classList.add('game-card--art-error'), { once: true });

    // No visible text label under the art per spec -- aria-label above
    // covers accessibility without adding a rendered label element.
    card.appendChild(art);

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
