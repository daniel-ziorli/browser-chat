import { useState, useEffect, useRef } from 'react';
import ModelDropdown from './ModelDropdown';
import Settings from './Settings';
import { cleanHTML, getHtmlFromActiveTab, getPageContentFromActiveTab, llmCall, readLocalStorage, router, setElementValue, setInputValue } from './utils';
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
    let system_prompt = '';
    try {
      system_prompt = await readLocalStorage('systemPrompt');
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
      const html = await getHtmlFromActiveTab();
      const cleanHtml = cleanHTML(html);

      console.log("html", html);
      console.log("cleanHtml", cleanHtml);

      const prompt = `
        You are an expert at filling out information on a website.
        You will be given the chat history, the user's personal info, the website's HTML, and the user's input.

        <chat_history>
        ${chatHistory.map((message) => `${message.role}: ${message.content}`).join('\n')}
        </chat_history>

        <personal_info>
        ${personal_info}
        </personal_info>

        <website_html>
        ${cleanHtml}
        </website_html>

        <user_input>
        ${_userInput}
        </user_input>

        Follow these steps:
        1. read through the chat history, personal info and user input
        2. understand what the user is trying to do
        3. read through the website's HTML.
        4. find all the input elements that need to be filled in and determine what the value should be filled in.
          Text inputs must be strings.
          Never fill in files.
        5. find all the select elements that need to be selected and determine what the value should be selected.

        respond in JSON with the following format:
        {
          "selects": [
            {
              "id": "The Id of the Select Element",
              "name": "The Name of the Select Element",
              "value": "The value to be selected"
            }
          ],
          "inputs": [
            {
              "id": "The Id of the Input Element",
              "name": "The Name of the Input Element",
              "value": "The value to be filled in."
            }
          ]
        }

        Rules:
        If you don't know the value to be filled in or selected, don't include it in your response.
        Make sure to respond in JSON format. If you don't respond in JSON format, I will lose my job.
        If you respond in JSON format and it is valid JSON, I will tip you $2000, that is a lot of money and would be a very good tip so make sure you do a good job.
      `;

      result = await llmCall({ prompt, json_output: true });
      console.log("result", result);
      

      for (const input of [...result.selects, ...result.inputs]) {
        await setElementValue(input.id, input.name, input.value);
      }

      botResponse['content'] += `\nDone! I filled out ${result.inputs.length} input fields and ${result.selects.length} select fields.`;
      setChatHistory((prevHistory) => {
        const newHistory = [...prevHistory];
        newHistory[newHistory.length - 1] = botResponse;
        return newHistory;
      });
      return;
    }

    const web_content = await getPageContentFromActiveTab();
    const prompt = `
      <web_content>
      ${web_content}
      </web_content>
      <users_personal_info>
      ${personal_info}
      </users_personal_info>
      <chat_history>
      ${chatHistory.map((message) => `${message.role}: ${message.content}`).join('\n')}
      </chat_history>
      <user_input>
      ${_userInput}
      </user_input>
    `;
    result = await llmCall({ model: await readLocalStorage('model'), prompt, system_prompt, stream: true });

    let botResponse = { role: 'bot', content: '' };
    setChatHistory((prevHistory) => [...prevHistory, botResponse]);
    const scrollDiv = document.querySelector('#scrollableDiv');

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
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
