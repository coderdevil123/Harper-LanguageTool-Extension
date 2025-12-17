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

    // Document analyzer state
    let documentAnalysisState = {
        isAnalyzing: false,
        currentChunk: 0,
        totalChunks: 0,
        chunkSize: 100, // words per chunk
        chunks: [],
        fullText: '',
        element: null
    };

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
        
        // Add Google Docs debug function
        window.debugGoogleDocs = function() {
            console.log("🔍 GOOGLE DOCS DEBUG");
            console.log("==================");
            
            const selectors = {
                'Word nodes (.kix-wordhtmlgenerator-word-node)': '.kix-wordhtmlgenerator-word-node',
                'Lineview blocks (.kix-lineview-text-block)': '.kix-lineview-text-block',
                'Paragraph spans (.kix-paragraphrenderer span)': '.kix-paragraphrenderer span',
                'Editor area (.kix-appview-editor)': '.kix-appview-editor',
                'Textbox role ([role="textbox"])': '[role="textbox"]',
                'All spans in editor (.kix-appview-editor span)': '.kix-appview-editor span',
                'Page canvas (.kix-page)': '.kix-page',
                'Cursor (.kix-cursor)': '.kix-cursor'
            };
            
            for (const [name, selector] of Object.entries(selectors)) {
                const elements = document.querySelectorAll(selector);
                console.log(`${name}: ${elements.length} found`);
                if (elements.length > 0 && elements.length < 5) {
                    elements.forEach((el, i) => {
                        console.log(`  [${i}]:`, el.textContent?.substring(0, 50) || '(no text)');
                    });
                }
            }
            
            // Try to get ANY text
            console.log("\n📝 EXTRACTION ATTEMPTS:");
            const editor = document.querySelector('.kix-appview-editor');
            if (editor) {
                console.log("Editor innerText:", editor.innerText?.substring(0, 100));
                console.log("Editor textContent:", editor.textContent?.substring(0, 100));
            }
            
            // Show the structure
            console.log("\n🏗️ DOM STRUCTURE:");
            const container = document.querySelector('.kix-appview-editor') || document.body;
            console.log("Container:", container.className);
            console.log("Children:", container.children.length);
            
            return "Debug complete - check console";
        };
        
        console.log("✅ Harper-LT initialized successfully!");
        console.log("💡 Type window.testHarperLT() to test");
        console.log("💡 Type window.debugGoogleDocs() to debug Google Docs");
    }

    function autoAnalyzeExistingText() {
        console.log('🔍 Auto-analyzing existing text on page...');
        
        // Special handling for Google Docs
        if (window.location.hostname === 'docs.google.com') {
            console.log('📝 Google Docs detected!');
            
            // Wait longer for Google Docs to fully load
            setTimeout(() => {
                console.log('🔍 Attempting to read Google Docs content...');
                
                // Try multiple methods to extract text from Google Docs
                let fullText = '';
                let method = 'none';
                
                // Method 1: Try word nodes
                let wordNodes = document.querySelectorAll('.kix-wordhtmlgenerator-word-node');
                if (wordNodes.length > 0) {
                    fullText = Array.from(wordNodes).map(n => n.textContent).join('');
                    method = 'word-nodes';
                }
                
                // Method 2: Try lineview blocks
                if (!fullText) {
                    let lineBlocks = document.querySelectorAll('.kix-lineview-text-block');
                    if (lineBlocks.length > 0) {
                        fullText = Array.from(lineBlocks).map(b => b.textContent).join(' ');
                        method = 'lineview-blocks';
                    }
                }
                
                // Method 3: Try paragraph spans
                if (!fullText) {
                    let paragraphs = document.querySelectorAll('.kix-paragraphrenderer span');
                    if (paragraphs.length > 0) {
                        fullText = Array.from(paragraphs).map(p => p.textContent).filter(t => t.trim()).join(' ');
                        method = 'paragraph-spans';
                    }
                }
                
                // Method 4: Try ANY text content in the editor area
                if (!fullText) {
                    let editorArea = document.querySelector('.kix-appview-editor') || 
                                    document.querySelector('.kix-page-paginated') ||
                                    document.querySelector('[role="textbox"]');
                    if (editorArea) {
                        fullText = editorArea.innerText || editorArea.textContent || '';
                        method = 'editor-innerText';
                    }
                }
                
                // Method 5: Manual DOM inspection
                if (!fullText) {
                    console.log('🔍 Trying manual DOM inspection...');
                    let allSpans = document.querySelectorAll('.kix-appview-editor span');
                    console.log(`Found ${allSpans.length} spans in editor area`);
                    
                    let textParts = [];
                    allSpans.forEach(span => {
                        if (span.textContent && span.textContent.trim()) {
                            textParts.push(span.textContent);
                        }
                    });
                    fullText = textParts.join('');
                    method = 'all-spans';
                }
                
                console.log(`📊 Extraction method: ${method}`);
                console.log(`📝 Extracted text length: ${fullText.length}`);
                console.log(`📝 Text preview: "${fullText.substring(0, 150)}"`);
                
                if (fullText && fullText.trim().length > 5) {
                    console.log('✅ Successfully extracted Google Docs text');
                    googleDocsRetryCount = 0;
                    
                    // Set active element
                    activeElement = document.querySelector('.kix-appview-editor') || 
                                   document.querySelector('[role="textbox"]') ||
                                   document.body;
                    
                    console.log('🎯 Active element:', activeElement.className || activeElement.tagName);
                    
                    // Analyze the text
                    analyzeGoogleDocsText(fullText);
                    
                    // Set up observer
                    setupGoogleDocsObserver(method);
                } else {
                    // Log what we found for debugging
                    console.log('❌ Could not extract text. Debugging info:');
                    console.log('Word nodes:', document.querySelectorAll('.kix-wordhtmlgenerator-word-node').length);
                    console.log('Lineview blocks:', document.querySelectorAll('.kix-lineview-text-block').length);
                    console.log('Paragraph spans:', document.querySelectorAll('.kix-paragraphrenderer span').length);
                    console.log('Editor area exists:', !!document.querySelector('.kix-appview-editor'));
                    console.log('Textbox role:', !!document.querySelector('[role="textbox"]'));
                    
                    retryGoogleDocsLoad();
                }
            }, 10000); // Wait 10 seconds
            
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

    function retryGoogleDocsLoad() {
        googleDocsRetryCount++;
        
        if (googleDocsRetryCount < MAX_GOOGLE_DOCS_RETRIES) {
            console.warn(`⚠️ Retry ${googleDocsRetryCount}/${MAX_GOOGLE_DOCS_RETRIES} - waiting 5 more seconds...`);
            setTimeout(autoAnalyzeExistingText, 5000);
        } else {
            console.error('❌ Could not load Google Docs text automatically');
            console.log('💡 MANUAL ACTIVATION: Click in the document and press Ctrl+A, then start typing');
            
            // More aggressive keyboard listener
            let activationAttempts = 0;
            const MAX_ACTIVATION_ATTEMPTS = 10;
            
            const tryActivate = () => {
                activationAttempts++;
                console.log(`⌨️ Activation attempt ${activationAttempts}...`);
                
                setTimeout(() => {
                    // Try all extraction methods
                    let text = '';
                    
                    const methods = [
                        () => Array.from(document.querySelectorAll('.kix-wordhtmlgenerator-word-node')).map(n => n.textContent).join(''),
                        () => Array.from(document.querySelectorAll('.kix-lineview-text-block')).map(b => b.textContent).join(' '),
                        () => Array.from(document.querySelectorAll('.kix-paragraphrenderer span')).map(p => p.textContent).filter(t => t.trim()).join(' '),
                        () => {
                            const editor = document.querySelector('.kix-appview-editor') || document.querySelector('[role="textbox"]');
                            return editor ? (editor.innerText || editor.textContent || '') : '';
                        },
                        () => Array.from(document.querySelectorAll('.kix-appview-editor span')).map(s => s.textContent).filter(t => t.trim()).join('')
                    ];
                    
                    for (const method of methods) {
                        try {
                            text = method();
                            if (text && text.trim().length > 5) {
                                console.log('✅ Text extracted:', text.substring(0, 100));
                                break;
                            }
                        } catch (e) {
                            console.log('Method failed:', e.message);
                        }
                    }
                    
                    if (text.trim().length > 5) {
                        console.log('🎉 SUCCESS! Google Docs text found after keypress');
                        activeElement = document.querySelector('.kix-appview-editor') || 
                                       document.querySelector('[role="textbox"]') || 
                                       document.body;
                        analyzeGoogleDocsText(text);
                        setupGoogleDocsObserver('fallback');
                        
                        // Remove listener
                        document.removeEventListener('keyup', tryActivate);
                        document.removeEventListener('click', tryActivate);
                    } else if (activationAttempts < MAX_ACTIVATION_ATTEMPTS) {
                        console.log('⚠️ No text yet, will try again on next keypress');
                    } else {
                        console.error('❌ Gave up after', MAX_ACTIVATION_ATTEMPTS, 'attempts');
                        document.removeEventListener('keyup', tryActivate);
                        document.removeEventListener('click', tryActivate);
                    }
                }, 1000);
            };
            
            document.addEventListener('keyup', tryActivate);
            document.addEventListener('click', tryActivate);
            console.log('👂 Listening for keyboard/mouse activity...');
        }
    }

    function setupGoogleDocsObserver(extractionMethod) {
        const editorContainer = document.querySelector('.kix-appview-editor-container') || 
                               document.querySelector('.kix-appview-editor') ||
                               document.querySelector('.kix-page-paginated') ||
                               document.body;
        
        console.log('🔭 Observer watching:', editorContainer.className || editorContainer.tagName);
        console.log('🔭 Using extraction method:', extractionMethod);
        
        let lastText = '';
        
        const observer = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                // Re-extract using the same method that worked
                let newText = '';
                
                try {
                    switch(extractionMethod) {
                        case 'word-nodes':
                            newText = Array.from(document.querySelectorAll('.kix-wordhtmlgenerator-word-node')).map(n => n.textContent).join('');
                            break;
                        case 'lineview-blocks':
                            newText = Array.from(document.querySelectorAll('.kix-lineview-text-block')).map(b => b.textContent).join(' ');
                            break;
                        case 'paragraph-spans':
                            newText = Array.from(document.querySelectorAll('.kix-paragraphrenderer span')).map(p => p.textContent).filter(t => t.trim()).join(' ');
                            break;
                        case 'editor-innerText':
                            const editor = document.querySelector('.kix-appview-editor') || document.querySelector('[role="textbox"]');
                            newText = editor ? (editor.innerText || editor.textContent || '') : '';
                            break;
                        default:
                            newText = Array.from(document.querySelectorAll('.kix-appview-editor span')).map(s => s.textContent).filter(t => t.trim()).join('');
                    }
                } catch (e) {
                    console.error('Observer extraction error:', e);
                }
                
                if (newText && newText.trim().length > 5 && newText !== lastText) {
                    console.log('📝 Content changed in Google Docs');
                    console.log('📝 New length:', newText.length);
                    lastText = newText;
                    analyzeGoogleDocsText(newText);
                }
            }, 3000);
        });
        
        observer.observe(editorContainer, {
            childList: true,
            subtree: true,
            characterData: true
        });
        
        console.log('✅ Observer active');
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
            console.log('✓ Focused:', target.tagName);

            // 🔥 ADD THIS (one-time full scan)
            if (!target.__harperFullScanned) {
                target.__harperFullScanned = true;

                setTimeout(() => {
                    analyzeFullDocument(target);
                }, 1200);
            }

            // Existing behavior (DO NOT TOUCH)
            const text = getElementText(target);
            if (text && text.trim().length > 5) {
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

    function analyzeFullDocument(rootElement) {
        if (!rootElement) return;

        console.log('📄 Starting FULL document analysis');

        const blocks = [];

        const walker = document.createTreeWalker(
            rootElement,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let offset = 0;

        while (walker.nextNode()) {
            const node = walker.currentNode;

            if (!node.textContent || !node.textContent.trim()) continue;

            blocks.push({
                text: node.textContent,
                startOffset: offset
            });

            offset += node.textContent.length;
        }

        if (blocks.length === 0) {
            console.warn('⚠️ No text blocks found for full scan');
            return;
        }

        console.log(`📦 Sending ${blocks.length} blocks for full analysis`);

        chrome.runtime.sendMessage({
            type: "FULL_DOCUMENT_TEXT",
            payload: { blocks }
        });
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

    function positionSuggestionBox(element) {
        if (!suggestionBox || !element) return;
        
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Suggestion box dimensions (approximate)
        const boxWidth = 420;
        const boxHeight = 300; // estimated
        
        // Start with position below the element
        let top = rect.bottom + scrollTop + 10;
        let left = rect.left + scrollLeft;
        
        // Adjust horizontal position if box would go off-screen
        if (left + boxWidth > viewportWidth + scrollLeft) {
            // Align to right edge of viewport
            left = viewportWidth + scrollLeft - boxWidth - 20;
        }
        
        // If too far left, align to left edge
        if (left < scrollLeft + 10) {
            left = scrollLeft + 10;
        }
        
        // Adjust vertical position if box would go off-screen
        if (top + boxHeight > viewportHeight + scrollTop) {
            // Position above the element instead
            top = rect.top + scrollTop - boxHeight - 10;
            
            // If still off-screen, position at top of viewport
            if (top < scrollTop + 10) {
                top = scrollTop + 10;
            }
        }
        
        // Ensure it's within viewport
        if (top < scrollTop) {
            top = scrollTop + 10;
        }
        
        suggestionBox.style.top = top + 'px';
        suggestionBox.style.left = left + 'px';
        
        console.log(`📍 Box positioned at: top=${top}px, left=${left}px`);
        console.log(`📍 Element rect: top=${rect.top}, bottom=${rect.bottom}, left=${rect.left}`);
    }

    function displayIssueSuggestions(issue) {
        console.log('💡 Displaying suggestions...');
        
        if (!activeElement) {
            console.error('No active element');
            return;
        }
        
        const suggestions = getSuggestionsFromIssue(issue);
        console.log('Suggestions:', suggestions);
        
        // For better positioning, try to find the actual error location
        let positionElement = activeElement;
        
        // If we can find the exact text position, use that
        if (issue.offset !== undefined && issue.length !== undefined) {
            try {
                const text = getElementText(activeElement);
                const errorText = text.substring(issue.offset, issue.offset + issue.length);
                
                // For contenteditable or textareas, try to get exact position
                const tagName = activeElement.tagName?.toLowerCase();
                
                if (activeElement.isContentEditable) {
                    // Find the text node containing the error
                    const range = findRangeForOffset(activeElement, issue.offset, issue.length);
                    if (range) {
                        const rects = range.getClientRects();
                        if (rects.length > 0) {
                            // Create a temporary element at the error position
                            const tempDiv = document.createElement('div');
                            tempDiv.style.cssText = `
                                position: absolute;
                                left: ${rects[0].left}px;
                                top: ${rects[0].top}px;
                                width: ${rects[0].width}px;
                                height: ${rects[0].height}px;
                            `;
                            positionElement = tempDiv;
                            document.body.appendChild(tempDiv);
                            
                            positionSuggestionBox(positionElement);
                            populateSuggestionBox(issue, suggestions);
                            showSuggestionBox();
                            
                            // Remove temp element after positioning
                            setTimeout(() => tempDiv.remove(), 100);
                            
                            console.log('✅ Suggestion box positioned at error location');
                            return;
                        }
                    }
                }
            } catch (e) {
                console.warn('Could not find exact error position:', e);
            }
        }
        
        // Default positioning near the element
        positionSuggestionBox(positionElement);
        populateSuggestionBox(issue, suggestions);
        showSuggestionBox();
        
        console.log('✅ Suggestion box shown');
    }

    function findRangeForOffset(element, offset, length) {
        try {
            const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            let currentOffset = 0;
            
            while (walker.nextNode()) {
                const node = walker.currentNode;
                const nodeLength = node.textContent.length;
                
                if (currentOffset + nodeLength > offset) {
                    const range = document.createRange();
                    const startOffset = offset - currentOffset;
                    const endOffset = Math.min(startOffset + length, nodeLength);
                    
                    range.setStart(node, startOffset);
                    range.setEnd(node, endOffset);
                    
                    return range;
                }
                
                currentOffset += nodeLength;
            }
        } catch (e) {
            console.error('Error finding range:', e);
        }
        
        return null;
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
        
        // Create container
        const container = document.createElement('div');
        container.style.cssText = 'padding: 0; margin: 0;';
        
        // Header
        const header = document.createElement('div');
        header.style.cssText = 'margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;';
        header.innerHTML = `
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
            const contextDiv = document.createElement('div');
            contextDiv.style.cssText = 'background: #f5f5f5; padding: 8px; border-radius: 4px; font-size: 12px; color: #666; font-style: italic;';
            contextDiv.textContent = `Context: "${contextText}"`;
            header.appendChild(contextDiv);
        }
        
        container.appendChild(header);
        
        // Suggestions
        if (suggestions && suggestions.length > 0) {
            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.style.cssText = 'margin-top: 12px;';
            
            const sugTitle = document.createElement('div');
            sugTitle.style.cssText = 'color: #666; font-size: 12px; font-weight: 600; margin-bottom: 8px;';
            sugTitle.textContent = 'SUGGESTIONS:';
            suggestionsDiv.appendChild(sugTitle);
            
            suggestions.slice(0, 5).forEach((suggestion, index) => {
                const btn = document.createElement('button');
                btn.className = 'harper-sug-btn';
                btn.setAttribute('data-suggestion', suggestion);
                btn.style.cssText = `
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
                `;
                btn.textContent = suggestion;
                
                // Add event listener (not inline onclick)
                btn.addEventListener('click', () => {
                    console.log('Applying:', suggestion);
                    applySuggestionToElement(suggestion, issue);
                });
                
                btn.addEventListener('mouseenter', function() {
                    this.style.background = '#e3f2fd';
                    this.style.borderColor = '#2196F3';
                });
                
                btn.addEventListener('mouseleave', function() {
                    this.style.background = '#f8f9fa';
                    this.style.borderColor = '#dee2e6';
                });
                
                suggestionsDiv.appendChild(btn);
            });
            
            container.appendChild(suggestionsDiv);
        } else {
            const noSug = document.createElement('div');
            noSug.style.cssText = 'color: #999; font-style: italic; margin-top: 12px;';
            noSug.textContent = 'No suggestions available';
            container.appendChild(noSug);
        }
        
        // Navigation buttons (if multiple issues)
        if (totalIssues > 1) {
            const navDiv = document.createElement('div');
            navDiv.style.cssText = 'display: flex; gap: 8px; margin-top: 12px;';
            
            const prevBtn = document.createElement('button');
            prevBtn.textContent = '← Previous';
            prevBtn.style.cssText = `
                flex: 1 !important;
                padding: 8px !important;
                background: #e3f2fd !important;
                border: 1px solid #2196F3 !important;
                border-radius: 6px !important;
                color: #1976D2 !important;
                cursor: pointer !important;
                font-size: 13px !important;
                font-weight: 600 !important;
            `;
            
            if (currentIndex === 1) {
                prevBtn.disabled = true;
                prevBtn.style.opacity = '0.5';
                prevBtn.style.cursor = 'not-allowed';
            } else {
                prevBtn.addEventListener('click', () => {
                    displayIssueSuggestions(currentIssues[currentIndex - 2]);
                });
            }
            
            const nextBtn = document.createElement('button');
            nextBtn.textContent = 'Next →';
            nextBtn.style.cssText = `
                flex: 1 !important;
                padding: 8px !important;
                background: #e3f2fd !important;
                border: 1px solid #2196F3 !important;
                border-radius: 6px !important;
                color: #1976D2 !important;
                cursor: pointer !important;
                font-size: 13px !important;
                font-weight: 600 !important;
            `;
            
            if (currentIndex === totalIssues) {
                nextBtn.disabled = true;
                nextBtn.style.opacity = '0.5';
                nextBtn.style.cursor = 'not-allowed';
            } else {
                nextBtn.addEventListener('click', () => {
                    displayIssueSuggestions(currentIssues[currentIndex]);
                });
            }
            
            navDiv.appendChild(prevBtn);
            navDiv.appendChild(nextBtn);
            container.appendChild(navDiv);
        }
        
        // Dismiss button
        const dismissBtn = document.createElement('button');
        dismissBtn.textContent = 'Dismiss All';
        dismissBtn.style.cssText = `
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
        `;
        
        dismissBtn.addEventListener('click', () => {
            currentIssues = [];
            clearUnderlines();
            hideSuggestionBox();
        });
        
        dismissBtn.addEventListener('mouseenter', function() {
            this.style.background = '#f8f9fa';
        });
        
        dismissBtn.addEventListener('mouseleave', function() {
            this.style.background = 'transparent';
        });
        
        container.appendChild(dismissBtn);
        
        // Add to suggestion box
        suggestionBox.appendChild(container);
        
        console.log('✅ Box populated');
    }

    function getIssueIcon(type) {
        return type === 'grammar' ? '📝' : type === 'tone' ? '🎨' : '📚';
    }

    function getIssueTypeLabel(type) {
        return type === 'grammar' ? 'Grammar Issue' : type === 'tone' ? 'Tone' : 'Terminology';
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