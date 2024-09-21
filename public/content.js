chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'get_content') {
        if (document.location.hostname.includes('www.youtube.com')) {
            extractYouTubeTranscript()
                .then(transcript => {
                    sendResponse({ success: true, transcript: transcript });
                })
                .catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
            return true;
        } else {
            sendResponse({ success: true, content: document.body.outerHTML });
            return true;
        }
    }

    if (request.action === 'get_html') {
        sendResponse({ success: true, html: document.body.outerHTML });
        return true;
    }

    if (request.action === 'set_element_value') {
        let element = document.getElementById(request.id);

        if (!element) {
            element = document.querySelector(`[name="${request.name}"]`);
        }

        if (!element) {
            sendResponse({ success: false, error: 'Element not found' });
            return true;
        }

        if (element.tagName === 'SELECT') {
            for (let i = 0; i < element.options.length; i++) {
                if (element.options[i].value === request.value) {
                    element.options.selectedIndex = i;
                    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                    break;
                }
            }
        } else if (element.tagName === 'INPUT' && element.type === 'radio') {
            const radioButtons = document.querySelectorAll(`input[type="radio"][name="${element.name}"]`);
            radioButtons.forEach(radio => {
                radio.checked = radio.value === request.value;
                if (radio.checked) {
                    radio.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                }
            });
        } else if (element.tagName === 'INPUT' && element.type === 'checkbox') {
            element.checked = request.value === true || request.value === 'true';
            element.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value = request.value;
            const event = new Event('input', { bubbles: true, cancelable: true });
            event.simulated = true;
            element.dispatchEvent(event);
            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        }
        sendResponse({ success: true });
        return true;
    }

    return false;
});

async function extractYouTubeTranscript() {
    const transcriptButton = await waitForElement('[aria-label="Show transcript"]');
    transcriptButton.click();

    const transcriptContainer = await waitForElement('#segments-container');
    const transcriptEntries = transcriptContainer.querySelectorAll('ytd-transcript-segment-renderer');

    let transcript = '';

    transcriptEntries.forEach(entry => {
        const text = entry.querySelector('.segment-text').textContent.trim();
        const timestamp = entry.querySelector('.segment-timestamp').textContent.trim();
        transcript += `${timestamp}: ${text}\n`;
    });

    return transcript;
}

function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout waiting for element: ${selector}`));
        }, timeout);
    });
}