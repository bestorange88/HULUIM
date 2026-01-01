import { Phone, Video, Info, ChevronLeft, Check } from 'lucide-react';
import { MessageInput } from './MessageInput';

interface Message {
  id: number;
  sender: 'me' | 'other';
  content: string;
  time: string;
  avatar?: string;
  status?: 'sent' | 'delivered' | 'read';
  senderName?: string;
}

const mockMessages: Message[] = [
  {
    id: 1,
    sender: 'other',
    content: 'Hey team, I wanted to share some thoughts on the new design direction',
    time: '10:20 AM',
    avatar: 'https://images.unsplash.com/photo-1581065178026-390bc4e78dad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHByb2Zlc3Npb25hbCUyMHdvbWFufGVufDF8fHx8MTc2NzE5MDE5MXww&ixlib=rb-4.1.0&q=80&w=1080',
    senderName: 'Sarah Chen',
  },
  {
    id: 2,
    sender: 'me',
    content: 'Sure, I\'m all ears',
    time: '10:21 AM',
    status: 'read',
  },
  {
    id: 3,
    sender: 'other',
    content: 'I think we should focus on simplifying the homepage layout and adding some subtle animations to improve user engagement',
    time: '10:22 AM',
    avatar: 'https://images.unsplash.com/photo-1581065178026-390bc4e78dad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHByb2Zlc3Npb25hbCUyMHdvbWFufGVufDF8fHx8MTc2NzE5MDE5MXww&ixlib=rb-4.1.0&q=80&w=1080',
    senderName: 'Sarah Chen',
  },
  {
    id: 4,
    sender: 'me',
    content: 'That sounds great! I was thinking along the same lines. Do you have any specific animation ideas in mind?',
    time: '10:23 AM',
    status: 'read',
  },
  {
    id: 5,
    sender: 'other',
    content: 'Yes, I\'ve put together some references. I\'ll share them with the team this afternoon',
    time: '10:25 AM',
    avatar: 'https://images.unsplash.com/photo-1581065178026-390bc4e78dad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHByb2Zlc3Npb25hbCUyMHdvbWFufGVufDF8fHx8MTc2NzE5MDE5MXww&ixlib=rb-4.1.0&q=80&w=1080',
    senderName: 'Sarah Chen',
  },
  {
    id: 6,
    sender: 'me',
    content: 'Perfect! Looking forward to seeing them',
    time: '10:26 AM',
    status: 'delivered',
  },
  {
    id: 7,
    sender: 'other',
    content: 'I\'ll have everything ready by 3 PM',
    time: '10:28 AM',
    avatar: 'https://images.unsplash.com/photo-1581065178026-390bc4e78dad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHByb2Zlc3Npb25hbCUyMHdvbWFufGVufDF8fHx8MTc2NzE5MDE5MXww&ixlib=rb-4.1.0&q=80&w=1080',
    senderName: 'Sarah Chen',
  },
];

interface ChatWindowProps {
  onBack: () => void;
}

export function ChatWindow({ onBack }: ChatWindowProps) {
  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-purple-50/20 to-white">
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between bg-gradient-to-r from-purple-500/90 to-emerald-500/90 backdrop-blur-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button 
            onClick={onBack}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white/50">
              <img 
                src="https://images.unsplash.com/photo-1581065178026-390bc4e78dad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHByb2Zlc3Npb25hbCUyMHdvbWFufGVufDF8fHx8MTc2NzE5MDE5MXww&ixlib=rb-4.1.0&q=80&w=1080" 
                alt="Sarah Chen"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-white rounded-full border-2 border-purple-500"></div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] text-white truncate">Sarah Chen</h3>
            <p className="text-xs text-white/80 truncate">Active now</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 ml-2">
          <button className="w-9 h-9 rounded-full hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-colors">
            <Phone className="w-[18px] h-[18px] text-white" />
          </button>
          <button className="w-9 h-9 rounded-full hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-colors">
            <Video className="w-5 h-5 text-white" />
          </button>
          <button className="w-9 h-9 rounded-full hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-colors">
            <Info className="w-[18px] h-[18px] text-white" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Date divider */}
        <div className="flex items-center justify-center py-2">
          <div className="px-3 py-1 bg-gradient-to-r from-purple-100 to-purple-50 rounded-full">
            <span className="text-xs text-purple-700">Today</span>
          </div>
        </div>

        {mockMessages.map((msg, index) => {
          const showAvatar = msg.sender === 'other' && 
            (index === mockMessages.length - 1 || mockMessages[index + 1]?.sender !== 'other');
          
          return (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.sender === 'me' ? 'flex-row-reverse' : ''}`}
            >
              {msg.sender === 'other' && (
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-purple-100 self-end">
                  {showAvatar ? (
                    <img 
                      src={msg.avatar} 
                      alt={msg.senderName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full"></div>
                  )}
                </div>
              )}
              
              <div className={`flex flex-col gap-1 max-w-[75%] ${msg.sender === 'me' ? 'items-end' : ''}`}>
                <div
                  className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                    msg.sender === 'me'
                      ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-br-md'
                      : 'bg-white text-gray-900 rounded-bl-md border border-purple-50'
                  }`}
                >
                  <p className="text-[15px] leading-relaxed">{msg.content}</p>
                </div>
                <div className={`flex items-center gap-1.5 px-2 ${msg.sender === 'me' ? 'flex-row-reverse' : ''}`}>
                  <span className="text-[11px] text-purple-400">{msg.time}</span>
                  {msg.sender === 'me' && (
                    <div className="flex items-center">
                      {msg.status === 'read' ? (
                        <div className="flex -space-x-1">
                          <Check className="w-3 h-3 text-purple-500" />
                          <Check className="w-3 h-3 text-purple-500" />
                        </div>
                      ) : msg.status === 'delivered' ? (
                        <div className="flex -space-x-1">
                          <Check className="w-3 h-3 text-purple-300" />
                          <Check className="w-3 h-3 text-purple-300" />
                        </div>
                      ) : (
                        <Check className="w-3 h-3 text-purple-300" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <MessageInput />
    </div>
  );
}