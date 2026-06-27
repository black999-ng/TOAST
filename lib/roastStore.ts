// In-memory store for the roast chain
// On Vercel, use environment variable or KV store for production
// For now, module-level state (works for demo, resets on cold start)

const DEFAULT_ROASTS = [
  "Omo you dey mad? Your village people don finally send you come internet to embarrass yourself.",
  "The audacity of this one. You woke up, looked in the mirror, and still decided to come here. Respect for the confidence sha.",
  "Your destiny helper took one look at you and took the next flight out. Can you blame them?",
  "You be the type wey go send 'wyd' at 3am to someone wey don block you on 6 platforms.",
  "Your CV get more gaps than your gum line. E don do.",
  "Even your phone dey autocorrect your name to 'mistake'. The machine don know.",
  "You look like someone wey go lose a debate to a goat and still think e no finish.",
  "Your future dey look at you and dey cry. Your past don already block you.",
];

const roastQueue: string[] = [...DEFAULT_ROASTS];
let currentIndex = 0;

export function getNextRoast(): string {
  const roast = roastQueue[currentIndex % roastQueue.length];
  return roast;
}

export function addRoast(roast: string): void {
  roastQueue.push(roast);
}

export function advanceRoast(): void {
  currentIndex = (currentIndex + 1) % roastQueue.length;
}

export function getQueueLength(): number {
  return roastQueue.length;
}
