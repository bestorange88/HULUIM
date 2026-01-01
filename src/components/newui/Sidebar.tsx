import { MessageCircle, Users, Phone, User } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const navItems = [
    { id: 'chats', icon: MessageCircle, label: 'Chats' },
    { id: 'contacts', icon: Users, label: 'Contacts' },
    { id: 'calls', icon: Phone, label: 'Calls' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="w-full h-16 bg-white/90 backdrop-blur-lg border-t border-purple-100 flex items-center justify-around px-2 fixed bottom-0 left-0 right-0 z-50">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`flex flex-col items-center justify-center gap-1 px-5 py-2 rounded-xl transition-all duration-200 relative ${
            activeTab === item.id
              ? 'text-purple-600'
              : 'text-gray-400 hover:text-purple-500'
          }`}
        >
          <item.icon className="w-6 h-6" strokeWidth={activeTab === item.id ? 2.5 : 2} />
          <span className="text-[11px]">{item.label}</span>
          {/* Active indicator */}
          {activeTab === item.id && (
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"></div>
          )}
          {/* Unread badge for chats */}
          {item.id === 'chats' && activeTab !== 'chats' && (
            <span className="absolute top-1.5 right-3 w-2 h-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full ring-2 ring-white"></span>
          )}
        </button>
      ))}
    </div>
  );
}