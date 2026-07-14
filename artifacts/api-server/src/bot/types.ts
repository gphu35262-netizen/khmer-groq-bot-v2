export type UserMode =
  | "start"
  | "chat"
  | "image"
  | "voice"
  | "video"
  | "memory"
  | "settings";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface UserSettings {
  autoVoice: boolean;
}

export interface UserState {
  mode: UserMode;
  history: ChatMessage[];
  lastAIResponse: string;
  settings: UserSettings;
  pendingVideoUrl: string | null;
}
