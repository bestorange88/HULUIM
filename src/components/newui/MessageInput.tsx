import { useState } from 'react';
import { SendHorizontal, Smile, Paperclip, Mic, Image as ImageIcon } from 'lucide-react';

export function MessageInput() {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const handleSend = () => {
    if (message.trim()) {
      console.log('发送消息:', message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm border-t border-purple-100 p-3">
      <div className="flex items-end gap-2">
        {/* Attachment buttons */}
        <div className="flex items-center gap-1">
          <button className="w-9 h-9 rounded-full hover:bg-purple-50 active:bg-purple-100 flex items-center justify-center transition-colors">
            <Paperclip className="w-[18px] h-[18px] text-purple-600" />
          </button>
          <button className="w-9 h-9 rounded-full hover:bg-purple-50 active:bg-purple-100 flex items-center justify-center transition-colors">
            <ImageIcon className="w-[18px] h-[18px] text-purple-600" />
          </button>
        </div>
        
        {/* Input Area */}
        <div className="flex-1 min-h-9 max-h-32 bg-gradient-to-r from-purple-50 to-purple-50/50 rounded-3xl px-4 py-2 focus-within:ring-2 focus-within:ring-purple-300 transition-all">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="w-full bg-transparent resize-none focus:outline-none text-[15px] placeholder:text-purple-400"
            rows={1}
            style={{
              minHeight: '20px',
              maxHeight: '96px',
            }}
          />
        </div>

        {/* Send or Voice/Emoji Button */}
        {message.trim() ? (
          <button
            onClick={handleSend}
            className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 flex items-center justify-center transition-all shadow-md"
          >
            <SendHorizontal className="w-[18px] h-[18px] text-white" />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button className="w-9 h-9 rounded-full hover:bg-purple-50 active:bg-purple-100 flex items-center justify-center transition-colors">
              <Smile className="w-[18px] h-[18px] text-purple-600" />
            </button>
            <button 
              onMouseDown={() => setIsRecording(true)}
              onMouseUp={() => setIsRecording(false)}
              onMouseLeave={() => setIsRecording(false)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                isRecording 
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 scale-110 shadow-lg' 
                  : 'hover:bg-purple-50 active:bg-purple-100'
              }`}
            >
              <Mic className={`w-[18px] h-[18px] ${isRecording ? 'text-white' : 'text-purple-600'}`} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}