console.log('content.js');

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
        console.log('request', request);

        if (!element) {
            console.log('selector', `[name="${request.name}"]`);
            element = document.querySelector(`[name="${request.name}"]`);
        }
        console.log('Element:', element);

        if (element) {
            if (element.tagName === 'SELECT') {
                const options = element.options;
                for (let i = 0; i < options.length; i++) {
                    if (options[i].label === request.value) {
                        element.value = options[i].value;
                        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                        break;
                    }
                }
            }
            else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.value = request.value;
                const event = new Event('input', { bubbles: true, cancelable: true });
                event.simulated = true;
                element.dispatchEvent(event);
                element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            }
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
    console.log(transcriptContainer);

    const transcriptEntries = transcriptContainer.querySelectorAll('ytd-transcript-segment-renderer');
    console.log('Transcript entries:', transcriptEntries);

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