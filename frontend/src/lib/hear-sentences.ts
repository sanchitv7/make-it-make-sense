import type { TurnId } from "@/types/claim";

export type TranscriptTail = {
  buffer: string;
  turnId: TurnId;
};

export type HearPull = {
  sentences: string[];
  next: TranscriptTail;
};

export function pullCompletedSentences(tail: TranscriptTail, chunk: string): HearPull {
  const combined = tail.buffer + chunk;
  const sentences: string[] = [];
  let lastIndex = 0;
  const completed = /[.!?]["')\]]*(?:\s+|$)/g;
  let match: RegExpExecArray | null;
  while ((match = completed.exec(combined)) !== null) {
    const end = match.index + match[0].length;
    const sentence = combined.slice(lastIndex, end).trim();
    if (sentence) sentences.push(sentence);
    lastIndex = end;
  }
  return {
    sentences,
    next: { buffer: combined.slice(lastIndex), turnId: tail.turnId },
  };
}

export function pullRemainderOnSpeechEnd(tail: TranscriptTail): HearPull {
  const remainder = tail.buffer.trim();
  return {
    sentences: remainder ? [remainder] : [],
    next: { buffer: "", turnId: tail.turnId },
  };
}
