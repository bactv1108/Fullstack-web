import React, { useEffect, useState } from 'react';
import { configService } from '../../services/config.service';
import { X, Plus } from 'lucide-react';

const BlacklistWord = () => {
  const [words, setWords] = useState([]);
  const [newWord, setNewWord] = useState('');

  useEffect(() => {
    configService.getBlacklist().then(setWords);
  }, []);

  const handleAdd = () => {
    if (newWord && !words.includes(newWord)) {
      setWords([...words, newWord]);
      setNewWord('');
    }
  };

  const handleRemove = (word) => {
    setWords(words.filter(w => w !== word));
  };

  return (
    <div className="admin-card p-6">
      <h2 className="text-lg font-semibold mb-6">Từ Khóa Cấm (Blacklist)</h2>
      
      <div className="flex gap-2 mb-6">
        <input 
          type="text" 
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          placeholder="Nhập từ khóa cần cấm..." 
          className="admin-input flex-1"
          onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button onClick={handleAdd} className="admin-btn admin-btn-primary">
          <Plus size={18} /> Thêm
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {words.map(word => (
          <span key={word} className="bg-admin-bg border border-admin-danger/30 text-admin-text px-3 py-1.5 rounded-full flex items-center gap-2 text-sm">
            {word}
            <button onClick={() => handleRemove(word)} className="text-admin-danger hover:text-red-400">
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

export default BlacklistWord;
