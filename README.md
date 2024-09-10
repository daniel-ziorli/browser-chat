# Browser Chat

Browser Chat is a Chrome extension that provides a chatbot interface for
interacting with the user through a web browser, with their current tabs
context. It leverages the power of React and Vite for development.

## Features

- Chatbot Interface: Users can send messages to the chatbot and receive
  responses.
- API Key and System Prompt Storage: The extension stores the API key and system
  prompt in the browser's local storage.
- HTML Content Retrieval: The extension retrieves the HTML content of the active
  tab in the browser using the `chrome.tabs.sendMessage` API.
- Youtube Transcript Retrieval: The extension is also able to read the
  transcript of youtube videos to provide context to the LLM.
- Settings: Users can customize the system prompt and API key through the
  settings modal.
- Error Handling: The extension handles various error scenarios, such as when
  there is an issue retrieving the HTML content or when there is an error with
  the Google Generative AI API.

## Getting Started

1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Open Chrome and go to `chrome://extensions`
5. Enable Developer Mode
6. Click on "Load unpacked" and select the dist folder
7. Pin the extension

## Usage

1. Open a web page in Chrome
2. Click on the Browser Chat extension icon in the toolbar
3. Open settings and add your Google API key from
   [here](https://aistudio.google.com/app/apikey) (this is stored locally)
4. Start chatting with the chatbot!
