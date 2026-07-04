// @ts-nocheck
import { apiPost } from "./api";

export type NLPAction =
  | "VIEW_DASHBOARD"
  | "VIEW_MEETINGS"
  | "VIEW_PAYMENTS"
  | "VIEW_LOANS"
  | "VIEW_MEMBERS"
  | "VIEW_HISTORY"
  | "VIEW_RULES"
  | "LOAN_SETTINGS"
  | "REQUEST_LOAN"
  | "VIEW_REPORTS"
  | "UNKNOWN";

export interface NLPResult {
  action: NLPAction;
  route: string | null;
  confidence: "high" | "medium" | "low";
  replyEn: string;
  replyMr: string;
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function startVoiceRecognition(language: "en" | "mr"): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isSpeechRecognitionSupported()) {
      reject(new Error("Speech recognition is not supported in this browser. Please use Chrome."));
      return;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();

    recognition.lang = language === "mr" ? "mr-IN" : "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      resolve(transcript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        reject(new Error("No speech detected. Please try again."));
      } else if (event.error === "not-allowed") {
        reject(new Error("Microphone access denied. Please allow microphone in browser settings."));
      } else {
        reject(new Error(`Voice error: ${event.error}`));
      }
    };

    recognition.onnomatch = () => {
      reject(new Error("Could not recognise speech. Please speak clearly and try again."));
    };

    recognition.start();
  });
}

export async function classifyIntent(transcript: string): Promise<NLPResult> {
  try {
    const result = await apiPost<NLPResult>("/api/nlp/classify", { transcript });
    return result;
  } catch {
    return {
      action: "UNKNOWN",
      route: null,
      confidence: "low",
      replyEn: "Sorry, I couldn't understand. Please try again.",
      replyMr: "माफ करा, मला समजले नाही. कृपया पुन्हा प्रयत्न करा.",
    };
  }
}

export async function processVoiceCommand(language: "en" | "mr"): Promise<{ transcript: string; result: NLPResult }> {
  const transcript = await startVoiceRecognition(language);
  const result = await classifyIntent(transcript);
  return { transcript, result };
}
