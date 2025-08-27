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
  if (request.action === 'setToken') {
    githubToken = request.token;
    chrome.storage.local.set({ githubToken: request.token });
    fetchRepositories();
    sendResponse({ success: true });
  } else if (request.action === 'getRepos') {
    sendResponse({ repos, incompleteRepos });
  } else if (request.action === 'refreshRepos') {
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
  if (!githubToken) return;

  try {
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) throw new Error('Failed to fetch repos');
    
    const newRepos = await response.json();
    const oldRepos = repos;
    repos = newRepos;
    
    analyzeRepositories();
    checkForNewRepositories(oldRepos, newRepos);
    
    chrome.storage.local.set({ 
      repos: repos,
      incompleteRepos: incompleteRepos,
      lastUpdated: Date.now()
    });
    
    updateBadge();
  } catch (error) {
    console.error('Error fetching repositories:', error);
  }
}

function analyzeRepositories() {
  incompleteRepos = repos.filter(repo => {
    return isRepositoryIncomplete(repo);
  });
}

function isRepositoryIncomplete(repo) {
  const hasReadme = repo.has_wiki || repo.description || repo.topics?.length > 0;
  const hasCommits = repo.updated_at !== repo.created_at;
  const isFork = repo.fork;
  const hasIssues = repo.open_issues_count > 0;
  
  return !hasReadme || !hasCommits || (isFork && !hasIssues);
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
