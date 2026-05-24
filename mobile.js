/**
 * Logic to switch between Desktop and Mobile layouts by moving DOM elements.
 * Preserves event listeners and state.
 */

const MobileManager = {
    isMobile: false,
    items: [], // Stores { selector, element, placeholder }

    init: function() {
        // Initialize logic for language dropdown FIRST to ensure handlers are attached
        this.initLanguageDropdown();

        // Run check immediately
        this.checkLayout();
        
        // Listen to resize events
        window.addEventListener('resize', () => {
             if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
             this.resizeFrame = requestAnimationFrame(() => this.checkLayout());
        });

        // Tab Switching Logic
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.target;
                this.switchTab(target);
            });
        });
        
        const mobileDarkToggle = document.querySelector('.mobile-header #dark-mode-toggle-mobile');
        if (mobileDarkToggle) {
             mobileDarkToggle.addEventListener('click', () => {
                 if (typeof cycleTheme === 'function') cycleTheme();
             });
        }
    },

    initLanguageDropdown: function() {
        const btnMore = document.getElementById('btnMoreLanguagesMobile');
        const dropdown = document.getElementById('languageDropdownMobile');

        // Force cleanup and re-population
        if (dropdown) dropdown.innerHTML = '';

        if (dropdown && typeof translations !== 'undefined') {
            const hiddenLanguages = Object.keys(translations).filter(lang => lang !== 'tr' && lang !== 'en');
            
            const getLabel = (lang) => {
                if (typeof getLanguageLabel === 'function') return getLanguageLabel(lang);
                return lang.toUpperCase();
            };

            hiddenLanguages.sort((a, b) => getLabel(a).localeCompare(getLabel(b)));
            
            hiddenLanguages.forEach(lang => {
                const btn = document.createElement('button');
                btn.textContent = getLabel(lang);
                btn.setAttribute('data-lang', lang);
                
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof setLanguage === 'function') setLanguage(lang);

                    // Handle active state
                    document.querySelectorAll('.mobile-lang-switcher > button').forEach(b => b.classList.remove('active'));
                    if (btnMore) btnMore.classList.add('active');
                    
                    dropdown.style.display = 'none';
                    dropdown.classList.remove('show');
                });
                
                dropdown.appendChild(btn);
            });
        }

        if (btnMore) {
             const toggleMenu = function(e) {
                 e.preventDefault();
                 e.stopPropagation();
                 
                 const isVisible = dropdown.style.display === 'flex';
                 
                 if (isVisible) {
                     dropdown.style.display = 'none';
                     dropdown.classList.remove('show');
                 } else {
                     dropdown.style.display = 'flex';
                     dropdown.style.setProperty('display', 'flex', 'important');
                     dropdown.classList.add('show');
                 }
             };
             
             // Remove any previous listeners by cloning
             const newBtn = btnMore.cloneNode(true);
             btnMore.parentNode.replaceChild(newBtn, btnMore);
             newBtn.addEventListener('click', toggleMenu);
             
             // Also close when clicking outside
             document.addEventListener('click', (e) => {
                 // Check if visible first
                 if (dropdown.classList.contains('show') || dropdown.style.display === 'flex') {
                     if (!dropdown.contains(e.target) && !newBtn.contains(e.target)) {
                         dropdown.style.display = 'none';
                         dropdown.classList.remove('show');
                     }
                 }
             });
        }
        
        // TR/EN Buttons re-attachment
        document.querySelectorAll('.mobile-lang-switcher > button[data-lang]').forEach(btn => {
            // Clone to strip old listeners
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', function(e) {
                 const lang = this.getAttribute('data-lang');
                 if (typeof setLanguage === 'function') setLanguage(lang);
                 document.querySelectorAll('.mobile-lang-switcher > button').forEach(b => b.classList.remove('active'));
                 const moreBtn = document.getElementById('btnMoreLanguagesMobile');
                 if (moreBtn) moreBtn.classList.remove('active');
                 this.classList.add('active');
            });
        });
    },

    checkLayout: function() {
        // Use a slightly larger breakpoint for safety
        const width = window.innerWidth;
        const shouldBeMobile = width <= 800; 

        if (shouldBeMobile && !this.isMobile) {
            this.enableMobile();
        } else if (!shouldBeMobile && this.isMobile) {
            this.disableMobile();
        } else if (this.isMobile) {
            this.resizeActiveTab();
        }
    },

    enableMobile: function() {
        console.log("Switching to Mobile View");
        document.body.classList.add('mobile-view');
        this.isMobile = true;

        // Capture all sections first because moving them changes indices if we query live
        // querySelectorAll returns a static NodeList, so it should be fine, but treating as array is safer for indexing.
        const sections = Array.from(document.querySelectorAll('#left-panel .panel-content > .panel-section'));
        const rightBoxes = Array.from(document.querySelectorAll('#right-panel > .element-box'));
        const mohrWrapper = document.querySelector('#mohr-content-wrapper');

        // 1. INPUTS
        if (sections[0]) this.moveNode(sections[0], '#tab-stress .content-slot');

        // 2. STRESS ELEMENT
        if (rightBoxes[0]) this.moveNode(rightBoxes[0], '#tab-stress .canvas-slot');

        // 3. MOHR CIRCLE
        if (mohrWrapper) this.moveNode(mohrWrapper, '#tab-mohr .canvas-slot');

        // 4. PRINCIPAL RESULTS
        if (sections[1]) this.moveNode(sections[1], '#tab-principal .content-slot-1');

        // 5. PRINCIPAL ELEMENT
        if (rightBoxes[1]) this.moveNode(rightBoxes[1], '#tab-principal .canvas-slot-1');

        // 6. MAX SHEAR RESULTS
        if (sections[2]) this.moveNode(sections[2], '#tab-shear .content-slot-2');

        // 7. SHEAR ELEMENT
        if (rightBoxes[2]) this.moveNode(rightBoxes[2], '#tab-shear .canvas-slot-2');

        // 8. TRANSFORM SECTION
        if (sections[3]) this.moveNode(sections[3], '#tab-transformed .content-slot');
        
        // 9. TRANSFORM ELEMENT
        if (rightBoxes[3]) this.moveNode(rightBoxes[3], '#tab-transformed .canvas-slot');

        setTimeout(() => this.resizeActiveTab(), 50);
    },

    disableMobile: function() {
        console.log("Switching to Desktop View");
        document.body.classList.remove('mobile-view');
        this.isMobile = false;

        // Restore elements to their original positions using placeholders
        this.items.forEach(item => {
            if (item.placeholder && item.placeholder.parentNode && item.element) {
                // Move back
                item.placeholder.parentNode.insertBefore(item.element, item.placeholder);
                item.element.classList.remove('in-mobile-view');
                
                // Reset manual styles
                item.element.style.width = '';
                item.element.style.height = '';
                const canvas = item.element.querySelector('canvas');
                if (canvas) {
                    canvas.style.width = '';
                    canvas.style.height = '';
                }
            }
        });
        
        // Trigger global resize to fix layout
        if (typeof resizeAll === 'function') resizeAll();
        if (typeof updateAll === 'function') updateAll();
    },

    // Helper to move a specific node
    moveNode: function(node, targetSelector) {
        // Track the node if not already tracked
        let item = this.items.find(i => i.element === node);
        
        if (!item) {
            const placeholder = document.createComment('placeholder-moved-node');
            if (node.parentNode) {
                node.parentNode.insertBefore(placeholder, node);
            }
            item = { element: node, placeholder: placeholder };
            this.items.push(item);
        }
        
        const target = document.querySelector(targetSelector);
        if (target) {
            target.appendChild(node);
            node.classList.add('in-mobile-view');
        }
    },

    switchTab: function(targetId) {
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        
        const pane = document.getElementById(targetId);
        if (pane) pane.classList.add('active');
        
        const btn = document.querySelector(`.tab-button[data-target="${targetId}"]`);
        if (btn) btn.classList.add('active');
        
        this.resizeActiveTab();
    },

    resizeActiveTab: function() {
        const activePane = document.querySelector('.tab-pane.active');
        if (!activePane) return;

        // Force redraw of canvases in this pane
        const canvases = activePane.querySelectorAll('canvas');
        canvases.forEach(canvas => {
            // Because we set canvas to absolute position in CSS, 
            // we must resize it to match the parent container's generic size.
            // But first, we must ensure the parent has size.
            
            const container = canvas.parentElement; 
            const rect = container.getBoundingClientRect();
            
            // Allow Resize Only if Dimension Changed significantly
            if (rect.width > 0 && rect.height > 0) {
                 // Use floor to avoid sub-pixel infinite loops if float
                 if (Math.abs(canvas.width - rect.width) > 1 || Math.abs(canvas.height - rect.height) > 1) {
                    canvas.width = rect.width;
                    canvas.height = rect.height;
                 }
            }
        });
        
        // Trigger global update to redraw content on resized canvases
        if (typeof updateAll === 'function') updateAll();
    }
};

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MobileManager.init());
} else {
    MobileManager.init();
}
