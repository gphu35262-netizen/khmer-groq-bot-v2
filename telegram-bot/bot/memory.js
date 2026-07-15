// In-memory per-user state (resets on restart)
const MAX_HISTORY = 20;

/** @type {Map<number, object>} */
const store = new Map();

function getOrCreate(userId) {
  if (!store.has(userId)) {
    store.set(userId, {
      mode: 'start',
      history: [],
      lastAIResponse: '',
      settings: { autoVoice: false },
      pendingVideoUrl: null,
    });
  }
  return store.get(userId);
}

export function getState(userId) {
  return getOrCreate(userId);
}

export function setMode(userId, mode) {
  getOrCreate(userId).mode = mode;
}

export function addMessage(userId, msg) {
  const state = getOrCreate(userId);
  state.history.push(msg);
  if (state.history.length > MAX_HISTORY) {
    state.history = state.history.slice(state.history.length - MAX_HISTORY);
  }
}

export function clearHistory(userId) {
  const state = getOrCreate(userId);
  state.history = [];
  state.lastAIResponse = '';
}

export function setLastAIResponse(userId, response) {
  getOrCreate(userId).lastAIResponse = response;
}

export function toggleAutoVoice(userId) {
  const state = getOrCreate(userId);
  state.settings.autoVoice = !state.settings.autoVoice;
  return state.settings.autoVoice;
}

export function getHistoryCount(userId) {
  return getOrCreate(userId).history.length;
}

export function setPendingVideoUrl(userId, url) {
  getOrCreate(userId).pendingVideoUrl = url;
}

export function getPendingVideoUrl(userId) {
  return getOrCreate(userId).pendingVideoUrl;
}
