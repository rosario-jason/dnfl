/* ==========================================================================
   DNFL Official Bylaws & Rules Interactive Accordion Engine
   ========================================================================== */
(function() {
    'use strict';

    // Establish Global DNFL Namespace
    window.DNFL = window.DNFL || {};

    /**
     * Toggles an individual accordion section, subsection, or topic header
     * @param {HTMLElement} headerEl 
     */
    function toggleElement(headerEl) {
        if (!headerEl) return;
        const content = headerEl.nextElementSibling;
        const icon = headerEl.querySelector('i');
        if (!content) return;
        
        if (content.style.display === 'none' || content.style.display === '') {
            content.style.display = 'block';
            if (icon) {
                if (icon.classList.contains('dnfl-rules-icon')) icon.className = 'fas fa-chevron-down dnfl-rules-icon';
                if (icon.classList.contains('dnfl-sub-icon')) icon.className = 'fas fa-caret-down dnfl-sub-icon';
                if (icon.classList.contains('dnfl-topic-icon')) icon.className = 'fas fa-angle-down dnfl-topic-icon';
            }
        } else {
            content.style.display = 'none';
            if (icon) {
                if (icon.classList.contains('dnfl-rules-icon')) icon.className = 'fas fa-chevron-right dnfl-rules-icon';
                if (icon.classList.contains('dnfl-sub-icon')) icon.className = 'fas fa-caret-right dnfl-sub-icon';
                if (icon.classList.contains('dnfl-topic-icon')) icon.className = 'fas fa-angle-right dnfl-topic-icon';
            }
        }
    }

    /**
     * Control Bar Action: Shows Level 1 & Level 2 submenus while keeping Level 3 topics collapsed
     */
    function showSubMenus() {
        document.querySelectorAll('.dnfl-rules-main-content, .dnfl-rules-sub-content').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.dnfl-rules-topic-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.dnfl-rules-icon').forEach(icon => icon.className = 'fas fa-chevron-down dnfl-rules-icon');
        document.querySelectorAll('.dnfl-sub-icon').forEach(icon => icon.className = 'fas fa-caret-down dnfl-sub-icon');
        document.querySelectorAll('.dnfl-topic-icon').forEach(icon => icon.className = 'fas fa-angle-right dnfl-topic-icon');
    }

    /**
     * Control Bar Action: Expands all rulebook sections, subsections, and topics
     */
    function expandAll() {
        document.querySelectorAll('.dnfl-rules-main-content, .dnfl-rules-sub-content, .dnfl-rules-topic-content').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.dnfl-rules-icon').forEach(icon => icon.className = 'fas fa-chevron-down dnfl-rules-icon');
        document.querySelectorAll('.dnfl-sub-icon').forEach(icon => icon.className = 'fas fa-caret-down dnfl-sub-icon');
        document.querySelectorAll('.dnfl-topic-icon').forEach(icon => icon.className = 'fas fa-angle-down dnfl-topic-icon');
    }

    /**
     * Control Bar Action: Collapses all rulebook sections, subsections, and topics
     */
    function collapseAll() {
        document.querySelectorAll('.dnfl-rules-main-content, .dnfl-rules-sub-content, .dnfl-rules-topic-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.dnfl-rules-icon').forEach(icon => icon.className = 'fas fa-chevron-right dnfl-rules-icon');
        document.querySelectorAll('.dnfl-sub-icon').forEach(icon => icon.className = 'fas fa-caret-right dnfl-sub-icon');
        document.querySelectorAll('.dnfl-topic-icon').forEach(icon => icon.className = 'fas fa-angle-right dnfl-topic-icon');
    }

    // Export module onto the window.DNFL namespace
    window.DNFL.Rules = {
        toggleElement: toggleElement,
        showSubMenus: showSubMenus,
        expandAll: expandAll,
        collapseAll: collapseAll
    };
})();