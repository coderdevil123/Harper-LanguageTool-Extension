(function() {
    'use strict';
    
    console.log("🚀 Harper-LT: content script loaded");

    let activeElement = null;
    let suggestionBox = null;
    let currentIssues = [];
    let debounceTimer = null;
    let isEnabled = true;

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
        
        // Listen for messages from background
        chrome.runtime.onMessage.addListener(handleMessage);
        
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
            
            // Show a test suggestion box
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

    function handleFocusIn(e) {
        const target = e.target;
        if (isEditableElement(target)) {
            activeElement = target;
            console.log('✓ Focused:', target.tagName, target.type || '', target.className);
        }
    }

    function handleInput(e) {
        const target = e.target;
        if (!isEditableElement(target) || !isEnabled) return;
        
        activeElement = target;
        const text = getElementText(target);
        
        console.log('⌨️ Input detected, length:', text.length);
        
        // Debounce the analysis
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            console.log('⏰ Analyzing after debounce...');
            analyzeText(target);
        }, 1500);
    }

    function handleClick(e) {
        if (suggestionBox && !suggestionBox.contains(e.target) && e.target !== activeElement) {
            hideSuggestionBox();
        }
    }

    function isEditableElement(element) {
        if (!element) return false;
        
        const tagName = element.tagName.toLowerCase();
        
        if (tagName === 'input') {
            const type = (element.type || 'text').toLowerCase();
            const editableTypes = ['text', 'email', 'search', 'url', 'tel', 'password'];
            return editableTypes.includes(type);
        }
        
        if (tagName === 'textarea') return true;
        if (element.isContentEditable) return true;
        
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
        
        // Wake up service worker first
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
    }

    function getElementText(element) {
        if (!element) return '';
        
        const tagName = element.tagName.toLowerCase();
        
        if (tagName === 'input' || tagName === 'textarea') {
            return element.value || '';
        } else if (element.isContentEditable) {
            return element.textContent || element.innerText || '';
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

    function handleResults(results) {
        console.log('📊 Processing results...');
        console.log('Grammar:', results.grammar?.length || 0);
        console.log('Harper tone:', results.harper?.tone?.length || 0);
        console.log('Harper terminology:', results.harper?.terminology?.length || 0);
        
        currentIssues = [];
        
        if (results.grammar && Array.isArray(results.grammar)) {
            results.grammar.forEach(issue => {
                currentIssues.push({ ...issue, type: 'grammar' });
            });
        }
        
        if (results.harper) {
            if (results.harper.tone && Array.isArray(results.harper.tone)) {
                results.harper.tone.forEach(issue => {
                    currentIssues.push({ ...issue, type: 'tone' });
                });
            }
            if (results.harper.terminology && Array.isArray(results.harper.terminology)) {
                results.harper.terminology.forEach(issue => {
                    currentIssues.push({ ...issue, type: 'terminology' });
                });
            }
        }
        
        console.log('✅ Total issues:', currentIssues.length);
        
        if (currentIssues.length > 0 && activeElement) {
            console.log('🎯 Displaying first issue');
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
    }

    function populateSuggestionBox(issue, suggestions) {
        if (!suggestionBox) {
            console.error('Suggestion box missing!');
            return;
        }
        
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
        
        let html = `
            <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">
                <div style="font-weight: 700; color: #2c3e50; margin-bottom: 6px; font-size: 15px;">
                    ${getIssueIcon(issue.type)} ${getIssueTypeLabel(issue.type)}
                </div>
                <div style="color: #555; font-size: 13px; margin-bottom: 10px;">
                    ${escapeHtml(issueMessage)}
                </div>
                <div style="background: #fff3cd; padding: 10px; border-radius: 6px; border-left: 4px solid #ffc107; color: #856404; font-size: 13px; margin-bottom: 8px;">
                    <strong>Error:</strong> <span style="background: #ffe082; padding: 2px 4px; border-radius: 3px; font-weight: 600;">${escapeHtml(errorText)}</span>
                </div>
        `;
        
        // Show context if available
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
                Dismiss
            </button>
        `;
        
        suggestionBox.innerHTML = html;
        
        const buttons = suggestionBox.querySelectorAll('.harper-sug-btn');
        buttons.forEach(btn => {
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
        
        const dismissBtn = suggestionBox.querySelector('#harper-dismiss');
        if (dismissBtn) {
            dismissBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
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
        
        // LanguageTool provides context with offset and length
        if (issue.context) {
            offset = issue.context.offset;
            length = issue.context.length;
            errorText = issue.context.text.substring(offset, offset + length);
            console.log('Error text from context:', errorText, 'at offset:', offset, 'length:', length);
        } else if (issue.offset !== undefined && issue.length !== undefined) {
            // Direct offset and length
            offset = issue.offset;
            length = issue.length;
            errorText = fullText.substring(offset, offset + length);
            console.log('Error text from offset/length:', errorText);
        } else {
            // Fallback: use the whole context text
            errorText = issue.text || issue.context?.text || '';
            console.log('Error text (fallback):', errorText);
        }
        
        if (!errorText) {
            console.error('No error text found');
            return;
        }
        
        // For LanguageTool with context offset, we need to find the actual position in full text
        let newText;
        if (issue.offset !== undefined && issue.length !== undefined) {
            // We have absolute position in the text
            const beforeError = fullText.substring(0, issue.offset);
            const afterError = fullText.substring(issue.offset + issue.length);
            newText = beforeError + suggestion + afterError;
            console.log('Replacing using offset:', issue.offset, 'length:', issue.length);
        } else {
            // Find and replace the first occurrence
            const errorIndex = fullText.indexOf(errorText);
            if (errorIndex === -1) {
                console.error('Could not find error text in full text');
                // Try partial match
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
        
        const tagName = activeElement.tagName.toLowerCase();
        
        if (tagName === 'input' || tagName === 'textarea') {
            const cursorPos = activeElement.selectionStart;
            activeElement.value = newText;
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            // Restore cursor position
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
        void suggestionBox.offsetHeight;


    function hideSuggestionBox() {
        if (suggestionBox) {
            console.log('Hiding suggestion box');
            suggestionBox.style.display = 'none';
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
        
        // LanguageTool provides context with offset and length
        if (issue.context) {
            offset = issue.context.offset;
            length = issue.context.length;
            errorText = issue.context.text.substring(offset, offset + length);
            console.log('Error text from context:', errorText, 'at offset:', offset, 'length:', length);
        } else if (issue.offset !== undefined && issue.length !== undefined) {
            // Direct offset and length
            offset = issue.offset;
            length = issue.length;
            errorText = fullText.substring(offset, offset + length);
            console.log('Error text from offset/length:', errorText);
        } else {
            // Fallback: use the whole context text
            errorText = issue.text || issue.context?.text || '';
            console.log('Error text (fallback):', errorText);
        }
        
        if (!errorText) {
            console.error('No error text found');
            return;
        }
        
        // For LanguageTool with context offset, we need to find the actual position in full text
        let newText;
        if (issue.offset !== undefined && issue.length !== undefined) {
            // We have absolute position in the text
            const beforeError = fullText.substring(0, issue.offset);
            const afterError = fullText.substring(issue.offset + issue.length);
            newText = beforeError + suggestion + afterError;
            console.log('Replacing using offset:', issue.offset, 'length:', issue.length);
        } else {
            // Find and replace the first occurrence
            const errorIndex = fullText.indexOf(errorText);
            if (errorIndex === -1) {
                console.error('Could not find error text in full text');
                // Try partial match
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
        
        const tagName = activeElement.tagName.toLowerCase();
        
        if (tagName === 'input' || tagName === 'textarea') {
            const cursorPos = activeElement.selectionStart;
            activeElement.value = newText;
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            // Restore cursor position
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
        
        if (currentIssues.length > 0) {
            setTimeout(() => displayIssueSuggestions(currentIssues[0]), 500);
        }
    }

    function applySuggestion(payload) {
        console.log('Apply suggestion from external source:', payload);
        // Handle if needed
    }

    function showSuggestions(payload) {
        console.log('Show suggestions from external source:', payload);
        // Handle if needed
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Test function - remove in production
    window.testHarperLT = function() {
        console.log('🧪 Testing Harper-LT');
        console.log('Active element:', activeElement);
        console.log('Suggestion box:', suggestionBox);
        console.log('Current issues:', currentIssues);
        
        if (activeElement) {
            const text = getElementText(activeElement);
            console.log('Active element text:', text);
        }
    };
    
    console.log('✅ Content script fully loaded. Type window.testHarperLT() to test.');
;
