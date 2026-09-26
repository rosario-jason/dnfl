/* ==========================================================================
   DNFL UI Enhancements & Native MFL Overrides Module
   Duke Networking Fantasy League (DNFL) - Framework
   Target Architecture: Decoupled UI Enhancements, Dynamic Login/Commish Menu,
                       Mobile Navigation Drawer Toggle & UI Overrides
   ========================================================================== */
(function (window, document) {
    'use strict';

    window.DNFL = window.DNFL || {};
    window.DNFL.UI = window.DNFL.UI || {};
    window.DNFL.Utils = window.DNFL.Utils || {};

    const tag = '[DNFL UI Enhancements]';

    /**
     * DOM MutationObserver Helper
     * Executes callback as soon as selector renders in the DOM.
     */
    if (!window.DNFL.Utils.onElementReady) {
        window.DNFL.Utils.onElementReady = function (selector, callback) {
            if (!selector || typeof callback !== 'function') return;

            const check = () => {
                const el = document.querySelector(selector);
                if (el) {
                    callback(el);
                    return true;
                }
                return false;
            };

            if (check()) return;

            const observer = new MutationObserver((_, obs) => {
                if (check()) obs.disconnect();
            });

            observer.observe(document.body || document.documentElement, {
                childList: true,
                subtree: true
            });
        };
    }

    /**
     * Dynamic Login & Franchise / Commissioner Dropdown Menu Injector
     */
    window.DNFL.UI.initLoginMenu = function () {
        window.DNFL.Utils.onElementReady('.myfantasyleague_menu > ul', (menuUl) => {
            if (document.querySelector('#dnfl-login-item')) return;

            // Detect MFL Login & Commish Session Flags
            const isMFL = typeof MFL !== 'undefined';
            const isLoggedIn = (isMFL && (MFL.isLoggedIn || MFL.franchiseId)) || document.cookie.includes('MFL_USER_ID');
            const isCommish = (isMFL && (MFL.isCommish || MFL.franchiseId === '0000')) || document.cookie.includes('MFL_COMMISH=1');

            const loginLi = document.createElement('li');
            loginLi.id = 'dnfl-login-item';
            loginLi.className = 'dnfl-menu-right';

            if (!isLoggedIn) {
                // Logged Out / Guest State
                loginLi.innerHTML = `
                    <a href="?MODULE=LOGIN" class="dnfl-login-link">
                        <i class="fa-solid fa-right-to-bracket"></i> Login
                    </a>
                `;
            } else {
                // Logged In Owner / Commissioner State
                const mainLabel = isCommish ? 'Commissioner' : 'My Franchise';
                let subMenuHtml = `
                    <ul>
                        <li><a href="?MODULE=ROSTER"><i class="fa-solid fa-users"></i> My Roster</a></li>
                        <li><a href="?MODULE=LINEUP"><i class="fa-solid fa-list-check"></i> Submit Lineup</a></li>
                        <li><a href="?MODULE=TRADES"><i class="fa-solid fa-handshake"></i> Trades & Offers</a></li>
                `;

                if (isCommish) {
                    subMenuHtml += `
                        <li class="dnfl-menu-divider"></li>
                        <li><a href="?MODULE=COMMISH"><i class="fa-solid fa-sliders"></i> Commish Setup</a></li>
                        <li><a href="?MODULE=COMMISH_MODE&ACTION=COMMISH"><i class="fa-solid fa-user-shield"></i> Become Commish</a></li>
                        <li><a href="?MODULE=COMMISH_MODE&ACTION=OWNER"><i class="fa-solid fa-user"></i> Become Owner</a></li>
                    `;
                }

                subMenuHtml += `
                        <li class="dnfl-menu-divider"></li>
                        <li><a href="?MODULE=LOGOUT"><i class="fa-solid fa-right-from-bracket"></i> Logout</a></li>
                    </ul>
                `;

                loginLi.innerHTML = `
                    <a href="?MODULE=WELCOME" class="dnfl-user-menu-trigger">
                        <i class="fa-solid fa-user-gear"></i> ${mainLabel} <i class="fa-solid fa-caret-down" style="font-size: 0.75em; margin-left: 3px;"></i>
                    </a>
                    ${subMenuHtml}
                `;
            }

            menuUl.appendChild(loginLi);
            console.log(`${tag} Native Login/Franchise menu initialized successfully.`);
        });
    };

    /**
     * Mobile Navigation Drawer Toggle Handler
     */
    window.DNFL.UI.initMobileDrawer = function () {
        window.DNFL.Utils.onElementReady('#menu-trigger, .myfantasyleague_menuMobile', (trigger) => {
            if (trigger.dataset.dnflBound) return;
            trigger.dataset.dnflBound = 'true';

            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                const targetNav = document.querySelector('.myfantasyleague_menu, #myNavigationHolder');
                if (targetNav) {
                    targetNav.classList.toggle('dnfl-mobile-active');
                    trigger.classList.toggle('is-active');
                }
            });
            console.log(`${tag} Mobile drawer toggle event listeners attached.`);
        });
    };

    /**
     * Initialize All UI Enhancements
     */
    function initUI() {
        console.log(`${tag} Initializing UI Enhancements Module...`);
        window.DNFL.UI.initLoginMenu();
        window.DNFL.UI.initMobileDrawer();
    }

    // Auto-Run on Module Load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }

})(window, document);
