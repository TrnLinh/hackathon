// Initial SRD engineering limits shared by the browser and the backend.
// The browser checks them before upload; Convex re-checks what it can see.
export const LIMITS = {
  titleChars: 80,
  captionChars: 240,
  storyChars: 2000,
  promptChars: 500,
  activeMemories: 12,
  collectionBytes: 120 * 1024 * 1024,
  imageBytes: 10 * 1024 * 1024,
  imageMegapixels: 24,
  audioBytes: 10 * 1024 * 1024,
  audioSeconds: 60,
  videoBytes: 40 * 1024 * 1024,
  videoSeconds: 30,
  framesPerVideo: 6,
  visualsPerJob: 24,
  transcriptChars: 2000,
  sourceTextChars: 12000,
} as const;
