import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, List } from 'lucide-react';

interface SuggestionInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  suggestions: string[];
}

export const SuggestionInput: React.FC<SuggestionInputProps> = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  suggestions
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userForcedCustom, setUserForcedCustom] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isCustom = userForcedCustom || (value && !suggestions.includes(value));

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSuggestionClick = (suggestion: string) => {
    // Create a synthetic event
    onChange({ target: { name, value: suggestion } } as React.ChangeEvent<HTMLInputElement>);
    setUserForcedCustom(false);
    setIsOpen(false);
  };

  const handleCustomClick = () => {
    setUserForcedCustom(true);
    setIsOpen(false);
  };

  const handleSwitchToList = () => {
    setUserForcedCustom(false);
    onChange({ target: { name, value: '' } } as React.ChangeEvent<HTMLInputElement>);
    setIsOpen(true);
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative" ref={containerRef}>
      <label className="block text-sm font-semibold text-slate-800 mb-2">{label}</label>
      
      {isCustom ? (
        <div className="flex gap-2">
          <input
            type="text"
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            autoFocus
            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50 hover:bg-white transition-colors"
          />
          <button 
            type="button" 
            onClick={handleSwitchToList}
            className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-300 rounded-lg transition-colors flex items-center justify-center shrink-0"
            title="Выбрать из списка"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`w-full p-2.5 border ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-300'} rounded-lg text-left text-sm bg-slate-50 hover:bg-white transition-colors flex justify-between items-center`}
          >
            <span className={`block truncate ${value ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
              {value || placeholder}
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
              <button
                type="button"
                onClick={handleCustomClick}
                className="w-full text-left px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 font-semibold border-b border-slate-100 flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                Другое (Ввести свой текст)
              </button>
              
              <div className="py-1">
                {suggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSuggestionClick(s)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      value === s 
                        ? 'bg-blue-50 text-blue-700 font-medium' 
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
