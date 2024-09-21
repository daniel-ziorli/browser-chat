import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import TurndownService from 'turndown';

export const readLocalStorage = async (key) => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], function (result) {
      if (result[key] === undefined) {
        reject();
      } else {
        resolve(result[key]);
      }
    });
  });
};

export const writeLocalStorage = async (key, value) => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, function () {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
};

export const getPageContentFromActiveTab = async () => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "get_content" }, async (response) => {
        let context = '';
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response.success) {
          if (response.transcript) {
            context = response.transcript;
          } else {
            const turndownService = new TurndownService();
            const markdown = turndownService.turndown(response.content);
            context = markdown;
          }
        } else {
          reject(new Error("Error:", response.error));
        }
        resolve(context);
      });
    });
  });
};

export const getHtmlFromActiveTab = async () => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "get_html" }, async (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response.success) {
          resolve(response.html);
        } else {
          reject(new Error("Error:", response.error));
        }
      });
    });
  });
};

export const setElementValue = async (id, name, value) => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "set_element_value", id, value, name }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response.success) {
          resolve();
        } else {
          reject(new Error("Error:", response.error));
        }
      });
    });
  });
};

export async function router(input, chatHistory) {
  return new Promise((resolve, reject) => {
    return resolve({
      route: 'fill_inputs',
    })
  })
  const prompt = `
    You are an expert at choosing the correct route for the user's input and the chat history.
    
    <chat_history>
    ${chatHistory}
    </chat_history>

    <input>
    ${input}
    </input>
    
    Here are the available routes:
    <routes>
      <route>
        <name>fill_inputs</name>
        <description>Use this route if the user is trying to fill out input fields on a website.</description>
      </route>
      <route>
        <name>default</name>
        <description>If none of the other routes match, use this route.</description>
      </route>
    </routes>

    Follow theses instructions:
    1. Read the user's input
    2. Read the chat history
    3. Read the available routes
    4. Use the scratch pad to think about the user's input and the chat history. Think about what the user is trying to do and what the best route is to complete the user's input.
      think about the users intentions, goal, or purpose based on the input and the chat history.
      think about all the possible routes that the user might want to use.
      think about the best route to go down to complete the user's input.
    5. Based on the user's input and the available routes, choose the best route.
      Use fill_inputs if the user is trying to fill input fields on a website. They will typically use words like complete, fill, populate, enter, or enter.
      For everything else, use default.

    <fill_input_examples>
      <example>
        <input>Complete the form</input>
        <route>fill_inputs</route>
      </example>
      <example>
        <input>Fill out the application</input>
        <route>fill_inputs</route>
      </example>
      <example>
        <input>Enter my personal information</input>
        <route>fill_inputs</route>
      </example>
      <example>
        <input>Populate the inputs</input>
        <route>fill_inputs</route>
      </example>
      <example>
        <input>Complete the application</input>
        <route>fill_inputs</route>
      </example>
    </fill_input_examples>

    <default_route_examples>
      <example>
        <input>What are the pros and cons of the product</input>
        <route>default</route>
      </example>
      <example>
        <input>Summarize this article</input>
        <route>default</route>
      </example>
    </default_route_examples>

    respond in JSON with the following format:
    {
      "scratch_pad": "a scratch pad that you can use to think and reason about your decision.",
      "route": ['fill_inputs' | 'default'],
    }
  `;

  const result = await llmCall({ prompt, json_output: true });
  return result;
}

export async function llmCall({
  prompt,
  system_prompt,
  temperature,
  json_output,
  stream,
  model,
}) {
  system_prompt = system_prompt === undefined ? 'You are a helpful assistant, tasked with helping users browse the web more effectively.' : system_prompt;
  temperature = temperature === undefined ? 1.0 : temperature;
  json_output = json_output === undefined ? false : json_output;
  stream = stream === undefined ? false : stream;
  model = model === undefined ? "gemini-1.5-flash" : model;

  let apiKey = '';
  try {
    apiKey = await readLocalStorage('apiKey');
  } catch (error) {
    console.log(error);
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const safetySettings = [
    {
      "category": HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      "threshold": HarmBlockThreshold.BLOCK_NONE,
    },
    {
      "category": HarmCategory.HARM_CATEGORY_HARASSMENT,
      "threshold": HarmBlockThreshold.BLOCK_NONE,
    },
    {
      "category": HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      "threshold": HarmBlockThreshold.BLOCK_NONE,
    },
    {
      "category": HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      "threshold": HarmBlockThreshold.BLOCK_NONE,
    }
  ]

  const modelParams = {
    model,
    safetySettings,
    systemInstruction: system_prompt,
    generationConfig: {
      temperature: temperature,
      responseMimeType: json_output ? "application/json" : "text/plain",
    },
  }
  const gen_model = genAI.getGenerativeModel(modelParams)
  const chat = gen_model.startChat();

  if (json_output) {
    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    try {
      const json = JSON.parse(response.text());
      return json;
    } catch (error) {
      console.error(error);
      console.error(response.text());
      return false;
    }
  }

  if (!stream) {
    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    return response.text();
  }

  const result = chat.sendMessageStream(prompt)
  return result
}

export function cleanHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function cleanNode(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.tagName)) {
        node.parentNode.removeChild(node);
        return;
      }

      const attrs = node.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        const attrName = attrs[i].name;
        if (!['id', 'class', 'name', 'placeholder', 'type', 'value', 'label', 'ariaLabel'].includes(attrName)) {
          node.removeAttribute(attrName);
        }
      }

      Array.from(node.childNodes).forEach(cleanNode);
    } else if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = node.textContent.trim();
      if (node.textContent === '') {
        node.parentNode.removeChild(node);
      }
    } else {
      node.parentNode.removeChild(node);
    }
  }

  cleanNode(doc.body);
  return doc.body.innerHTML;
}