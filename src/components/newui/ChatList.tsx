import { Search, MoreVertical } from 'lucide-react';

interface Chat {
  id: number;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  isPinned?: boolean;
  typing?: boolean;
}

interface ChatListProps {
  selectedChat: number | null;
  setSelectedChat: (id: number) => void;
}

const mockChats: Chat[] = [
  {
    id: 1,
    name: 'Sarah Chen',
    avatar: 'https://images.unsplash.com/photo-1581065178026-390bc4e78dad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHByb2Zlc3Npb25hbCUyMHdvbWFufGVufDF8fHx8MTc2NzE5MDE5MXww&ixlib=rb-4.1.0&q=80&w=1080',
    lastMessage: 'The design mockups look great! When can we discuss implementation?',
    time: '2m',
    unread: 2,
    online: true,
    typing: true,
  },
  {
    id: 2,
    name: 'Marcus Johnson',
    avatar: 'https://images.unsplash.com/photo-1672685667592-0392f458f46f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYW4lMjBwcm9mZXNzaW9uYWwlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NjcxMTQyOTB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    lastMessage: 'Meeting rescheduled to 3 PM tomorrow',
    time: '15m',
    unread: 0,
    online: true,
  },
  {
    id: 3,
    name: 'Design Team',
    avatar: 'https://images.unsplash.com/photo-1709715357520-5e1047a2b691?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHRlYW0lMjBtZWV0aW5nfGVufDF8fHx8MTc2NzE0MjMwNXww&ixlib=rb-4.1.0&q=80&w=1080',
    lastMessage: 'Alex: I\'ve uploaded the latest prototypes to Figma',
    time: '1h',
    unread: 5,
    online: false,
    isPinned: true,
  },
  {
    id: 4,
    name: 'Emma Rodriguez',
    avatar: 'https://images.unsplash.com/photo-1762341111756-caf184156fa6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMHByb2Zlc3Npb25hbCUyMG9mZmljZXxlbnwxfHx8fDE3NjcxNDY3Njh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    lastMessage: 'Thanks for the update! This looks perfect.',
    time: '3h',
    unread: 0,
    online: false,
  },
  {
    id: 5,
    name: 'Dev Squad',
    avatar: 'https://images.unsplash.com/photo-1702046988296-40db18f155ad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdGFydHVwJTIwb2ZmaWNlJTIwd29ya3NwYWNlfGVufDF8fHx8MTc2NzE0NTM5OHww&ixlib=rb-4.1.0&q=80&w=1080',
    lastMessage: 'API deployment completed successfully',
    time: '5h',
    unread: 12,
    online: true,
  },
  {
    id: 6,
    name: 'James Kim',
    avatar: 'https://images.unsplash.com/photo-1762341120638-b5b9358ef571?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBidXNpbmVzcyUyMHBlcnNvbnxlbnwxfHx8fDE3NjcxMDY0ODB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    lastMessage: 'Code review approved ✓',
    time: 'Yesterday',
    unread: 0,
    online: false,
  },
];

export function ChatList({ selectedChat, setSelectedChat }: ChatListProps) {
  return (
    <div className="w-full h-full bg-gradient-to-b from-purple-50/30 to-white flex flex-col pb-16">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 bg-white/80 backdrop-blur-sm border-b border-purple-100">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl bg-gradient-to-r from-purple-600 to-emerald-600 bg-clip-text text-transparent">Messages</h1>
          <button className="w-9 h-9 rounded-full hover:bg-purple-50 active:bg-purple-100 flex items-center justify-center transition-colors">
            <MoreVertical className="w-5 h-5 text-purple-700" />
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-purple-400" />
          <input
            type="text"
            placeholder="Search messages"
            className="w-full h-10 pl-11 pr-4 bg-purple-50 rounded-full text-[15px] focus:outline-none focus:bg-purple-50 focus:ring-2 focus:ring-purple-200 transition-all placeholder:text-purple-400"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {mockChats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => setSelectedChat(chat.id)}
            className={`w-full px-5 py-3.5 flex items-center gap-3 active:bg-purple-50/50 transition-all relative ${
              selectedChat === chat.id ? 'bg-gradient-to-r from-purple-50 to-emerald-50/30' : ''
            }`}
          >
            {/* Avatar with online indicator */}
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-purple-100">
                <img 
                  src={chat.avatar} 
                  alt={chat.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {chat.online && (
                <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-gradient-to-br from-purple-400 to-emerald-500 rounded-full border-[2.5px] border-white"></div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[15px] text-gray-900 truncate">{chat.name}</h3>
                <span className="text-xs text-purple-400 flex-shrink-0 ml-2">{chat.time}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                {chat.typing ? (
                  <div className="flex items-center gap-1">
                    <div className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span className="text-[13px] text-purple-600 ml-1">typing...</span>
                  </div>
                ) : (
                  <p className="text-[13px] text-gray-500 truncate">{chat.lastMessage}</p>
                )}
                {chat.unread > 0 && (
                  <span className="min-w-5 h-5 px-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-[11px] rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                    {chat.unread > 99 ? '99+' : chat.unread}
                  </span>
                )}
              </div>
            </div>

            {/* Pinned indicator */}
            {chat.isPinned && (
              <div className="absolute top-2 right-4 w-1 h-1 bg-purple-400 rounded-full"></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}