import type { UserState, UserMode, ChatMessage } from "./types";

const MAX_HISTORY = 20;

const store = new Map<number, UserState>();

function getOrCreate(userId: number): UserState {
  if (!store.has(userId)) {
    store.set(userId, {
      mode: "start",
      history: [],
      lastAIResponse: "",
      settings: { autoVoice: false },
      pendingVideoUrl: null,
    });
  }
  return store.get(userId)!;
}

export function getState(userId: number): UserState {
  return getOrCreate(userId);
}

export function setMode(userId: number, mode: UserMode): void {
  getOrCreate(userId).mode = mode;
}

export function addMessage(userId: number, msg: ChatMessage): void {
  const state = getOrCreate(userId);
  state.history.push(msg);
  if (state.history.length > MAX_HISTORY) {
    state.history = state.history.slice(state.history.length - MAX_HISTORY);
  }
}

export function clearHistory(userId: number): void {
  const state = getOrCreate(userId);
  state.history = [];
  state.lastAIResponse = "";
}

export function setLastAIResponse(userId: number, response: string): void {
  getOrCreate(userId).lastAIResponse = response;
}

export function toggleAutoVoice(userId: number): boolean {
  const state = getOrCreate(userId);
  state.settings.autoVoice = !state.settings.autoVoice;
  return state.settings.autoVoice;
}

export function getHistoryCount(userId: number): number {
  return getOrCreate(userId).history.length;
}

export function setPendingVideoUrl(userId: number, url: string | null): void {
  getOrCreate(userId).pendingVideoUrl = url;
}

export function getPendingVideoUrl(userId: number): string | null {
  return getOrCreate(userId).pendingVideoUrl;
}
