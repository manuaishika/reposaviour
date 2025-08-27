document.addEventListener('DOMContentLoaded', () => {
  const tokenInput = document.getElementById('tokenInput');
  const saveTokenBtn = document.getElementById('saveToken');
  const tokenSection = document.getElementById('tokenSection');
  const mainContent = document.getElementById('mainContent');
  const totalReposEl = document.getElementById('totalRepos');
  const incompleteReposEl = document.getElementById('incompleteRepos');
  const repoListEl = document.getElementById('repoList');
  const refreshBtn = document.getElementById('refreshBtn');
  const motivationalMessageEl = document.getElementById('motivationalMessage');

  checkTokenStatus();

  saveTokenBtn.addEventListener('click', saveToken);
  refreshBtn.addEventListener('click', refreshRepositories);

  function checkTokenStatus() {
    chrome.storage.local.get(['githubToken'], (result) => {
      console.log('🔍 RepoSaviour Popup: Token check result:', result);
      if (result.githubToken) {
        tokenInput.value = result.githubToken;
        tokenSection.style.display = 'none';
        mainContent.style.display = 'block';
        loadRepositories();
      } else {
        console.log('🔍 RepoSaviour Popup: No token found, showing token input');
      }
    });
  }

  function saveToken() {
    const token = tokenInput.value.trim();
    if (!token) {
      alert('Please enter a valid GitHub token');
      return;
    }

    chrome.runtime.sendMessage({ action: 'setToken', token: token }, (response) => {
      if (response && response.success) {
        tokenSection.style.display = 'none';
        mainContent.style.display = 'block';
        loadRepositories();
      } else {
        alert('Failed to save token. Please try again.');
      }
    });
  }

  function loadRepositories() {
    console.log('🔍 RepoSaviour Popup: Loading repositories...');
    chrome.runtime.sendMessage({ action: 'getRepos' }, (response) => {
      console.log('🔍 RepoSaviour Popup: Got response:', response);
      if (response) {
        displayRepositories(response.repos, response.incompleteRepos);
      } else {
        console.log('🔍 RepoSaviour Popup: No response received');
      }
    });
  }

  function refreshRepositories() {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing...';
    
    chrome.runtime.sendMessage({ action: 'refreshRepos' }, (response) => {
      if (response && response.success) {
        setTimeout(() => {
          loadRepositories();
          refreshBtn.disabled = false;
          refreshBtn.textContent = 'Refresh Repositories';
        }, 1000);
      } else {
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Refresh Repositories';
        alert('Failed to refresh repositories');
      }
    });
  }

  function displayRepositories(repos, incompleteRepos) {
    if (!repos || repos.length === 0) {
      totalReposEl.textContent = '0';
      incompleteReposEl.textContent = '0';
      motivationalMessageEl.style.display = 'none';
      repoListEl.innerHTML = '<div class="loading">No repositories found</div>';
      return;
    }

    totalReposEl.textContent = repos.length;
    incompleteReposEl.textContent = incompleteRepos.length;

    if (incompleteRepos.length === 0) {
      motivationalMessageEl.style.display = 'none';
      repoListEl.innerHTML = '<div class="loading">All repositories are complete! 🎉</div>';
      return;
    }

    motivationalMessageEl.style.display = 'flex';
    
    const repoItems = incompleteRepos.map(repo => {
      const status = getRepoStatus(repo);
      return `
        <div class="repo-item">
          <a href="${repo.html_url}" target="_blank" class="repo-name">${repo.full_name}</a>
          <span class="repo-status">${status}</span>
        </div>
      `;
    }).join('');

    repoListEl.innerHTML = repoItems;
  }

  function getRepoStatus(repo) {
    const issues = [];
    
    if (!repo.has_wiki && !repo.description && (!repo.topics || repo.topics.length === 0)) {
      issues.push('No README');
    }
    
    if (repo.updated_at === repo.created_at) {
      issues.push('No commits');
    }
    
    if (repo.fork && repo.open_issues_count === 0) {
      issues.push('Fork');
    }
    
    return issues.join(', ');
  }
});
