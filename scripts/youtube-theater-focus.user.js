// ==UserScript==
// @name         Youtube Theater Focus
// @namespace    https://github.com/TheRoccoB/userscripts
// @version      1.0.0
// @description  Theater mode shows only the video; turns off autoplay-next and hides end-screen cards
// @author       Rocco Balsamo
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/TheRoccoB/userscripts/main/scripts/youtube-theater-focus.user.js
// @downloadURL  https://raw.githubusercontent.com/TheRoccoB/userscripts/main/scripts/youtube-theater-focus.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ---------- Theater mode: video only ----------

    // ytd-watch-flexy stays in the DOM (hidden) after leaving a watch page, so check :not([hidden]).
    const THEATER = 'ytd-watch-flexy[theater]:not([hidden])';

    const style = document.createElement('style');
    style.id = 'ytf-style';
    style.textContent = `
        html:has(${THEATER}) #masthead-container,
        ${THEATER} #columns {
            display: none !important;
        }
        html:has(${THEATER}) #page-manager {
            margin-top: 0 !important;
        }
        html:has(${THEATER}),
        html:has(${THEATER}) body {
            overflow: hidden !important;
        }
        ${THEATER} #full-bleed-container {
            height: 100vh !important;
            max-height: 100vh !important;
        }

        /* End-screen cards (creator's videos/channel/playlist) and the end-of-video suggestion wall. */
        .ytp-ce-element,
        .html5-endscreen {
            display: none !important;
        }
    `;
    document.head.appendChild(style);

    // The player only re-measures on window resize, so nudge it when theater toggles.
    function nudgePlayer() {
        requestAnimationFrame(() => {
            window.dispatchEvent(new Event('resize'));
        });
    }

    const theaterObserver = new MutationObserver(nudgePlayer);
    theaterObserver.observe(document.documentElement, {
        subtree: true,
        attributes: true,
        attributeFilter: ['theater', 'hidden'],
    });
    // The page may already be in theater mode when the script loads.
    nudgePlayer();

    // ---------- Autoplay next: off ----------

    function ensureAutoplayOff() {
        const toggle = document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]');
        if (toggle) {
            toggle.click();
        }
    }

    // 'play' doesn't bubble, so listen in the capture phase. Covers SPA navigations and new players.
    document.addEventListener('play', ensureAutoplayOff, true);
    document.addEventListener('yt-navigate-finish', ensureAutoplayOff);
    ensureAutoplayOff();
})();
