// Worker entry proxy — loads the actual worker implementation from @secure-exec/browser.
// Kept here so browser tests can reference this path as the Worker URL.
import "@secure-exec/browser/internal/worker";
