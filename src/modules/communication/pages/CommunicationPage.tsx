import { useState, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { conversationService, messageService } from '@shared/services/dataService';
import type { DBConversation, DBMessage } from '@shared/services/firebaseDataService';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Send, 
  Paperclip, 
  Users,
  Hash,
  MoreVertical,
  Phone,
  Video,
  UserPlus
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  type: 'text' | 'file' | 'image';
  fileName?: string;
  fileUrl?: string;
}

interface Channel {
  id: string;
  name: string;
  description: string;
  type: 'general' | 'course' | 'private';
  courseId?: string;
  courseName?: string;
  members: string[];
  isPrivate: boolean;
  createdBy: string;
  createdAt: string;
  lastMessage?: Message;
  unreadCount: number;
}

const CommunicationPage = () => {
  const { user } = useAuthStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const conversationsData = await conversationService.getAll() || [];

      // Map conversations to Channel format
      const channelsData: Channel[] = conversationsData.map((conv: DBConversation) => ({
        id: conv.id,
        name: conv.name || 'Conversación',
        description: '',
        type: conv.type === 'direct' ? 'private' as const : conv.type === 'course' ? 'course' as const : 'general' as const,
        courseId: conv.courseId,
        members: conv.participants || [],
        isPrivate: conv.type === 'direct',
        createdBy: conv.createdBy,
        createdAt: new Date(conv.createdAt).toISOString(),
        lastMessage: conv.lastMessage ? {
          id: '',
          senderId: conv.lastMessage.senderId,
          senderName: '',
          content: conv.lastMessage.content,
          timestamp: new Date(conv.lastMessage.timestamp).toISOString(),
          type: 'text' as const
        } : undefined,
        unreadCount: conv.unreadCount?.[user?.id || ''] || 0
      }));

      // Filtrar canales según el rol del usuario
      const userChannels = channelsData.filter(channel => {
        if (channel.type === 'general') return true;
        if (channel.type === 'private') return channel.members?.includes(user?.id || '');
        if (channel.type === 'course') {
          return true;
        }
        return false;
      });

      setChannels(userChannels);

      // Seleccionar el primer canal si no hay uno seleccionado
      if (userChannels.length > 0 && !selectedChannel) {
        setSelectedChannel(userChannels[0]);
      }
    } catch (error) {
      console.error('Error loading channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (channelId: string) => {
    try {
      const messagesData = await messageService.getByConversation(channelId) || [];
      const channelMessages: Message[] = messagesData.map((msg: DBMessage) => ({
        id: msg.id,
        senderId: msg.senderId,
        senderName: msg.senderName,
        content: msg.content,
        timestamp: new Date(msg.createdAt).toISOString(),
        type: msg.type === 'file' ? 'file' as const : msg.type === 'image' ? 'image' as const : 'text' as const,
      })).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      setMessages(channelMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    if (selectedChannel) {
      loadMessages(selectedChannel.id);
    }
  }, [selectedChannel]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel || !user) return;

    try {
      const dbMessage = await messageService.create({
        conversationId: selectedChannel.id,
        senderId: user.id,
        senderName: user.name,
        content: newMessage.trim(),
        type: 'text',
        readBy: [user.id],
        edited: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const localMessage: Message = {
        id: dbMessage.id,
        senderId: user.id,
        senderName: user.name,
        content: newMessage.trim(),
        timestamp: new Date().toISOString(),
        type: 'text'
      };

      setMessages([...messages, localMessage]);
      setNewMessage('');

      // Actualizar último mensaje del canal (messageService.create already updates the conversation)
      const updatedChannel = {
        ...selectedChannel,
        lastMessage: localMessage
      };
      setChannels(channels.map(c => c.id === selectedChannel.id ? updatedChannel : c));
      setSelectedChannel(updatedChannel);

    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleCreateChannel = async (channelData: Partial<Channel>) => {
    if (!user) return;

    const convType = channelData.type === 'private' ? 'direct' as const :
                     channelData.type === 'course' ? 'course' as const : 'group' as const;

    try {
      const newConv = await conversationService.create({
        type: convType,
        name: channelData.name || '',
        participants: [user.id],
        courseId: channelData.courseId,
        unreadCount: {},
        createdBy: user.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const newChannel: Channel = {
        id: newConv.id,
        name: channelData.name || '',
        description: channelData.description || '',
        type: channelData.type || 'general',
        courseId: channelData.courseId,
        courseName: channelData.courseName,
        members: [user.id],
        isPrivate: channelData.isPrivate || false,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        unreadCount: 0
      };

      setChannels([...channels, newChannel]);
      setShowCreateChannel(false);
      setSelectedChannel(newChannel);
    } catch (error) {
      console.error('Error creating channel:', error);
    }
  };

  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getChannelIcon = (type: Channel['type']) => {
    switch (type) {
      case 'general': return Hash;
      case 'course': return Users;
      case 'private': return MessageSquare;
      default: return Hash;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 días
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-lg shadow-sm border">
      {/* Sidebar - Lista de Canales */}
      <div className="w-80 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Comunicación</h2>
            <Button size="sm" onClick={() => setShowCreateChannel(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar canales..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Lista de Canales */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse flex space-x-3">
                  <div className="h-8 w-8 bg-gray-200 rounded"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No hay canales disponibles</p>
              <Button 
                size="sm" 
                className="mt-3"
                onClick={() => setShowCreateChannel(true)}
              >
                Crear primer canal
              </Button>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredChannels.map((channel) => {
                const ChannelIcon = getChannelIcon(channel.type);
                const isSelected = selectedChannel?.id === channel.id;
                
                return (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannel(channel)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      isSelected 
                        ? 'bg-blue-100 border-l-4 border-blue-500' 
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded ${
                        channel.type === 'course' ? 'bg-green-100 text-green-600' :
                        channel.type === 'private' ? 'bg-purple-100 text-purple-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        <ChannelIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900 truncate">
                            {channel.name}
                          </h3>
                          {channel.unreadCount > 0 && (
                            <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                              {channel.unreadCount}
                            </span>
                          )}
                        </div>
                        {channel.lastMessage && (
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <span className="truncate">
                              {channel.lastMessage.senderName}: {channel.lastMessage.content}
                            </span>
                            <span className="ml-2 text-xs">
                              {formatTime(channel.lastMessage.timestamp)}
                            </span>
                          </div>
                        )}
                        {channel.type === 'course' && (
                          <p className="text-xs text-gray-400">{channel.courseName}</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Área de Chat */}
      <div className="flex-1 flex flex-col">
        {selectedChannel ? (
          <>
            {/* Header del Chat */}
            <div className="p-4 border-b bg-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded ${
                  selectedChannel.type === 'course' ? 'bg-green-100 text-green-600' :
                  selectedChannel.type === 'private' ? 'bg-purple-100 text-purple-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {(() => {
                    const Icon = getChannelIcon(selectedChannel.type);
                    return <Icon className="h-5 w-5" />;
                  })()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedChannel.name}</h3>
                  <p className="text-sm text-gray-500">
                    {selectedChannel.type === 'course' 
                      ? selectedChannel.courseName 
                      : selectedChannel.description || `${selectedChannel.members.length} miembros`
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="ghost">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost">
                  <Video className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost">
                  <UserPlus className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">¡Inicia la conversación!</h3>
                  <p className="text-gray-500">Sé el primero en enviar un mensaje en este canal.</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isOwnMessage = message.senderId === user?.id;
                  const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;
                  
                  return (
                    <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex space-x-2 max-w-xs lg:max-w-md ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        {!isOwnMessage && showAvatar && (
                          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                            {message.senderName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {!isOwnMessage && !showAvatar && (
                          <div className="w-8"></div>
                        )}
                        <div className={`rounded-lg px-3 py-2 ${
                          isOwnMessage 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-white text-gray-900 shadow-sm border'
                        }`}>
                          {!isOwnMessage && showAvatar && (
                            <p className="text-xs font-medium mb-1 text-gray-600">
                              {message.senderName}
                            </p>
                          )}
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {formatTime(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input de Mensaje */}
            <div className="p-4 border-t bg-white">
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="ghost">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <div className="flex-1 relative">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Escribe un mensaje en ${selectedChannel.name}...`}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="pr-12"
                  />
                  <Button
                    size="sm"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Selecciona un canal</h3>
              <p className="text-gray-500">Elige un canal para comenzar a chatear.</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal para Crear Canal */}
      {showCreateChannel && (
        <CreateChannelModal
          onSave={handleCreateChannel}
          onClose={() => setShowCreateChannel(false)}
        />
      )}
    </div>
  );
};

// Modal para crear canal
const CreateChannelModal = ({
  onSave,
  onClose
}: {
  onSave: (data: Partial<Channel>) => void;
  onClose: () => void;
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'general' as Channel['type'],
    isPrivate: false,
    courseId: '',
    courseName: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Crear Canal</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre del canal</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="ej. general"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe el propósito del canal..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-20 resize-none"
            />
          </div>

          <div>
            <Label htmlFor="type">Tipo de canal</Label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as Channel['type'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="general">General</option>
              <option value="course">Curso</option>
              <option value="private">Privado</option>
            </select>
          </div>

          {formData.type === 'course' && (
            <div>
              <Label htmlFor="courseName">Nombre del curso</Label>
              <Input
                id="courseName"
                value={formData.courseName}
                onChange={(e) => setFormData({ ...formData, courseName: e.target.value })}
                placeholder="ej. React Fundamentals"
                required
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isPrivate"
              checked={formData.isPrivate}
              onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="isPrivate">Canal privado</Label>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button type="submit" className="flex-1">
              Crear Canal
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CommunicationPage;