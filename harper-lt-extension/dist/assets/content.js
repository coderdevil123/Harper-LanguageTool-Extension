(function() {
    'use strict';
    
    console.log("🚀 Harper-LT: content script loaded");

    let activeElement = null;
    let suggestionBox = null;
    let currentIssues = [];
    let debounceTimer = null;
    let isEnabled = true;
    let underlinesContainer = null;
    let initialAnalysisTimer = null;
    let googleDocsRetryCount = 0;
    const MAX_GOOGLE_DOCS_RETRIES = 5;

    // Initialize immediately
    initialize();

    function initialize() {
        console.log("📦 Initializing Harper-LT...");
        
        // Create suggestion box first
        createSuggestionBox();
        
        // Add event listeners
        document.addEventListener('focusin', handleFocusIn, true);
        document.addEventListener('input', handleInput, true);
        document.addEventListener('click', handleClick, true);
        document.addEventListener('selectionchange', handleSelectionChange);
        
        // Listen for messages from background
        chrome.runtime.onMessage.addListener(handleMessage);
        
        // Auto-analyze existing text after page loads
        setTimeout(() => {
            autoAnalyzeExistingText();
        }, 2000);
        
        // Make test function available
        window.testHarperLT = function() {
            console.log("🧪 Harper-LT Test");
            console.log("Active element:", activeElement);
            console.log("Suggestion box exists:", !!suggestionBox);
            console.log("Current issues:", currentIssues.length);
            console.log("Is enabled:", isEnabled);
            
            if (activeElement) {
                console.log("Active element text:", getElementText(activeElement));
            }
            
            if (suggestionBox) {
                suggestionBox.innerHTML = `
                    <div style="padding: 20px; text-align: center;">
                        <h3 style="margin: 0 0 10px 0; color: #4CAF50;">✅ Harper-LT is Working!</h3>
                        <p style="margin: 0; color: #666;">Extension loaded successfully</p>
                        <button onclick="this.parentElement.parentElement.style.display='none'" 
                                style="margin-top: 15px; padding: 8px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Close
                        </button>
                    </div>
                `;
                suggestionBox.style.display = 'block';
                suggestionBox.style.top = '100px';
                suggestionBox.style.left = '100px';
                console.log("Test box displayed!");
            }
            
            return "Harper-LT is working!";
        };
        
        console.log("✅ Harper-LT initialized successfully!");
        console.log("💡 Type window.testHarperLT() to test");
    }

    function autoAnalyzeExistingText() {
        console.log('🔍 Auto-analyzing existing text on page...');
        
        // Special handling for Google Docs
        if (window.location.hostname === 'docs.google.com') {
            console.log('📝 Google Docs detected!');
            
            // Longer delay for Google Docs to fully load
            setTimeout(() => {
                // Extract all text from Google Docs directly from the DOM
                const textBlocks = document.querySelectorAll('.kix-lineview-text-block');
                
                if (textBlocks.length > 0) {
                    console.log(`✅ Found ${textBlocks.length} text blocks in Google Docs`);
                    googleDocsRetryCount = 0; // Reset retry counter
                    
                    // Get all text
                    const fullText = Array.from(textBlocks)
                        .map(block => block.textContent || block.innerText || '')
                        .filter(text => text.trim().length > 0)
                        .join(' ');
                    
                    console.log('📝 Extracted text length:', fullText.length);
                    console.log('📝 Text preview:', fullText.substring(0, 100));
                    
                    if (fullText && fullText.trim().length > 5) {
                        // Use the page container as active element
                        activeElement = document.querySelector('.kix-page') || document.body;
                        
                        // Analyze the text
                        analyzeGoogleDocsText(fullText);
                        
                        // Set up monitoring for changes
                        const pageContainer = document.querySelector('.kix-appview-editor-container, body');
                        if (pageContainer) {
                            let lastText = fullText;
                            
                            const observer = new MutationObserver(() => {
                                clearTimeout(debounceTimer);
                                debounceTimer = setTimeout(() => {
                                    const newBlocks = document.querySelectorAll('.kix-lineview-text-block');
                                    const newText = Array.from(newBlocks)
                                        .map(block => block.textContent || block.innerText || '')
                                        .filter(text => text.trim().length > 0)
                                        .join(' ');
                                    
                                    if (newText && newText.trim().length > 5 && newText !== lastText) {
                                        console.log('📝 Google Docs text changed, re-analyzing...');
                                        lastText = newText;
                                        analyzeGoogleDocsText(newText);
                                    }
                                }, 2000);
                            });
                            
                            observer.observe(pageContainer, {
                                childList: true,
                                subtree: true,
                                characterData: true
                            });
                            
                            console.log('✅ Monitoring Google Docs for changes');
                        }
                    } else {
                        console.warn('⚠️ No text found in Google Docs');
                    }
                } else {
                    googleDocsRetryCount++;
                    
                    if (googleDocsRetryCount < MAX_GOOGLE_DOCS_RETRIES) {
                        console.warn(`⚠️ Google Docs not fully loaded yet, retrying (${googleDocsRetryCount}/${MAX_GOOGLE_DOCS_RETRIES})...`);
                        setTimeout(autoAnalyzeExistingText, 3000);
                    } else {
                        console.error('❌ Google Docs failed to load after maximum retries');
                        console.log('💡 You can manually trigger analysis by typing in the document');
                        
                        // Set up a listener for any keyboard activity
                        document.addEventListener('keyup', function handleFirstKeypress() {
                            console.log('⌨️ Keyboard activity detected, attempting analysis...');
                            setTimeout(() => {
                                const blocks = document.querySelectorAll('.kix-lineview-text-block');
                                if (blocks.length > 0) {
                                    const text = Array.from(blocks)
                                        .map(b => b.textContent || '')
                                        .join(' ');
                                    if (text.trim().length > 5) {
                                        activeElement = document.querySelector('.kix-page') || document.body;
                                        analyzeGoogleDocsText(text);
                                        document.removeEventListener('keyup', handleFirstKeypress);
                                    }
                                }
                            }, 1000);
                        }, { once: false });
                    }
                }
            }, 5000); // Wait 5 seconds for Google Docs to load
            
            return;
        }
        
        // For regular websites
        const editableElements = document.querySelectorAll('input[type="text"], input[type="email"], textarea, [contenteditable="true"]');
        
        editableElements.forEach(element => {
            const text = getElementText(element);
            if (text && text.trim().length > 5) {
                console.log('📝 Found text in', element.tagName, '- analyzing...');
                activeElement = element;
                analyzeText(element);
            }
        });
    }

    function analyzeGoogleDocsText(text) {
        if (!text || text.trim().length < 5) {
            console.log('⏭️ Text too short, skipping');
            return;
        }
        
        console.log('📝 Analyzing Google Docs text:', text.substring(0, 100) + '...');
        
        // Check if extension context is valid
        if (!chrome.runtime?.id) {
            console.warn('⚠️ Extension context invalidated. Please refresh the page.');
            return;
        }
        
        // Wake up service worker
        try {
            chrome.runtime.sendMessage({ type: "PING" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Service worker not responding:', chrome.runtime.lastError.message);
                    return;
                }
                
                // Send text for analysis
                chrome.runtime.sendMessage({
                    type: "USER_TEXT",
                    payload: { text }
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ Send error:', chrome.runtime.lastError.message);
                    } else {
                        console.log('✅ Text sent to background, response:', response);
                    }
                });
            });
        } catch (error) {
            console.error('❌ Extension error:', error.message);
            console.warn('⚠️ Extension was reloaded. Please refresh this page.');
        }
    }

    function handleSelectionChange() {
        // Debounce selection changes
        clearTimeout(initialAnalysisTimer);
        initialAnalysisTimer = setTimeout(() => {
            const selection = window.getSelection();
            if (selection && selection.toString().trim().length > 5) {
                const selectedText = selection.toString();
                console.log('📝 Text selected:', selectedText.substring(0, 50) + '...');
                
                // Find the element containing the selection
                const element = selection.anchorNode?.parentElement;
                if (element && isEditableElement(element)) {
                    activeElement = element;
                    analyzeText(element);
                }
            }
        }, 500);
    }

    function handleFocusIn(e) {
        const target = e.target;
        if (isEditableElement(target)) {
            activeElement = target;
            console.log('✓ Focused:', target.tagName, target.type || '', target.className);
            
            // Auto-analyze existing text in focused element
            const text = getElementText(target);
            if (text && text.trim().length > 5) {
                console.log('📝 Auto-analyzing existing text on focus...');
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    analyzeText(target);
                }, 1000);
            }
        }
    }

    function handleInput(e) {
        const target = e.target;
        if (!isEditableElement(target) || !isEnabled) return;
        
        activeElement = target;
        const text = getElementText(target);
        
        console.log('⌨️ Input detected, length:', text.length);
        
        clearUnderlines();
        
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            console.log('⏰ Analyzing after debounce...');
            analyzeText(target);
        }, 1500);
    }

    function handleClick(e) {
        if (e.target.classList.contains('harper-lt-underline')) {
            return;
        }
        
        if (suggestionBox && !suggestionBox.contains(e.target) && e.target !== activeElement) {
            hideSuggestionBox();
        }
    }

    function isEditableElement(element) {
        if (!element) return false;
        
        // Special handling for Google Docs
        if (window.location.hostname === 'docs.google.com') {
            return element.classList?.contains('kix-paginateddocumentplugin') || 
                   element.classList?.contains('docs-texteventtarget-iframe') ||
                   element.getAttribute('contenteditable') === 'true';
        }
        
        const tagName = element.tagName?.toLowerCase() || '';
        
        if (tagName === 'input') {
            const type = (element.type || 'text').toLowerCase();
            const editableTypes = ['text', 'email', 'search', 'url', 'tel', 'password'];
            return editableTypes.includes(type);
        }
        
        if (tagName === 'textarea') return true;
        if (element.isContentEditable) return true;
        if (element.getAttribute('contenteditable') === 'true') return true;
        if (element.hasAttribute('contenteditable')) return true;
        
        return false;
    }

    function analyzeText(element) {
        const text = getElementText(element);
        
        if (!text || text.trim().length < 5) {
            console.log('⏭️ Text too short, skipping');
            hideSuggestionBox();
            return;
        }
        
        console.log('📝 Analyzing:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
        
        // Check if extension context is valid
        if (!chrome.runtime?.id) {
            console.warn('⚠️ Extension context invalidated. Please refresh the page.');
            return;
        }
        
        // Wake up service worker first
        try {
            chrome.runtime.sendMessage({ type: "PING" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Service worker not responding:', chrome.runtime.lastError.message);
                    return;
                }
                
                console.log('✅ Service worker active');
                
                // Now send the actual text for analysis
                chrome.runtime.sendMessage({
                    type: "USER_TEXT",
                    payload: { text }
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ Send error:', chrome.runtime.lastError.message);
                    } else {
                        console.log('✅ Text sent to background, response:', response);
                    }
                });
            });
        } catch (error) {
            console.error('❌ Extension error:', error.message);
            console.warn('⚠️ Extension was reloaded. Please refresh this page.');
        }
    }

    function getElementText(element) {
        if (!element) return '';
        
        const tagName = element.tagName?.toLowerCase() || '';
        
        // Special handling for Google Docs
        if (window.location.hostname === 'docs.google.com') {
            return element.innerText || element.textContent || '';
        }
        
        if (tagName === 'input' || tagName === 'textarea') {
            return element.value || '';
        } else if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
            return element.innerText || element.textContent || '';
        }
        return '';
    }

    function handleMessage(request, sender, sendResponse) {
        console.log('📨 Message received:', request.type);
        
        try {
            switch (request.type) {
                case 'COMBINED_RESULTS':
                    console.log('📊 Results:', request.payload);
                    handleResults(request.payload);
                    sendResponse({ success: true });
                    break;
                    
                case 'SHOW_SUGGESTIONS':
                    showSuggestions(request.payload);
                    sendResponse({ success: true });
                    break;
                    
                case 'APPLY_SUGGESTION':
                    applySuggestion(request.payload);
                    sendResponse({ success: true });
                    break;
                    
                case 'TOGGLE_EXTENSION':
                    isEnabled = !isEnabled;
                    console.log('Extension toggled:', isEnabled);
                    sendResponse({ success: true });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown type' });
            }
        } catch (error) {
            console.error('❌ Message error:', error);
            sendResponse({ success: false, error: error.message });
        }
        
        return true;
    }

    function createSuggestionBox() {
        if (suggestionBox) {
            console.log('Suggestion box already exists');
            return;
        }
        
        console.log('Creating suggestion box...');
        
        suggestionBox = document.createElement('div');
        suggestionBox.id = 'harper-lt-suggestion-box';
        
        suggestionBox.style.cssText = `
            position: fixed !important;
            z-index: 2147483647 !important;
            background: white !important;
            border: 2px solid #4CAF50 !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
            padding: 16px !important;
            min-width: 300px !important;
            max-width: 420px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 14px !important;
            line-height: 1.5 !important;
            display: none !important;
            color: #333 !important;
        `;
        
        document.body.appendChild(suggestionBox);
        console.log('✅ Suggestion box created');
        
        // Create underlines container
        createUnderlinesContainer();
    }

    function createUnderlinesContainer() {
        if (underlinesContainer) {
            console.log('Underlines container already exists');
            return;
        }
        
        console.log('Creating underlines container...');
        
        underlinesContainer = document.createElement('div');
        underlinesContainer.id = 'harper-lt-underlines';
        underlinesContainer.style.cssText = `
            position: absolute !important;
            pointer-events: none !important;
            z-index: 2147483646 !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
        `;
        
        document.body.appendChild(underlinesContainer);
        console.log('✅ Underlines container created');
        
        // Redraw underlines on scroll
        window.addEventListener('scroll', () => {
            if (currentIssues.length > 0 && activeElement) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    drawUnderlines();
                }, 100);
            }
        }, true);
        
        // Redraw on window resize
        window.addEventListener('resize', () => {
            if (currentIssues.length > 0 && activeElement) {
                drawUnderlines();
            }
        });
    }

    function clearUnderlines() {
        if (underlinesContainer) {
            underlinesContainer.innerHTML = '';
        }
    }

    function drawUnderlines() {
        if (!activeElement || !underlinesContainer) {
            console.log('Cannot draw underlines: missing element or container');
            return;
        }
        
        clearUnderlines();
        
        if (currentIssues.length === 0) {
            console.log('No issues to underline');
            return;
        }
        
        console.log('Drawing underlines for', currentIssues.length, 'issues');
        
        // Use a more accurate method to find text positions
        const text = getElementText(activeElement);
        
        currentIssues.forEach(issue => {
            const color = getUnderlineColor(issue.type);
            const offset = issue.offset || 0;
            const length = issue.length || 0;
            
            if (!length) {
                console.warn('Issue has no length, skipping:', issue);
                return;
            }
            
            console.log(`Drawing underline for: "${text.substring(offset, offset + length)}" at offset ${offset}`);
            
            // Try to find the actual text position in the DOM
            const range = document.createRange();
            const selection = window.getSelection();
            
            try {
                // For contenteditable or regular textareas
                const tagName = activeElement.tagName?.toLowerCase();
                
                if (tagName === 'textarea' || tagName === 'input') {
                    // For textarea/input, we need to create a mirror div to measure position
                    drawUnderlineForInputElement(activeElement, issue, color);
                } else if (activeElement.isContentEditable) {
                    // For contenteditable, use Range API
                    drawUnderlineForContentEditable(activeElement, issue, color, text);
                } else {
                    console.warn('Unsupported element type for underlines');
                }
            } catch (error) {
                console.error('Error drawing underline:', error);
            }
        });
        
        console.log('✅ Underlines drawn');
    }

    function drawUnderlineForInputElement(element, issue, color) {
        // For input/textarea, create a mirror element to measure text
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        const computedStyle = window.getComputedStyle(element);
        const fontSize = parseFloat(computedStyle.fontSize) || 16;
        const fontFamily = computedStyle.fontFamily;
        const lineHeight = parseFloat(computedStyle.lineHeight) || fontSize * 1.5;
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        
        // Create temporary canvas to measure text width accurately
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${fontSize}px ${fontFamily}`;
        
        const text = element.value || '';
        const beforeError = text.substring(0, issue.offset);
        const errorText = text.substring(issue.offset, issue.offset + issue.length);
        
        // Measure actual text width
        const beforeWidth = context.measureText(beforeError).width;
        const errorWidth = context.measureText(errorText).width;
        
        // Create underline
        const underline = document.createElement('div');
        underline.className = 'harper-lt-underline';
        underline.style.cssText = `
            position: absolute !important;
            height: 2px !important;
            background: ${color} !important;
            pointer-events: auto !important;
            cursor: pointer !important;
            border-radius: 1px !important;
            box-shadow: 0 0 2px ${color} !important;
        `;
        
        // Calculate position using measured width
        const left = rect.left + scrollLeft + paddingLeft + beforeWidth;
        const top = rect.top + scrollTop + paddingTop + lineHeight - 2;
        
        underline.style.left = left + 'px';
        underline.style.top = top + 'px';
        underline.style.width = errorWidth + 'px';
        
        // Add wavy effect
        underline.style.backgroundImage = `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 2px,
            ${color} 2px,
            ${color} 4px
        )`;
        underline.style.backgroundSize = '6px 2px';
        
        // Click handler
        underline.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            displayIssueSuggestions(issue);
        };
        
        underlinesContainer.appendChild(underline);
        console.log(`✓ Underline created at ${left}px, width ${errorWidth}px`);
    }

    function drawUnderlineForContentEditable(element, issue, color, fullText) {
        // For contenteditable elements, use TreeWalker to find text nodes
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let currentOffset = 0;
        let targetNode = null;
        let offsetInNode = 0;
        
        // Find the text node containing our error
        while (walker.nextNode()) {
            const node = walker.currentNode;
            const nodeLength = node.textContent.length;
            
            if (currentOffset + nodeLength > issue.offset) {
                targetNode = node;
                offsetInNode = issue.offset - currentOffset;
                break;
            }
            
            currentOffset += nodeLength;
        }
        
        if (!targetNode) {
            console.warn('Could not find text node for issue at offset', issue.offset);
            return;
        }
        
        try {
            // Create a range for the error text
            const range = document.createRange();
            range.setStart(targetNode, offsetInNode);
            range.setEnd(targetNode, Math.min(offsetInNode + issue.length, targetNode.textContent.length));
            
            // Get the bounding rect of the range
            const rects = range.getClientRects();
            
            if (rects.length === 0) {
                console.warn('No rects for range');
                return;
            }
            
            // Create underlines for each rect (handles multi-line)
            Array.from(rects).forEach(rect => {
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                
                const underline = document.createElement('div');
                underline.className = 'harper-lt-underline';
                underline.style.cssText = `
                    position: absolute !important;
                    height: 2px !important;
                    background: ${color} !important;
                    pointer-events: auto !important;
                    cursor: pointer !important;
                    border-radius: 1px !important;
                    box-shadow: 0 0 2px ${color} !important;
                `;
                
                underline.style.left = (rect.left + scrollLeft) + 'px';
                underline.style.top = (rect.bottom + scrollTop - 2) + 'px';
                underline.style.width = rect.width + 'px';
                
                // Add wavy effect
                underline.style.backgroundImage = `repeating-linear-gradient(
                    45deg,
                    transparent,
                    transparent 2px,
                    ${color} 2px,
                    ${color} 4px
                )`;
                underline.style.backgroundSize = '6px 2px';
                
                // Click handler
                underline.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    displayIssueSuggestions(issue);
                };
                
                underlinesContainer.appendChild(underline);
                console.log(`✓ ContentEditable underline at ${rect.left}px, width ${rect.width}px`);
            });
        } catch (error) {
            console.error('Error creating range:', error);
        }
    }

    function getUnderlineColor(type) {
        switch (type) {
            case 'grammar':
                return '#f44336'; // Red for grammar/spelling
            case 'terminology':
                return '#2196F3'; // Blue for terminology
            case 'tone':
                return '#4CAF50'; // Green for tone
            default:
                return '#FF9800'; // Orange for others
        }
    }

    function handleResults(results) {
        console.log('📊 Processing results...');
        console.log('Grammar:', results.grammar?.length || 0);
        console.log('Harper tone:', results.harper?.tone?.length || 0);
        console.log('Harper terminology:', results.harper?.terminology?.length || 0);
        
        currentIssues = [];
        
        // Collect Grammar issues from LanguageTool FIRST (higher priority)
        if (results.grammar && Array.isArray(results.grammar)) {
            results.grammar.forEach(issue => {
                currentIssues.push({ ...issue, type: 'grammar', priority: 1 });
            });
        }
        
        // Then add Harper issues
        if (results.harper) {
            if (results.harper.tone && Array.isArray(results.harper.tone)) {
                results.harper.tone.forEach(issue => {
                    currentIssues.push({ ...issue, type: 'tone', priority: 2 });
                });
            }
            if (results.harper.terminology && Array.isArray(results.harper.terminology)) {
                results.harper.terminology.forEach(issue => {
                    currentIssues.push({ ...issue, type: 'terminology', priority: 3 });
                });
            }
        }
        
        // Sort by priority and position
        currentIssues.sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            return (a.offset || 0) - (b.offset || 0);
        });
        
        console.log('✅ Total issues:', currentIssues.length);
        console.log('Issues by type:', {
            grammar: currentIssues.filter(i => i.type === 'grammar').length,
            tone: currentIssues.filter(i => i.type === 'tone').length,
            terminology: currentIssues.filter(i => i.type === 'terminology').length
        });
        
        // Draw underlines for all issues
        drawUnderlines();
        
        if (currentIssues.length > 0 && activeElement) {
            console.log('🎯 Displaying first issue:', currentIssues[0].type);
            displayIssueSuggestions(currentIssues[0]);
        } else {
            console.log('No issues to display');
            hideSuggestionBox();
        }
    }

    function displayIssueSuggestions(issue) {
        console.log('💡 Displaying suggestions...');
        
        if (!activeElement) {
            console.error('No active element');
            return;
        }
        
        const suggestions = getSuggestionsFromIssue(issue);
        console.log('Suggestions:', suggestions);
        
        positionSuggestionBox(activeElement);
        populateSuggestionBox(issue, suggestions);
        showSuggestionBox();
        
        console.log('✅ Suggestion box shown');
    }

    function getSuggestionsFromIssue(issue) {
        let suggestions = [];
        
        if (issue.replacements && Array.isArray(issue.replacements)) {
            // ← LanguageTool provides "replacements" array
            suggestions = issue.replacements.map(r => {
                if (typeof r === 'string') return r;
                return r.value || r;  // ← Getting suggestion from r.value
            });
        } else if (issue.suggestions && Array.isArray(issue.suggestions)) {
            // ← Harper would provide "suggestions" array (not implemented)
            suggestions = issue.suggestions.map(s => {
                if (typeof s === 'string') return s;
                return s.value || s;
            });
        }
        
        return suggestions.filter(s => s && s.trim());
    }

    function populateSuggestionBox(issue, suggestions) {
        if (!suggestionBox) {
            console.error('Suggestion box missing!');
            return;
        }
        
        suggestionBox.innerHTML = ''; // Clear first
        
        console.log('Populating box...');
        console.log('Issue:', issue);
        
        // Get the actual error word/phrase
        let errorText = '';
        if (issue.context) {
            const offset = issue.context.offset;
            const length = issue.context.length;
            errorText = issue.context.text.substring(offset, offset + length);
        } else if (issue.offset !== undefined && issue.length !== undefined) {
            const fullText = getElementText(activeElement);
            errorText = fullText.substring(issue.offset, issue.offset + issue.length);
        } else {
            errorText = issue.text || issue.context?.text || 'Issue found';
        }
        
        const issueMessage = issue.message || issue.shortMessage || 'Issue detected';
        const contextText = issue.context?.text || '';
        
        // Show issue counter
        const currentIndex = currentIssues.indexOf(issue) + 1;
        const totalIssues = currentIssues.length;
        
        let html = `
            <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="font-weight: 700; color: #2c3e50; font-size: 15px;">
                        ${getIssueIcon(issue.type)} ${getIssueTypeLabel(issue.type)}
                    </div>
                    <div style="font-size: 12px; color: #999; font-weight: 600;">
                        ${currentIndex} / ${totalIssues}
                    </div>
                </div>
                <div style="color: #555; font-size: 13px; margin-bottom: 10px;">
                    ${escapeHtml(issueMessage)}
                </div>
                <div style="background: #fff3cd; padding: 10px; border-radius: 6px; border-left: 4px solid #ffc107; color: #856404; font-size: 13px; margin-bottom: 8px;">
                    <strong>Error:</strong> <span style="background: #ffe082; padding: 2px 4px; border-radius: 3px; font-weight: 600;">${escapeHtml(errorText)}</span>
                </div>
        `;
        
        if (contextText && contextText !== errorText) {
            html += `
                <div style="background: #f5f5f5; padding: 8px; border-radius: 4px; font-size: 12px; color: #666; font-style: italic;">
                    Context: "${escapeHtml(contextText)}"
                </div>
            `;
        }
        
        html += '</div>';
        
        if (suggestions && suggestions.length > 0) {
            html += '<div style="margin-top: 12px;"><div style="color: #666; font-size: 12px; font-weight: 600; margin-bottom: 8px;">SUGGESTIONS:</div>';
            
            suggestions.slice(0, 5).forEach((suggestion, index) => {
                html += `
                    <button 
                        class="harper-sug-btn" 
                        data-index="${index}"
                        data-suggestion="${escapeHtml(suggestion)}"
                        style="
                            display: block !important;
                            width: 100% !important;
                            padding: 10px 14px !important;
                            margin-bottom: 6px !important;
                            background: #f8f9fa !important;
                            border: 1px solid #dee2e6 !important;
                            border-radius: 6px !important;
                            color: #212529 !important;
                            cursor: pointer !important;
                            text-align: left !important;
                            font-size: 14px !important;
                            transition: all 0.2s !important;
                        "
                    >
                        ${escapeHtml(suggestion)}
                    </button>
                `;
            });
            html += '</div>';
        } else {
            html += '<div style="color: #999; font-style: italic; margin-top: 12px;">No suggestions</div>';
        }
        
        // Add navigation buttons if there are multiple issues
        if (totalIssues > 1) {
            html += `
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                    <button 
                        id="harper-prev"
                        style="
                            flex: 1 !important;
                            padding: 8px !important;
                            background: #e3f2fd !important;
                            border: 1px solid #2196F3 !important;
                            border-radius: 6px !important;
                            color: #1976D2 !important;
                            cursor: pointer !important;
                            font-size: 13px !important;
                            font-weight: 600 !important;
                        "
                        ${currentIndex === 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed !important;"' : ''}
                    >
                        ← Previous
                    </button>
                    <button 
                        id="harper-next"
                        style="
                            flex: 1 !important;
                            padding: 8px !important;
                            background: #e3f2fd !important;
                            border: 1px solid #2196F3 !important;
                            border-radius: 6px !important;
                            color: #1976D2 !important;
                            cursor: pointer !important;
                            font-size: 13px !important;
                            font-weight: 600 !important;
                        "
                        ${currentIndex === totalIssues ? 'disabled style="opacity: 0.5; cursor: not-allowed !important;"' : ''}
                    >
                        Next →
                    </button>
                </div>
            `;
        }
        
        html += `
            <button 
                id="harper-dismiss"
                style="
                    display: block !important;
                    width: 100% !important;
                    padding: 8px !important;
                    margin-top: 12px !important;
                    background: transparent !important;
                    border: 1px solid #ddd !important;
                    border-radius: 6px !important;
                    color: #666 !important;
                    cursor: pointer !important;
                    font-size: 13px !important;
                "
            >
                Dismiss All
            </button>
        `;
        
        suggestionBox.innerHTML = html;
        
        // Add click handlers
        const suggestionButtons = suggestionBox.querySelectorAll('.harper-sug-btn');
        suggestionButtons.forEach(btn => {
            btn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                const sug = this.getAttribute('data-suggestion');
                console.log('Applying:', sug);
                applySuggestionToElement(sug, issue);
            };
            btn.onmouseenter = function() {
                this.style.background = '#e3f2fd';
                this.style.borderColor = '#2196F3';
            };
            btn.onmouseleave = function() {
                this.style.background = '#f8f9fa';
                this.style.borderColor = '#dee2e6';
            };
        });
        
        const prevBtn = suggestionBox.querySelector('#harper-prev');
        const nextBtn = suggestionBox.querySelector('#harper-next');
        
        if (prevBtn && currentIndex > 1) {
            prevBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                displayIssueSuggestions(currentIssues[currentIndex - 2]);
            };
        }
        
        if (nextBtn && currentIndex < totalIssues) {
            nextBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                displayIssueSuggestions(currentIssues[currentIndex]);
            };
        }
        
        const dismissBtn = suggestionBox.querySelector('#harper-dismiss');
        if (dismissBtn) {
            dismissBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                currentIssues = [];
                clearUnderlines();
                hideSuggestionBox();
            };
            dismissBtn.onmouseenter = function() {
                this.style.background = '#f8f9fa';
            };
            dismissBtn.onmouseleave = function() {
                this.style.background = 'transparent';
            };
        }
        
        console.log('✅ Box populated');
    }

    function getIssueIcon(type) {
        return type === 'grammar' ? '📝' : type === 'tone' ? '🎨' : '📚';
    }

    function getIssueTypeLabel(type) {
        return type === 'grammar' ? 'Grammar Issue' : type === 'tone' ? 'Tone' : 'Terminology';
    }

    function positionSuggestionBox(element) {
        if (!suggestionBox || !element) return;
        
        const rect = element.getBoundingClientRect();
        let top = rect.bottom + 10;
        let left = rect.left;
        
        if (left + 350 > window.innerWidth) {
            left = window.innerWidth - 370;
        }
        if (left < 10) left = 10;
        
        suggestionBox.style.top = top + 'px';
        suggestionBox.style.left = left + 'px';
    }

    function showSuggestionBox() {
        if (suggestionBox) {
            suggestionBox.style.display = 'block';
            console.log('📦 Box visible');
        }
    }

    function hideSuggestionBox() {
        if (suggestionBox) {
            suggestionBox.style.display = 'none';
            console.log('📦 Box hidden');
        }
    }

    function applySuggestionToElement(suggestion, issue) {
        console.log('Applying suggestion:', suggestion);
        console.log('Issue details:', issue);
        
        if (!activeElement) {
            console.error('No active element');
            return;
        }
        
        const fullText = getElementText(activeElement);
        console.log('Full text:', fullText);
        
        // Get the actual error text and its position
        let errorText = '';
        let offset = 0;
        let length = 0;
        
        if (issue.context) {
            offset = issue.context.offset;
            length = issue.context.length;
            errorText = issue.context.text.substring(offset, offset + length);
            console.log('Error text from context:', errorText, 'at offset:', offset, 'length:', length);
        } else if (issue.offset !== undefined && issue.length !== undefined) {
            offset = issue.offset;
            length = issue.length;
            errorText = fullText.substring(offset, offset + length);
            console.log('Error text from offset/length:', errorText);
        } else {
            errorText = issue.text || issue.context?.text || '';
            console.log('Error text (fallback):', errorText);
        }
        
        if (!errorText) {
            console.error('No error text found');
            return;
        }
        
        let newText;
        if (issue.offset !== undefined && issue.length !== undefined) {
            const beforeError = fullText.substring(0, issue.offset);
            const afterError = fullText.substring(issue.offset + issue.length);
            newText = beforeError + suggestion + afterError;
            console.log('Replacing using offset:', issue.offset, 'length:', issue.length);
        } else {
            const errorIndex = fullText.indexOf(errorText);
            if (errorIndex === -1) {
                console.error('Could not find error text in full text');
                const words = errorText.split(' ');
                const firstWord = words[0];
                const firstWordIndex = fullText.indexOf(firstWord);
                if (firstWordIndex !== -1) {
                    newText = fullText.substring(0, firstWordIndex) + suggestion + fullText.substring(firstWordIndex + errorText.length);
                } else {
                    return;
                }
            } else {
                newText = fullText.substring(0, errorIndex) + suggestion + fullText.substring(errorIndex + errorText.length);
                console.log('Replacing at index:', errorIndex);
            }
        }
        
        console.log('New text:', newText);
        
        const tagName = activeElement.tagName?.toLowerCase();
        
        if (tagName === 'input' || tagName === 'textarea') {
            const cursorPos = activeElement.selectionStart;
            activeElement.value = newText;
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            if (cursorPos !== null) {
                activeElement.setSelectionRange(cursorPos, cursorPos);
            }
        } else if (activeElement.isContentEditable) {
            activeElement.textContent = newText;
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        console.log('✅ Applied successfully');
        hideSuggestionBox();
        
        currentIssues = currentIssues.filter(i => i !== issue);
        
        // Redraw underlines
        drawUnderlines();
        
        if (currentIssues.length > 0) {
            setTimeout(() => displayIssueSuggestions(currentIssues[0]), 500);
        }
    }

    function applySuggestion(payload) {
        console.log('External apply:', payload);
    }

    function showSuggestions(payload) {
        console.log('External show:', payload);
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

})();