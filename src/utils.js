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

export const getContextFromActiveTab = async (markdown = false) => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "get_html" }, async (response) => {
                let context = '';
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else if (response.success) {
                    if (response.transcript) {
                        context = response.transcript;
                    } else {
                        context = response.content;
                        if (markdown) {
                            const turndownService = new TurndownService();
                            const markdown = turndownService.turndown(response.content);
                            context = markdown;
                        }
                    }
                } else {
                    reject(new Error("Error:", response.error));
                }
                resolve(context);
            });
        });
    });
};

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
    model = model === undefined ? "gemini-1.5-flash-latest" : model;

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