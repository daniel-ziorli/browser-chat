import { useState, useRef, useEffect } from 'react';
import { readLocalStorage, writeLocalStorage } from './utils';

const SettingsModal = () => {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const modalRef = useRef(null);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleApiKeyChange = (event) => {
    setApiKey(event.target.value);
  };

  const handleSystemPromptChange = (event) => {
    setSystemPrompt(event.target.value);
  };

  const handleSave = async () => {
    // Save the API key to local storage or make an API request
    await writeLocalStorage('apiKey', apiKey);
    await writeLocalStorage('systemPrompt', systemPrompt);
    handleClose();
  };

  const handleClickOutside = (event) => {
    if (modalRef.current && !modalRef.current.contains(event.target)) {
      handleClose();
    }
  };

  useEffect(() => {
    const loadSystemPrompt = async () => {
      try {
        const storedSystemPrompt = await readLocalStorage('systemPrompt');
        setSystemPrompt(storedSystemPrompt);
      } catch {
        const defaultSystemPrompt = `You are a helpful assistant`;
        setSystemPrompt(defaultSystemPrompt);
      }

      try {
        const storedApiKey = await readLocalStorage('apiKey');
        setApiKey(storedApiKey);
      } catch (error) {
        console.log(error);
      }
    };
    if (open) {
      loadSystemPrompt();
    }
  }, [open]);

  return (
    <div>
      <button onClick={handleOpen} className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
        Open Settings
      </button>
      {open && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center" onClick={handleClickOutside}>
          <div className="bg-gray-800 p-6 rounded shadow-lg w-full max-w-md" ref={modalRef}>
            <button className="absolute top-0 right-0 p-2" onClick={handleClose}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-2xl font-bold mb-4 text-white">Settings</h2>
            <input
              type="text"
              value={apiKey}
              onChange={handleApiKeyChange}
              className="bg-gray-700 border border-gray-600 rounded py-2 px-4 w-full mb-4 text-white"
              placeholder="API Key"
            />
            <textarea
              value={systemPrompt}
              onChange={handleSystemPromptChange}
              className="bg-gray-700 border border-gray-600 rounded py-2 px-4 w-full mb-4 text-white resize-none"
              placeholder="System Prompt"
              rows={5}
            />
            <button onClick={handleSave} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsModal;