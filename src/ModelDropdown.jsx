import { useState, useEffect } from 'react';
import { readLocalStorage, writeLocalStorage } from './utils';

const ModelDropdown = () => {
  const [modelName, setModelName] = useState('');

  useEffect(() => {
    const loadModelName = async () => {
      try {
        const storedModelName = await readLocalStorage('model');
        setModelName(storedModelName);
      } catch {
        const defaultModelName = 'gemini-1.5-flash';
        setModelName(defaultModelName);
      }
    };

    loadModelName();
  }, []);

  const handleModelNameChange = async (event) => {
    const selectedModelName = event.target.value;
    setModelName(selectedModelName);
    await writeLocalStorage('model', selectedModelName);
    console.log('selectedModelName', await readLocalStorage('model'));
    
  };

  return (
    <select value={modelName} onChange={handleModelNameChange} className="bg-gray-700 border border-gray-600 rounded py-2 px-4 max-w-[160px] mb-4 text-white">
      <option value="gemini-1.5-flash">gemini-1.5-flash</option>
      <option value="gemini-1.5-pro">gemini-1.5-pro</option>
    </select>
  );
};

export default ModelDropdown;