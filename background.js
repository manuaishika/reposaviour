let githubToken = null;
let repos = [];
let incompleteRepos = [];

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['githubToken'], (result) => {
    if (result.githubToken) {
      githubToken = result.githubToken;
      fetchRepositories();
    }
  });
  
  try {
    if (chrome.alarms) {
      chrome.alarms.create('refreshRepos', { periodInMinutes: 60 });
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'refreshRepos') {
          fetchRepositories();
        }
      });
    }
  } catch (error) {
    console.log('Alarms API not available:', error);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('🔍 RepoSaviour: Message received:', request.action);
  
  if (request.action === 'setToken') {
    console.log('🔍 RepoSaviour: Setting token...');
    githubToken = request.token;
    chrome.storage.local.set({ githubToken: request.token });
    fetchRepositories();
    sendResponse({ success: true });
  } else if (request.action === 'getRepos') {
    console.log('🔍 RepoSaviour: Sending repos data. Total:', repos.length, 'Incomplete:', incompleteRepos.length);
    
    if (repos.length === 0 && githubToken) {
      console.log('🔍 RepoSaviour: No repos cached, fetching now...');
      fetchRepositories().then(() => {
        sendResponse({ repos, incompleteRepos });
      });
      return true;
    }
    
    sendResponse({ repos, incompleteRepos });
  } else if (request.action === 'refreshRepos') {
    console.log('🔍 RepoSaviour: Refreshing repositories...');
    fetchRepositories();
    sendResponse({ success: true });
  }
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    chrome.action.openPopup();
  }
});

async function fetchRepositories() {
  if (!githubToken) {
    console.log('🔍 RepoSaviour: No GitHub token available');
    return;
  }

  console.log('🔍 RepoSaviour: Fetching repositories...');
  
  try {
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    console.log('🔍 RepoSaviour: Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔍 RepoSaviour: API Error:', response.status, errorText);
      throw new Error(`Failed to fetch repos: ${response.status} ${errorText}`);
    }
    
    const newRepos = await response.json();
    console.log('🔍 RepoSaviour: Fetched repos:', newRepos.length);
    
    const oldRepos = repos;
    repos = newRepos;
    
    analyzeRepositories();
    checkForNewRepositories(oldRepos, newRepos);
    
    chrome.storage.local.set({ 
      repos: repos,
      incompleteRepos: incompleteRepos,
      lastUpdated: Date.now()
    });
    
    console.log('🔍 RepoSaviour: Analysis complete. Total:', repos.length, 'Incomplete:', incompleteRepos.length);
    updateBadge();
  } catch (error) {
    console.error('🔍 RepoSaviour: Error fetching repositories:', error);
  }
}

function analyzeRepositories() {
  console.log('🔍 RepoSaviour: Analyzing repositories...');
  incompleteRepos = repos.filter(repo => {
    const isIncomplete = isRepositoryIncomplete(repo);
    if (isIncomplete) {
      console.log('🔍 RepoSaviour: Incomplete repo:', repo.name, '- hasReadme:', repo.has_wiki || repo.description || (repo.topics && repo.topics.length > 0), 'hasCommits:', repo.updated_at !== repo.created_at);
    }
    return isIncomplete;
  });
  console.log('🔍 RepoSaviour: Found', incompleteRepos.length, 'incomplete repositories');
}

function isRepositoryIncomplete(repo) {
  const hasReadme = repo.has_wiki || repo.description || repo.topics?.length > 0;
  const hasCommits = repo.updated_at !== repo.created_at;
  
  return !hasReadme || !hasCommits;
}

function checkForNewRepositories(oldRepos, newRepos) {
  if (oldRepos.length === 0) return;
  
  const oldRepoNames = oldRepos.map(r => r.name);
  const newRepo = newRepos.find(repo => !oldRepoNames.includes(repo.name));
  
  if (newRepo) {
    const incompleteCount = incompleteRepos.length;
    if (incompleteCount > 0) {
      chrome.notifications.create({
        type: 'basic',
        title: '🚨 New Repository Alert!',
        message: `You just created "${newRepo.name}" but you have ${incompleteCount} unfinished projects!`,
        requireInteraction: true,
        buttons: [
          { title: 'View Incomplete Repos' },
          { title: 'I\'ll Finish Them Later' }
        ]
      });
      
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
    }
  }
}

function updateBadge() {
  const count = incompleteRepos.length;
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}
