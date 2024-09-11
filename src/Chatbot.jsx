import { useState, useEffect, useRef } from 'react';
import Settings from './Settings';
import { getContextFromActiveTab, llmCall, readLocalStorage } from './utils';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import Markdown from 'react-markdown'
import TurndownService from 'turndown';

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

const ChatBot = () => {
  const [chatHistory, setChatHistory] = useState([]);
  const [userInput, setUserInput] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current.focus(), 250);
  }, []);

  const handleUserInputChange = (event) => {
    setUserInput(event.target.value);
  };

  const handleSendMessage = async () => {
    let system_prompt = '';
    try {
      system_prompt = await readLocalStorage('systemPrompt');
    } catch {
      system_prompt = 'You are a helpful assistant, tasked with helping users browse the web more effectively.';
    }

    const _userInput = userInput;
    setUserInput('');
    const newMessage = { role: 'user', content: _userInput };
    setChatHistory((prevHistory) => [...prevHistory, newMessage]);

    const context = await getContextFromActiveTab(true);
    console.log("Context:", context);

    const prompt = `
      <context>
      ${context}
      </context>

      <chat_history>
      ${chatHistory.map((message) => `${message.role}: ${message.content}`).join('\n')}
      </chat_history>
      
      <input>
      ${_userInput}
      </input>
    `;
    
    const result = await llmCall({ prompt, system_prompt, stream: true });

    let botResponse = { role: 'bot', content: '' };
    setChatHistory((prevHistory) => [...prevHistory, botResponse]);
    const scrollDiv = document.querySelector('#scrollableDiv');

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      console.log(chunkText);
      botResponse.content += chunkText;
      setChatHistory((prevHistory) => {
        const newHistory = [...prevHistory];
        newHistory[newHistory.length - 1] = botResponse;
        return newHistory;
      });
      scrollDiv.scrollTo({
        top: scrollDiv.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const handleClearChat = () => {
    setChatHistory([]);
  };

  return (
    <div className="h-[100vh] w-[100vw] flex flex-col p-4 bg-[#181818]">
      <div className="flex flex-row justify-between mb-4">
        <Settings />
        <button
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg px-4 py-2"
          onClick={handleClearChat}
        >
          Clear Chat
        </button>
      </div>
      <div className="flex-grow p-4 overflow-y-auto" id='scrollableDiv'>
        {chatHistory.map((message, index) => (
          <div key={index} className="flex flex-col gap-2 mb-2">
            {message.role !== 'user' ? (
              <Markdown className="p-2 w-[100%] text-white">{message.content}</Markdown>
            ) : (
              <div
                className="bg-[#202020] px-4 py-2 rounded-lg max-w-[80%] self-end text-white"
              >
                {message.content}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="w-full flex flex-row gap-2 pt-2">
        <input
          type="text"
          className="flex-grow px-4 py-2 bg-[#181818] border border-white rounded-lg text-white"
          placeholder="Type your message..."
          value={userInput}
          onChange={handleUserInputChange}
          ref={inputRef}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSendMessage();
            }
          }}
        />
        <button
          className="w-[80px] ml-2 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg"
          onClick={handleSendMessage}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatBot;
