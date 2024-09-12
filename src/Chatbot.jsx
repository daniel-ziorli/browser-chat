import { useState, useEffect, useRef } from 'react';
import Settings from './Settings';
import { getHtmlFromActiveTab, getPageContentFromActiveTab, llmCall, readLocalStorage, router, setElementValue, setInputValue } from './utils';
import Markdown from 'react-markdown';

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
      system_prompt += `All responses must be in markdown format. Links must be in the following format [link](link).`;
    } catch {
      system_prompt = 'You are a helpful assistant, tasked with helping users browse the web more effectively.';
    }

    let personal_info = '';
    try {
      personal_info = await readLocalStorage('personalInfo');
    } catch {
      personal_info = '';
    }

    const _userInput = userInput;
    setUserInput('');
    const newMessage = { role: 'user', content: _userInput };
    setChatHistory((prevHistory) => [...prevHistory, newMessage]);

    const router_result = await router(_userInput);

    let result;
    if (router_result.route === 'fill_inputs') {
      let botResponse = { role: 'bot', content: `Let me help you fill those out.` };
      setChatHistory((prevHistory) => [...prevHistory, botResponse]);
      const context = await getPageContentFromActiveTab();
      const html = await getHtmlFromActiveTab();
      const parser = new DOMParser();
      const document = parser.parseFromString(html, 'text/html');
      const textInputs = document.querySelectorAll('input[type="text"]');
      const inputAreas = document.querySelectorAll('textarea');
      const selects = [...document.querySelectorAll('select')];
      const allInputs = [...textInputs, ...inputAreas];

      const prompt = `
        You are an expert at filling out input fields on a website.

        <chat_history>
        ${chatHistory.map((message) => `${message.role}: ${message.content}`).join('\n')}
        </chat_history>

        <context>
        ${context}
        </context>

        <personal_info>
        ${personal_info}
        </personal_info>

        <website_inputs>
        ${allInputs.map((input) => `Id: ${input.id} Name: ${input.name} Placeholder: ${input.placeholder}`).join('\n')}
        </website_inputs>

        <website_selects>
        ${selects.map((select) => `Id: ${select.id} Options: ${selects.map((option) => option.label).join(', ')}`).join('\n')}
        </website_selects>

        <user_input>
        ${_userInput}
        </user_input>

        respond in JSON with the following format:
        {
          "selects": [
            {
              "id": "The Elements Id",
              "value": "Selected option value."
            }
          ],
          "inputs": [
            {
              "id": "The Elements Id",
              "value": "Value to be set."
            }
          ]
        }
      `;

      result = await llmCall({ prompt, json_output: true });
      console.log("fill inputs result", result);

      for (const input of [...result.selects, ...result.inputs]) {
        await setElementValue(input.id, input.value);
      }

      botResponse['content'] += `\nDone! I filled out ${result.inputs.length} input fields and ${result.selects.length} select fields.`;
      setChatHistory((prevHistory) => {
        const newHistory = [...prevHistory];
        newHistory[newHistory.length - 1] = botResponse;
        return newHistory;
      });
      return;
    }

    const context = await getPageContentFromActiveTab();
    const prompt = `
      <context>
      ${context}
      </context>
      <personal_info>
      ${personal_info}
      </personal_info>
      <chat_history>
      ${chatHistory.map((message) => `${message.role}: ${message.content}`).join('\n')}
      </chat_history>
      <user_input>
      ${_userInput}
      </user_input>
    `;
    result = await llmCall({ prompt, system_prompt, stream: true });

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
