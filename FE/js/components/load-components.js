function loadComponent(elementId, filePath) {
    const element = document.getElementById(elementId);
    if (!element) {
        return Promise.resolve();
    }

    return fetch(filePath)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Failed to load ${filePath}`);
            }
            return response.text();
        })
        .then((html) => {
            element.innerHTML = html;
            initializeComponent(elementId);
        })
        .catch((error) => {
            console.error('Component load error:', error);
            element.innerHTML = `<div style="padding: 20px; color: red;">Không thể tải ${elementId}</div>`;
        });
}

function initializeHeader() {
    if (typeof window.updateHeaderAuth === 'function') {
        window.updateHeaderAuth();
    }

    if (typeof window.updateCartBadge === 'function') {
        window.updateCartBadge();
    }
}

function initializeComponent(componentId) {
    if (componentId === 'header') {
        initializeHeader();
    }
}

function getComponentPath(componentName) {
    return new URL(`../../components/${componentName}.html`, window.location.href).href;
}

function loadCommonComponents() {
    const tasks = [];

    if (document.getElementById('header')) {
        tasks.push(loadComponent('header', getComponentPath('header')));
    }

    if (document.getElementById('footer')) {
        tasks.push(loadComponent('footer', getComponentPath('footer')));
    }

    return Promise.all(tasks);
}

window.loadCommonComponents = loadCommonComponents;
