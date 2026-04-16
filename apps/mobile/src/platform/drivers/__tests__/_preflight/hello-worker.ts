/// <reference lib="webworker" />

self.addEventListener("message", (ev: MessageEvent<string>) => {
  self.postMessage(`hello ${ev.data}`);
});
