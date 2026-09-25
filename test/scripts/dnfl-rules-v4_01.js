/* ==========================================================================
   DNFL Official Bylaws & Rules Interactive Accordion Engine v3.37
   Duke Networking Fantasy League (DNFL)
   Fully aligned with _test_v4_45.scss state utility classes (.is-expanded, .is-collapsed).
   Pure DOM class-based state management without inline .style manipulation or legacy bloat.
   ========================================================================== */
(function() {
    'use strict';

    window.DNFL = window.DNFL || {};

    /**
     * Helper to update FontAwesome chevron/caret/angle icon directions based on expansion state
     */
    function updateIconState(iconEl, isExpanded) {
        if (!iconEl) return;
        if (iconEl.classList.contains('dnfl-rules-icon')) {
            iconEl.className = isExpanded ? 'fas fa-chevron-down dnfl-rules-icon' : 'fas fa-chevron-right dnfl-rules-icon';
        } else if (iconEl.classList.contains('dnfl-sub-icon')) {
            iconEl.className = isExpanded ? 'fas fa-caret-down dnfl-sub-icon' : 'fas fa-caret-right dnfl-sub-icon';
        } else if (iconEl.classList.contains('dnfl-topic-icon')) {
            iconEl.className = isExpanded ? 'fas fa-angle-down dnfl-topic-icon' : 'fas fa-angle-right dnfl-topic-icon';
        }
    }

    /**
     * Toggles an individual accordion section, subsection, or topic header
     * @param {HTMLElement} headerEl 
     */
    function toggleElement(headerEl) {
        if (!headerEl) return;
        const content = headerEl.nextElementSibling;
        const icon = headerEl.querySelector('i');
        if (!content) return;

        const isExpanded = content.classList.contains('is-expanded');

        if (isExpanded) {
            content.classList.remove('is-expanded');
            content.classList.add('is-collapsed');
            updateIconState(icon, false);
        } else {
            content.classList.remove('is-collapsed');
            content.classList.add('is-expanded');
            updateIconState(icon, true);
        }
    }

    /**
     * Control Bar Action: Shows Level 1 & Level 2 submenus while keeping Level 3 topics collapsed
     */
    function showSubMenus() {
        document.querySelectorAll('.dnfl-rules-main-content, .dnfl-rules-sub-content').forEach(el => {
            el.classList.remove('is-collapsed');
            el.classList.add('is-expanded');
        });
        document.querySelectorAll('.dnfl-rules-topic-content').forEach(el => {
            el.classList.remove('is-expanded');
            el.classList.add('is-collapsed');
        });
        document.querySelectorAll('.dnfl-rules-icon').forEach(icon => updateIconState(icon, true));
        document.querySelectorAll('.dnfl-sub-icon').forEach(icon => updateIconState(icon, true));
        document.querySelectorAll('.dnfl-topic-icon').forEach(icon => updateIconState(icon, false));
    }

    /**
     * Control Bar Action: Expands all rulebook sections, subsections, and topics
     */
    function expandAll() {
        document.querySelectorAll('.dnfl-rules-main-content, .dnfl-rules-sub-content, .dnfl-rules-topic-content').forEach(el => {
            el.classList.remove('is-collapsed');
            el.classList.add('is-expanded');
        });
        document.querySelectorAll('.dnfl-rules-icon, .dnfl-sub-icon, .dnfl-topic-icon').forEach(icon => updateIconState(icon, true));
    }

    /**
     * Control Bar Action: Collapses all rulebook sections, subsections, and topics
     */
    function collapseAll() {
        document.querySelectorAll('.dnfl-rules-main-content, .dnfl-rules-sub-content, .dnfl-rules-topic-content').forEach(el => {
            el.classList.remove('is-expanded');
            el.classList.add('is-collapsed');
        });
        document.querySelectorAll('.dnfl-rules-icon, .dnfl-sub-icon, .dnfl-topic-icon').forEach(icon => updateIconState(icon, false));
    }

    // Export module onto the window.DNFL namespace
    window.DNFL.Rules = {
        toggleElement: toggleElement,
        showSubMenus: showSubMenus,
        expandAll: expandAll,
        collapseAll: collapseAll
    };
})();
