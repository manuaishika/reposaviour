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
        padding: 12px;
        margin: 16px 0;
        color: #856404;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      `;
      
      warning.innerHTML = `
        <div>
          <strong>⚠️ You have ${result.incompleteRepos.length} incomplete repositories!</strong>
          <br>Consider finishing them before starting new projects.
        </div>
        <button id="repo-saviour-view" style="
          background: #6c757d;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">View Details</button>
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
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}
