import '@testing-library/jest-dom';

// Mock ResizeObserver for Radix UI components that use it (e.g. react-popper, react-use-size).
// jsdom does not implement ResizeObserver.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
