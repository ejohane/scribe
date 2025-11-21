// Test setup file for Bun test runner
import { GlobalWindow } from 'happy-dom';

// Set up happy-dom for DOM testing
const window = new GlobalWindow();
global.window = window as any;
global.document = window.document as any;
global.navigator = window.navigator as any;
global.getComputedStyle = window.getComputedStyle.bind(window) as any;
global.HTMLElement = window.HTMLElement as any;
