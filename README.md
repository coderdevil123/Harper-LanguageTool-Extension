## Harper + LanguageTool Chrome Extension

A smart writing assistant Chrome extension that combines LanguageTool for grammar checking and Harper for tone & terminology analysis.
The extension provides real-time suggestions, underlines, and corrective actions while maintaining privacy-aware and self-hosted architecture.

## Features

1. Real-time grammar checking (LanguageTool)
2. Tone and terminology suggestions (Harper – self-hosted)
3. Visual underlines for detected issues
4. Interactive suggestion box with apply / dismiss actions
5. Works on most websites, editors, and web-based document tools
6. Limited but safe support for Google Docs
7. Privacy-conscious design

## Content Script (content.js)

Responsible for:
Detecting editable elements (input, textarea, contenteditable)
Capturing user input (typing, focus, selection)
Rendering underlines and suggestion UI
Applying user-selected corrections
Handling editor-specific logic (e.g., Google Docs limitations)

## Background Service Worker (background.js)

Responsible for:
Receiving text from content script
Running analysis engines
Merging results
Sending structured results back to content script

## Analysis Engines

### LanguageTool:
Used for grammar and spelling checks
Currently integrated via API
Can be:
self-hosted
or used via official LanguageTool API

### Harper (Self-Hosted):
Custom, in-house analysis engine
Detects:
tone issues (e.g., excessive intensifiers)
informal terminology
Runs entirely inside the extension
No external API calls
Full control over rules and logic

## How Input Is Captured & Analyzed:

### Input Triggers
The extension analyzes text when:
User types (debounced)
User focuses on an editor
User selects text (especially in Google Docs)

### Debouncing & Safety
Typing analysis is delayed by ~1–1.5 seconds
Minimum text length checks prevent unnecessary processing
Hard character limits prevent overload

## Tech Stack:
JavaScript (Chrome Extension APIs – Manifest V3)
LanguageTool (Grammar Engine)
Harper (Custom Rule Engine)
DOM APIs
