// ==UserScript==
// @name         React Bootcamp fixes
// @namespace    https://www.reactbootcamp.com/
// @version      1.1.0
// @description  Sticky failure toasts, Ctrl/Cmd+Enter to submit, and a toggle to pause the live preview while typing
// @author       Rocco Balsamo
// @match        https://www.reactbootcamp.com/learn/*
// @match        https://reactbootcamp.com/learn/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/TheRoccoB/userscripts/main/scripts/reactbootcamp-fixes.user.js
// @downloadURL  https://raw.githubusercontent.com/TheRoccoB/userscripts/main/scripts/reactbootcamp-fixes.user.js
// ==/UserScript==

(function () {
    'use strict';

    // How long the sticky copy stays up. 0 = until dismissed.
    const STICKY_MS = 0;
    const FAIL_PATTERN = /incorrect|not quite|try again|wrong|fail/i;
    const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
    const MOD = IS_MAC ? 'Cmd' : 'Ctrl';
    const ALT = IS_MAC ? 'Option' : 'Alt';
    const SUBMIT_HINT = `Submit answer (${MOD}+Enter)`;
    const TOGGLE_HINT = `Toggle auto-refresh of the preview (${ALT}+R)`;
    const REFRESH_HINT = `Refresh the preview now (${MOD}+S)`;
    const AUTO_KEY = 'rb-autorefresh';

    // ---------- Submit shortcut ----------

    function findSubmitButton() {
        const buttons = document.querySelectorAll('button');
        for (const b of buttons) {
            if (/submit answer/i.test(b.textContent)) {
                return b;
            }
        }
        return null;
    }

    // Disabled buttons don't get hover events, so put the tooltip on the wrapper too.
    function labelSubmitButton() {
        const btn = findSubmitButton();
        if (!btn) {
            return;
        }
        if (btn.title !== SUBMIT_HINT) {
            btn.title = SUBMIT_HINT;
        }
        const wrap = btn.parentElement;
        if (wrap && wrap.title !== SUBMIT_HINT) {
            wrap.title = SUBMIT_HINT;
        }
    }

    // Capture phase on window so it runs before Monaco eats Ctrl/Cmd+Enter.
    window.addEventListener('keydown', (e) => {
        const isEnter = e.key === 'Enter';
        const isMod = e.ctrlKey || e.metaKey;
        if (!isEnter || !isMod || e.shiftKey || e.altKey) {
            return;
        }
        const btn = findSubmitButton();
        if (!btn) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (btn.disabled) {
            flashButton(btn);
            return;
        }
        btn.click();
    }, true);

    function flashButton(btn) {
        const old = btn.style.outline;
        btn.style.outline = '2px solid #e5484d';
        setTimeout(() => {
            btn.style.outline = old;
        }, 400);
    }

    // ---------- Preview auto-refresh toggle ----------

    // The site recompiles ~280ms after each edit, then reloads the preview
    // iframe by setting its src and posting the html from its onload. We
    // shadow src/onload on that iframe so a paused preview keeps the latest
    // pending update and applies it on demand.
    const srcDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    const onloadDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'onload');

    let autoRefresh = readAutoRefresh();
    let previewFrame = null;
    let pending = null;

    function readAutoRefresh() {
        try {
            return localStorage.getItem(AUTO_KEY) !== 'off';
        } catch (err) {
            return true;
        }
    }

    function saveAutoRefresh() {
        try {
            localStorage.setItem(AUTO_KEY, autoRefresh ? 'on' : 'off');
        } catch (err) {
            // Storage blocked; the setting just won't persist.
        }
    }

    function patchPreview(frame) {
        if (frame.rbPatched) {
            return;
        }
        frame.rbPatched = true;
        previewFrame = frame;
        // Let the first render through even when paused, so the pane isn't blank.
        let rendered = Boolean(srcDesc.get.call(frame));

        Object.defineProperty(frame, 'src', {
            configurable: true,
            get() {
                return srcDesc.get.call(frame);
            },
            set(value) {
                if (autoRefresh || !rendered) {
                    rendered = true;
                    pending = null;
                    srcDesc.set.call(frame, value);
                    return;
                }
                pending = pending || {};
                pending.src = value;
                updateControls();
            },
        });

        Object.defineProperty(frame, 'onload', {
            configurable: true,
            get() {
                return onloadDesc.get.call(frame);
            },
            set(handler) {
                if (pending) {
                    pending.onload = handler;
                    return;
                }
                onloadDesc.set.call(frame, handler);
            },
        });
    }

    function refreshPreview() {
        if (!previewFrame || !pending) {
            return;
        }
        const p = pending;
        pending = null;
        if (p.onload) {
            onloadDesc.set.call(previewFrame, p.onload);
        }
        srcDesc.set.call(previewFrame, p.src);
        updateControls();
    }

    function setAutoRefresh(on) {
        autoRefresh = on;
        saveAutoRefresh();
        if (on) {
            refreshPreview();
        }
        updateControls();
    }

    function ensureControls() {
        if (!previewFrame || !previewFrame.parentElement) {
            return;
        }
        const host = previewFrame.parentElement;
        if (host.querySelector('#rb-preview-controls')) {
            return;
        }
        if (getComputedStyle(host).position === 'static') {
            host.style.position = 'relative';
        }

        const bar = document.createElement('div');
        bar.id = 'rb-preview-controls';

        const toggle = document.createElement('button');
        toggle.id = 'rb-autorefresh-toggle';
        toggle.type = 'button';
        toggle.title = TOGGLE_HINT;
        toggle.addEventListener('click', () => {
            setAutoRefresh(!autoRefresh);
        });

        const refresh = document.createElement('button');
        refresh.id = 'rb-refresh';
        refresh.type = 'button';
        refresh.title = REFRESH_HINT;
        refresh.textContent = '⟳ Refresh';
        refresh.addEventListener('click', () => {
            refreshPreview();
        });

        bar.append(toggle, refresh);
        host.appendChild(bar);
        updateControls();
    }

    function updateControls() {
        const toggle = document.getElementById('rb-autorefresh-toggle');
        const refresh = document.getElementById('rb-refresh');
        if (!toggle || !refresh) {
            return;
        }
        toggle.textContent = autoRefresh ? 'Auto-refresh: on' : 'Auto-refresh: off';
        toggle.classList.toggle('rb-off', !autoRefresh);
        refresh.hidden = autoRefresh;
        refresh.classList.toggle('rb-pending', pending !== null);
    }

    function scanPage() {
        const frame = document.querySelector('iframe[title="preview"]');
        if (frame && frame !== previewFrame) {
            patchPreview(frame);
        }
        ensureControls();
        labelSubmitButton();
    }

    // Capture phase so these beat Monaco and the browser's Save dialog.
    window.addEventListener('keydown', (e) => {
        const isMod = e.ctrlKey || e.metaKey;
        if (e.altKey && !isMod && !e.shiftKey && e.code === 'KeyR') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            setAutoRefresh(!autoRefresh);
            return;
        }
        if (isMod && !e.altKey && !e.shiftKey && e.code === 'KeyS') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            refreshPreview();
        }
    }, true);

    // ---------- Sticky failure toast ----------

    const style = document.createElement('style');
    style.textContent = `
        #rb-sticky-toasts {
            position: fixed;
            bottom: 16px;
            left: 16px;
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-width: min(480px, calc(100vw - 32px));
            font: 14px/1.4 system-ui, sans-serif;
        }
        .rb-sticky-toast {
            background: #2a1215;
            color: #ffd8d8;
            border: 1px solid #e5484d;
            border-radius: 8px;
            padding: 10px 36px 10px 12px;
            position: relative;
            white-space: pre-wrap;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        #rb-preview-controls {
            position: absolute;
            top: 8px;
            right: 20px;
            z-index: 10;
            display: flex;
            gap: 6px;
            font: 12px/1 system-ui, sans-serif;
        }
        #rb-preview-controls button {
            background: rgba(20, 20, 20, 0.85);
            color: #e6e6e6;
            border: 1px solid #555;
            border-radius: 6px;
            padding: 5px 8px;
            cursor: pointer;
            font: inherit;
        }
        #rb-preview-controls button:hover {
            border-color: #999;
        }
        #rb-preview-controls button[hidden] {
            display: none;
        }
        #rb-autorefresh-toggle.rb-off {
            color: #ffb224;
            border-color: #ffb224;
        }
        #rb-refresh.rb-pending {
            background: #0b3d91;
            border-color: #5b9bff;
            color: #fff;
        }
        .rb-sticky-toast button {
            position: absolute;
            top: 6px;
            right: 8px;
            background: none;
            border: none;
            color: inherit;
            font-size: 16px;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);

    function getContainer() {
        let c = document.getElementById('rb-sticky-toasts');
        if (!c) {
            c = document.createElement('div');
            c.id = 'rb-sticky-toasts';
            document.body.appendChild(c);
        }
        return c;
    }

    function clearSticky() {
        const c = document.getElementById('rb-sticky-toasts');
        if (c) {
            c.replaceChildren();
        }
    }

    function showSticky(text) {
        const c = getContainer();
        // Only keep the latest failure.
        c.replaceChildren();

        const el = document.createElement('div');
        el.className = 'rb-sticky-toast';
        el.textContent = text;

        const close = document.createElement('button');
        close.textContent = '×';
        close.title = 'Dismiss (Esc)';
        close.addEventListener('click', () => {
            el.remove();
        });
        el.appendChild(close);

        c.appendChild(el);

        if (STICKY_MS > 0) {
            setTimeout(() => {
                el.remove();
            }, STICKY_MS);
        }
    }

    function isFailureToast(node) {
        const type = node.getAttribute('data-type');
        if (type === 'error' || type === 'warning') {
            return true;
        }
        return FAIL_PATTERN.test(node.textContent || '');
    }

    function toastText(node) {
        const title = node.querySelector('[data-title]');
        const desc = node.querySelector('[data-description]');
        const parts = [];
        if (title) {
            parts.push(title.innerText.trim());
        }
        if (desc) {
            parts.push(desc.innerText.trim());
        }
        if (parts.length === 0) {
            parts.push(node.innerText.trim());
        }
        return parts.join('\n');
    }

    const seen = new WeakSet();

    function handleToast(node) {
        if (seen.has(node)) {
            return;
        }
        seen.add(node);
        // Let sonner render its content first.
        requestAnimationFrame(() => {
            if (isFailureToast(node)) {
                showSticky(toastText(node));
            } else if (node.getAttribute('data-type') === 'success') {
                clearSticky();
            }
        });
    }

    const observer = new MutationObserver((mutations) => {
        scanPage();
        for (const m of mutations) {
            for (const n of m.addedNodes) {
                if (n.nodeType !== 1) {
                    continue;
                }
                if (n.matches('[data-sonner-toast]')) {
                    handleToast(n);
                }
                const nested = n.querySelectorAll('[data-sonner-toast]');
                for (const t of nested) {
                    handleToast(t);
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    scanPage();

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            clearSticky();
        }
    });
})();
