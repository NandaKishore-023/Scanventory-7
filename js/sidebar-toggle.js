/**
 * sidebar-toggle.js
 * Animated sidebar (left) and activity panel (right) toggling.
 * Features:
 *   - Hamburger → X animation
 *   - Activity panel toggle with open/close state icon (SVG)
 *   - Backdrop overlay with blur
 *   - Swipe-to-close gesture on touch devices
 *   - Edge swipe to open panels
 *   - Escape key closes both
 *   - Auto-closes on viewport resize to desktop
 *   - Body scroll lock while panels are open
 */

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', initToggles);

    /* ── SVG icons ─────────────────────────────────────────── */
    var SVG_ACTIVITY_OPEN =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
        '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>';

    var SVG_ACTIVITY_CLOSE =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
        '<line x1="18" y1="6" x2="6" y2="18"></line>' +
        '<line x1="6" y1="6" x2="18" y2="18"></line></svg>';

    /* ── State ─────────────────────────────────────────────── */
    var sidebarOpen = false;
    var activityOpen = false;

    function initToggles() {

        /* ── Create sidebar toggle button (hamburger) ── */
        var sidebarToggle = document.createElement('button');
        sidebarToggle.className = 'sidebar-toggle';
        sidebarToggle.setAttribute('aria-label', 'Toggle navigation menu');
        sidebarToggle.setAttribute('aria-expanded', 'false');
        sidebarToggle.innerHTML =
            '<span class="bar"></span>' +
            '<span class="bar"></span>' +
            '<span class="bar"></span>';
        document.body.appendChild(sidebarToggle);

        /* ── Create sidebar backdrop overlay ── */
        var sidebarOverlay = document.createElement('div');
        sidebarOverlay.className = 'sidebar-overlay';
        sidebarOverlay.setAttribute('aria-hidden', 'true');
        document.body.appendChild(sidebarOverlay);

        /* ── Create activity toggle + overlay (only if .activity exists) ── */
        var activityPanel = document.querySelector('.activity');
        var activityToggle = null;
        var activityOverlay = null;

        if (activityPanel) {
            activityToggle = document.createElement('button');
            activityToggle.className = 'activity-toggle';
            activityToggle.setAttribute('aria-label', 'Toggle activity panel');
            activityToggle.setAttribute('aria-expanded', 'false');
            activityToggle.title = 'Open activity panel';
            activityToggle.innerHTML = SVG_ACTIVITY_OPEN;
            document.body.appendChild(activityToggle);

            activityOverlay = document.createElement('div');
            activityOverlay.className = 'activity-overlay';
            activityOverlay.setAttribute('aria-hidden', 'true');
            document.body.appendChild(activityOverlay);
        }

        /* ── Sidebar helpers ── */
        function openSidebar() {
            var sidebar = document.querySelector('.sidebar');
            if (!sidebar) return;
            if (activityOpen) closeActivity();

            sidebar.classList.add('is-open');
            sidebarToggle.classList.add('is-open');
            sidebarToggle.setAttribute('aria-expanded', 'true');
            sidebarOverlay.style.display = 'block';
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    sidebarOverlay.classList.add('visible');
                });
            });
            document.body.classList.add('sidebar-open');
            sidebarOpen = true;
        }

        function closeSidebar() {
            var sidebar = document.querySelector('.sidebar');
            if (!sidebar) return;
            sidebar.classList.remove('is-open');
            sidebarToggle.classList.remove('is-open');
            sidebarToggle.setAttribute('aria-expanded', 'false');
            sidebarOverlay.classList.remove('visible');
            document.body.classList.remove('sidebar-open');
            sidebarOpen = false;
            setTimeout(function () {
                if (!sidebarOverlay.classList.contains('visible')) {
                    sidebarOverlay.style.display = 'none';
                }
            }, 400);
        }

        function toggleSidebar() {
            if (sidebarOpen) { closeSidebar(); } else { openSidebar(); }
        }

        /* ── Activity panel helpers ── */
        function openActivity() {
            if (!activityPanel || !activityToggle || !activityOverlay) return;
            if (sidebarOpen) closeSidebar();

            activityPanel.classList.add('is-open');
            activityToggle.setAttribute('aria-expanded', 'true');
            activityToggle.innerHTML = SVG_ACTIVITY_CLOSE;
            activityToggle.title = 'Close activity panel';
            activityOverlay.style.display = 'block';
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    activityOverlay.classList.add('visible');
                });
            });
            document.body.classList.add('activity-open');
            activityOpen = true;
        }

        function closeActivity() {
            if (!activityPanel || !activityToggle || !activityOverlay) return;
            activityPanel.classList.remove('is-open');
            activityToggle.setAttribute('aria-expanded', 'false');
            activityToggle.innerHTML = SVG_ACTIVITY_OPEN;
            activityToggle.title = 'Open activity panel';
            activityOverlay.classList.remove('visible');
            document.body.classList.remove('activity-open');
            activityOpen = false;
            setTimeout(function () {
                if (!activityOverlay.classList.contains('visible')) {
                    activityOverlay.style.display = 'none';
                }
            }, 400);
        }

        function toggleActivity() {
            if (activityOpen) { closeActivity(); } else { openActivity(); }
        }

        /* ── Event listeners ── */
        sidebarToggle.addEventListener('click', toggleSidebar);
        sidebarOverlay.addEventListener('click', closeSidebar);
        if (activityToggle)  activityToggle.addEventListener('click', toggleActivity);
        if (activityOverlay) activityOverlay.addEventListener('click', closeActivity);

        /* Escape key */
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                if (sidebarOpen)  closeSidebar();
                if (activityOpen) closeActivity();
            }
        });

        /* Resize: auto-close on desktop */
        window.addEventListener('resize', debounce(function () {
            if (window.innerWidth > 1024) {
                if (sidebarOpen)  closeSidebar();
                if (activityOpen) closeActivity();
                document.body.classList.remove('sidebar-open', 'activity-open');
            }
        }, 150));

        /* Close sidebar when a nav-btn is tapped on mobile */
        document.querySelectorAll('.nav-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (window.innerWidth <= 1024 && sidebarOpen) closeSidebar();
            });
        });

        /* ── Touch swipe gestures ── */
        var touchStartX = 0;
        var touchStartY = 0;
        var SWIPE_MIN   = 55;   // min horizontal distance to count as swipe (px)
        var VERT_MAX    = 60;   // max vertical drift allowed (px)
        var EDGE_ZONE   = 32;   // px from edge to trigger open swipe

        document.addEventListener('touchstart', function (e) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchend', function (e) {
            if (window.innerWidth > 1024) return;
            var dx = e.changedTouches[0].clientX - touchStartX;
            var dy = e.changedTouches[0].clientY - touchStartY;

            // Ignore vertical swipes
            if (Math.abs(dy) > VERT_MAX) return;

            // Swipe right from left edge → open sidebar
            if (!sidebarOpen && !activityOpen &&
                touchStartX <= EDGE_ZONE && dx > SWIPE_MIN) {
                openSidebar();
                return;
            }

            // Swipe left from right edge → open activity
            if (!sidebarOpen && !activityOpen &&
                touchStartX >= window.innerWidth - EDGE_ZONE && dx < -SWIPE_MIN) {
                openActivity();
                return;
            }

            // Swipe left → close sidebar
            if (sidebarOpen && dx < -SWIPE_MIN) {
                closeSidebar();
                return;
            }

            // Swipe right → close activity
            if (activityOpen && dx > SWIPE_MIN) {
                closeActivity();
            }

        }, { passive: true });
    }

    /* ── Debounce utility ── */
    function debounce(fn, delay) {
        var t;
        return function () {
            clearTimeout(t);
            t = setTimeout(fn, delay);
        };
    }

})();