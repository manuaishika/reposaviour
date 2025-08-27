let lastRepoCount = 0;

function checkForNewRepositories() {
  const repoElements = document.querySelectorAll('[data-testid="repository-card"]');
  const currentRepoCount = repoElements.length;
  
  if (currentRepoCount > lastRepoCount && lastRepoCount > 0) {
    chrome.runtime.sendMessage({ 
      action: 'checkNewRepos', 
      currentCount: currentRepoCount 
    });
  }
  
  lastRepoCount = currentRepoCount;
}

function addRepoStatusIndicators() {
  const repoCards = document.querySelectorAll('[data-testid="repository-card"]');
  
  repoCards.forEach(card => {
    if (card.querySelector('.repo-saviour-status')) return;
    
    const repoName = card.querySelector('a[data-testid="repository-card-repository-link"]')?.textContent?.trim();
    if (!repoName) return;
    
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'repo-saviour-status';
    statusIndicator.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: #ffebe9;
      color: #cf222e;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
      z-index: 10;
    `;
    
    chrome.storage.local.get(['incompleteRepos'], (result) => {
      if (result.incompleteRepos) {
        const isIncomplete = result.incompleteRepos.some(repo => 
          repo.name === repoName || repo.full_name === repoName
        );
        
        if (isIncomplete) {
          statusIndicator.textContent = '⚠️ Incomplete';
          statusIndicator.style.background = '#fff3cd';
          statusIndicator.style.color = '#856404';
          card.appendChild(statusIndicator);
        }
      }
    });
  });
}

function addIncompleteReposWarning() {
  if (document.querySelector('.repo-saviour-warning')) return;
  
  chrome.storage.local.get(['incompleteRepos'], (result) => {
    if (result.incompleteRepos && result.incompleteRepos.length > 0) {
      const warning = document.createElement('div');
      warning.className = 'repo-saviour-warning';
      warning.style.cssText = `
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 6px;
        padding: 16px;
        margin: 16px 0;
        color: #856404;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      `;
      
      warning.innerHTML = `
        <div>
          <strong>🚨 STOP! You have ${result.incompleteRepos.length} incomplete repositories!</strong>
          <br><em>"Before starting new projects, finish what you started!"</em>
        </div>
        <button id="repo-saviour-view" style="
          background: #dc3545;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
        ">View Incomplete Repos</button>
      `;
      
      const targetElement = document.querySelector('.js-repos-container') || 
                           document.querySelector('[data-testid="repos-container"]') ||
                           document.querySelector('.container-lg');
      
      if (targetElement) {
        targetElement.insertBefore(warning, targetElement.firstChild);
        
        document.getElementById('repo-saviour-view').addEventListener('click', () => {
          chrome.runtime.sendMessage({ action: 'openPopup' });
        });
      }
    }
  });
}

function addNewRepoWarning() {
  if (document.querySelector('.repo-saviour-new-repo-warning')) return;
  
  chrome.storage.local.get(['incompleteRepos'], (result) => {
    if (result.incompleteRepos && result.incompleteRepos.length > 0) {
      const warning = document.createElement('div');
      warning.className = 'repo-saviour-new-repo-warning';
      warning.style.cssText = `
        background: #f8d7da;
        border: 1px solid #f5c6cb;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        color: #721c24;
        font-size: 16px;
        text-align: center;
        box-shadow: 0 4px 12px rgba(220,53,69,0.2);
        position: relative;
        z-index: 1000;
      `;
      
      warning.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 12px;">🚨</div>
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">
          Are you sure you want to create a NEW repository?
        </div>
        <div style="font-size: 14px; margin-bottom: 16px;">
          You currently have <strong>${result.incompleteRepos.length} incomplete projects</strong> that need attention!
        </div>
        <div style="font-size: 13px; font-style: italic; margin-bottom: 20px; opacity: 0.8;">
          "The best time to finish something is before starting something else."
        </div>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="repo-saviour-continue" style="
            background: #28a745;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">I'll Finish Them Later</button>
          <button id="repo-saviour-view-incomplete" style="
            background: #dc3545;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">Show Me What's Incomplete</button>
        </div>
      `;
      
      const targetElement = document.querySelector('.js-repo-create') || 
                           document.querySelector('[data-testid="repository-create"]') ||
                           document.querySelector('.container-lg');
      
      if (targetElement) {
        targetElement.insertBefore(warning, targetElement.firstChild);
        
        document.getElementById('repo-saviour-view-incomplete').addEventListener('click', () => {
          chrome.runtime.sendMessage({ action: 'openPopup' });
        });
        
        document.getElementById('repo-saviour-continue').addEventListener('click', () => {
          warning.style.display = 'none';
        });
      }
    }
  });
}

function initializeContentScript() {
  if (window.location.hostname === 'github.com') {
    const path = window.location.pathname;
    
    if (path === '/' || path.startsWith('/user') || path.startsWith('/orgs')) {
      const observer = new MutationObserver(() => {
        checkForNewRepositories();
        addRepoStatusIndicators();
        addIncompleteReposWarning();
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      setTimeout(() => {
        checkForNewRepositories();
        addRepoStatusIndicators();
        addIncompleteReposWarning();
      }, 1000);
    } else if (path === '/new') {
      addNewRepoWarning();
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}
