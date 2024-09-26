import { useState, useEffect, useRef } from 'react';
import ModelDropdown from './ModelDropdown';
import Settings from './Settings';
import { getPageContentFromActiveTab, llmCall, readLocalStorage } from './utils';
import Markdown from 'react-markdown';

const ChatBot = () => {
  const [chatHistory, setChatHistory] = useState([]);
  const [userInput, setUserInput] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current.focus();
    inputRef.current.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }, []);

  const handleUserInputChange = (event) => {
    setUserInput(event.target.value);
  };

  const handleSendMessage = async () => {
    let system_prompt = undefined;
    try {
      system_prompt = await readLocalStorage('systemPrompt');
    } catch {
      system_prompt = undefined;
    }

    const _userInput = userInput;
    setUserInput('');
    const newMessage = { role: 'user', content: _userInput };
    setChatHistory((prevHistory) => [...prevHistory, newMessage]);

    const web_content = await getPageContentFromActiveTab();
    console.log(web_content);
    
    const prompt = `
      I will be giving you the web content of a website, along with chat history and the user input.
      <web_content>
      ${web_content}
      </web_content>
      <chat_history>
      ${chatHistory.map((message) => `${message.role}: ${message.content}`).join('\n')}
      </chat_history>
      <user_input>
      ${_userInput}
      </user_input>

      Your task is to generate a response to the user input using the web content and chat history as context.
    `;
    const result = await llmCall({ model: await readLocalStorage('model'), temperature: 0.7, prompt, system_prompt, stream: true });

    let botResponse = { role: 'bot', content: '' };
    setChatHistory((prevHistory) => [...prevHistory, botResponse]);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      botResponse.content += chunkText;
      setChatHistory((prevHistory) => {
        const newHistory = [...prevHistory];
        newHistory[newHistory.length - 1] = botResponse;
        return newHistory;
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
        <div className="flex flex-row justify-end gap-4">
          <ModelDropdown />
          <div>
            <button
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded py-2 px-4"
              onClick={handleClearChat}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
      <div className="flex-grow p-4 overflow-y-auto" id='scrollableDiv'>
        {chatHistory.map((message, index) => (
          <div key={index} className="flex flex-col gap-2 mb-2">
            {message.role !== 'user' ? (
              <Markdown className="p-2 w-[100%] text-white"components={{
                a(props) {
                  // eslint-disable-next-line react/prop-types
                  const { href, children, ...rest } = props;
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
                      {children}
                    </a>
                  );
                },
              }}
            >{message.content}
            </Markdown>
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
          id="userInput"
          tabIndex="1"
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
