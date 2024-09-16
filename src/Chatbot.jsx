import { useState, useEffect, useRef } from 'react';
import ModelDropdown from './ModelDropdown';
import Settings from './Settings';
import { getHtmlFromActiveTab, getPageContentFromActiveTab, llmCall, readLocalStorage, router, setElementValue, setInputValue } from './utils';
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
      system_prompt += `All responses must be in markdown format unless another format is specified. Links must be in the following format [link](link).`;
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
    console.log('router_result', router_result);

    let result;
    if (router_result.route === 'fill_inputs') {
      let botResponse = { role: 'bot', content: `Let me help you fill those out.` };
      setChatHistory((prevHistory) => [...prevHistory, botResponse]);
      const context = await getPageContentFromActiveTab();
      const html = await getHtmlFromActiveTab();
      const parser = new DOMParser();
      const document = parser.parseFromString(html, 'text/html');
      const textInputs = document.querySelectorAll('input');
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
        ${allInputs.map((input) => `
          <input>
            <input_element_id>${input.id}</input_element_id>
            <input_element_name>${input.name}</input_element_name>
            <input_element_placeholder>${input.placeholder}</input_element_placeholder>
          </input>`).join('\n')}
        </website_inputs>

        <website_selects>
          ${selects.map((select) => `
          <select>
            <select_element_id>${select.id}</select_element_id>
            <select_element_name>${select.name}</select_element_name>
            <options>
              ${select.options.map((option) => `<option>${option.label}</option>`).join('\n')}
            </options>
          </select>`.join('\n'))}
        </website_selects>

        <user_input>
        ${_userInput}
        </user_input>

        Follow these steps:
        1. read through the chat history, context, personal info and user input
            understand what the user is trying to do.
            figure out what information should be filled where.
        2. for each website input, read the input_element_id, input_element_name and input_element_placeholder
            based on the input_element_id, input_element_name and input_element_placeholder figure out what the input is expecting and choose a value to fill in.
        3. for each website select, read the select_element_id, select_element_name and options
            based on the select_element_id, select_element_name and options figure out what the select is expecting and choose a value to fill in.

        respond in JSON with the following format:
        {
          "selects": [
            {
              "id": "The Id of the HTML Element",
              "name": "The Name of the HTML Element",
              "value": "The value to be filled in. You can use any of the following to fill out the value: user input, context, chat history, personal info"
            }
          ],
          "inputs": [
            {
              "id": "The Id of the HTML Element",
              "name": "The Name of the HTML Element",
              "value": "The value to be filled in. You can use any of the following to fill out the value: user input, context, chat history, personal info"
            }
          ]
        }
      `;

      result = await llmCall({ prompt, json_output: true });
      console.log("fill inputs result", result);

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
