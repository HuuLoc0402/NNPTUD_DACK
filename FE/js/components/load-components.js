/**
 * Load Components Dynamically
 * Loads header and footer components into placeholder divs
 */

function loadComponent(elementId, filePath) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`Element with id '${elementId}' not found`);
        return;
    }

    fetch(filePath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load ${filePath}: ${response.statusText}`);
            }
            return response.text();
        })
        .then(html => {
            element.innerHTML = html;
            // Initialize component after loading
            initializeComponent(elementId);
        })
        .catch(error => {
            console.error(`Error loading component:`, error);
            element.innerHTML = `<div style="padding: 20px; color: red;">Error loading ${elementId}</div>`;
        });
}

/**
 * Initialize component after loading
 */
function initializeComponent(componentId) {
    switch(componentId) {
        case 'header':
            initializeHeader();
            break;
        case 'footer':
            initializeFooter();
            break;
        default:
            break;
    }
}

/**
 * Initialize header events and functions
 */
function initializeHeader() {
    // Update auth buttons if available
    if (typeof window.updateHeaderAuth === 'function') {
        window.updateHeaderAuth();
    }

    // Update cart badge if available
    if (typeof window.updateCartBadge === 'function') {
        window.updateCartBadge();
    }

    // Setup logout handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn && typeof window.logout === 'function') {
        logoutBtn.addEventListener('click', window.logout);
    }
}

/**
 * Initialize footer events
 */
function initializeFooter() {
    // Add any footer-specific initialization here
}

/**
 * Get the correct path to component file
 */
function getComponentPath(componentName) {
    try {
        // Use URL API to build correct path relative to current page
        const url = new URL(`../../components/${componentName}.html`, window.location.href);
        return url.href;
    } catch (e) {
        console.error('Error building component path:', e);
        // Fallback path
        return `../../components/${componentName}.html`;
    }
}

/**
 * Auto-load common components (header and footer)
 * Call this in DOMContentLoaded event
 */
function loadCommonComponents() {
    // Load header if placeholder exists
    if (document.getElementById('header')) {
        loadComponent('header', getComponentPath('header'));
    }
    
    // Load footer if placeholder exists
    if (document.getElementById('footer')) {
        loadComponent('footer', getComponentPath('footer'));
    }
}
