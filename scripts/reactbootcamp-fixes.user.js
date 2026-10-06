// ==UserScript==
// @name         React Bootcamp fixes
// @namespace    https://www.reactbootcamp.com/
// @version      1.0.0
// @description  Sticky failure toasts + Ctrl/Cmd+Enter to submit
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

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            clearSticky();
        }
    });
})();
