import { useState, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { supportTicketService } from '@shared/services/dataService';
import type { DBSupportTicket } from '@shared/services/firebaseDataService';
import { 
  HelpCircle,
  Plus,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  User,
  Send,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';

// Use DBSupportTicket from firebaseDataService
type Ticket = DBSupportTicket;

interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'support' | 'system';
  content: string;
  isInternal: boolean;
  createdAt: number;
  attachments?: { id: string; name: string; url: string }[];
}

export default function SupportPage() {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newMessage, setNewMessage] = useState('');
  
  // Form state
  const [ticketForm, setTicketForm] = useState({
    subject: '',
    description: '',
    category: 'technical' as Ticket['category'],
    priority: 'medium' as Ticket['priority']
  });

  const isSupport = user?.role === 'support' || user?.role === 'admin';

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      let allTickets: Ticket[];

      // Load tickets from Firebase based on role
      if (isSupport) {
        allTickets = await supportTicketService.getAll();
      } else {
        allTickets = user?.id ? await supportTicketService.getByUser(user.id) : [];
      }

      // Ensure all tickets have messages array
      allTickets = allTickets.map(ticket => ({
        ...ticket,
        messages: ticket.messages || []
      }));

      setTickets(allTickets);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async () => {
    if (!ticketForm.subject.trim() || !ticketForm.description.trim()) return;

    try {
      const ticketData = {
        userId: user?.id || '',
        userName: user?.name || '',
        userEmail: user?.email || '',
        subject: ticketForm.subject,
        description: ticketForm.description,
        category: ticketForm.category,
        priority: ticketForm.priority,
        status: 'new' as const,
        messages: [{
          id: `msg_${Date.now()}`,
          senderId: user?.id || '',
          senderName: user?.name || '',
          senderRole: user?.role || 'student',
          content: ticketForm.description,
          timestamp: new Date().toISOString()
        }],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const newTicket = await supportTicketService.create(ticketData as any);
      setTickets([...tickets, newTicket]);
      setShowCreateModal(false);
      setTicketForm({ subject: '', description: '', category: 'tecnico', priority: 'media' });
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('Error al crear el ticket');
    }
  };

  const sendMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) return;

    try {
      const senderRole: 'user' | 'support' | 'system' = isSupport ? 'support' : 'user';
      const message: TicketMessage = {
        id: `msg_${Date.now()}`,
        ticketId: selectedTicket.id,
        senderId: user?.id || '',
        senderName: user?.name || '',
        senderRole,
        content: newMessage,
        isInternal: false,
        createdAt: Date.now()
      };

      const newStatus = isSupport && selectedTicket.status === 'new' ? 'in_progress' : selectedTicket.status;
      const updates = {
        messages: [...(selectedTicket.messages || []), message],
        updatedAt: Date.now(),
        status: newStatus
      };

      await supportTicketService.update(selectedTicket.id, updates as any);

      const updatedTicket = { ...selectedTicket, ...updates } as Ticket;
      setSelectedTicket(updatedTicket);
      setTickets(tickets.map(t => t.id === selectedTicket.id ? updatedTicket : t));
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const updateTicketStatus = async (ticketId: string, newStatus: Ticket['status']) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    try {
      const updates: Partial<Ticket> = {
        status: newStatus,
        updatedAt: Date.now(),
        ...(newStatus === 'resolved' ? { resolvedAt: Date.now() } : {}),
        ...(newStatus === 'in_progress' && !ticket.assignedTo ? {
          assignedTo: user?.id,
          assignedName: user?.name
        } : {})
      };

      await supportTicketService.update(ticketId, updates as any);

      const updatedTicket = { ...ticket, ...updates } as Ticket;
      setTickets(tickets.map(t => t.id === ticketId ? updatedTicket : t));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(updatedTicket);
      }
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusBadge = (status: Ticket['status']) => {
    const badges: Record<string, { color: string; text: string; icon: typeof AlertCircle }> = {
      new: { color: 'bg-blue-100 text-blue-800', text: 'Nuevo', icon: AlertCircle },
      assigned: { color: 'bg-yellow-100 text-yellow-800', text: 'Asignado', icon: User },
      in_progress: { color: 'bg-purple-100 text-purple-800', text: 'En Progreso', icon: Clock },
      resolved: { color: 'bg-green-100 text-green-800', text: 'Resuelto', icon: CheckCircle },
      closed: { color: 'bg-gray-100 text-gray-800', text: 'Cerrado', icon: XCircle }
    };
    const badge = badges[status] || badges['new'];
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="h-3 w-3 mr-1" />
        {badge.text}
      </span>
    );
  };

  const getPriorityBadge = (priority: Ticket['priority']) => {
    const badges: Record<string, { color: string; text: string }> = {
      low: { color: 'bg-gray-100 text-gray-600', text: 'Baja' },
      medium: { color: 'bg-yellow-100 text-yellow-700', text: 'Media' },
      high: { color: 'bg-orange-100 text-orange-700', text: 'Alta' },
      critical: { color: 'bg-red-100 text-red-700', text: 'Crítica' }
    };
    const badge = badges[priority] || badges['medium'];
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  const getCategoryLabel = (category: Ticket['category']) => {
    const labels: Record<string, string> = {
      technical: 'Técnico',
      course: 'Curso',
      payment: 'Pago',
      account: 'Cuenta',
      other: 'Otro'
    };
    return labels[category] || 'Otro';
  };

  // Stats
  const stats = {
    total: tickets.length,
    open: tickets.filter(t => ['new', 'open', 'in_progress', 'waiting'].includes(t.status)).length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    urgent: tickets.filter(t => t.priority === 'urgente' && t.status !== 'resolved' && t.status !== 'closed').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isSupport ? 'Centro de Soporte' : 'Mis Tickets'}
          </h1>
          <p className="text-gray-600">
            {isSupport 
              ? 'Gestiona los tickets de soporte de los usuarios'
              : '¿Necesitas ayuda? Crea un ticket y te responderemos pronto'
            }
          </p>
        </div>
        {!isSupport && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Ticket
          </Button>
        )}
      </div>

      {/* Stats (for support/admin) */}
      {isSupport && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <HelpCircle className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-600">Total Tickets</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold">{stats.open}</p>
                <p className="text-sm text-gray-600">Abiertos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold">{stats.resolved}</p>
                <p className="text-sm text-gray-600">Resueltos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold">{stats.urgent}</p>
                <p className="text-sm text-gray-600">Urgentes</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar tickets..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos los estados</option>
              <option value="new">Nuevos</option>
              <option value="assigned">Asignados</option>
              <option value="in_progress">En Progreso</option>
              <option value="resolved">Resueltos</option>
              <option value="closed">Cerrados</option>
            </select>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todas las prioridades</option>
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets List */}
        <div className={`${selectedTicket ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
          <Card>
            <CardContent className="p-0">
              {filteredTickets.length === 0 ? (
                <div className="p-8 text-center">
                  <HelpCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">Sin tickets</h3>
                  <p className="text-gray-600">
                    {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                      ? 'No se encontraron tickets con esos filtros'
                      : isSupport 
                        ? 'No hay tickets pendientes'
                        : 'No has creado ningún ticket aún'
                    }
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredTickets.map(ticket => (
                    <div 
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 ${
                        selectedTicket?.id === ticket.id ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-xs text-gray-500 font-mono">
                              #{ticket.id.split('_')[1]}
                            </span>
                            {getStatusBadge(ticket.status)}
                            {getPriorityBadge(ticket.priority)}
                          </div>
                          <h4 className="font-medium text-gray-900 truncate">
                            {ticket.subject}
                          </h4>
                          <div className="flex items-center space-x-3 mt-1 text-sm text-gray-500">
                            <span>{ticket.userName}</span>
                            <span>•</span>
                            <span>{getCategoryLabel(ticket.category)}</span>
                            <span>•</span>
                            <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ticket Detail */}
        {selectedTicket && (
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                {/* Ticket Header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-sm text-gray-500 font-mono">
                        #{selectedTicket.id.split('_')[1]}
                      </span>
                      {getStatusBadge(selectedTicket.status)}
                      {getPriorityBadge(selectedTicket.priority)}
                    </div>
                    <h2 className="text-xl font-bold">{selectedTicket.subject}</h2>
                    <div className="flex items-center space-x-3 mt-1 text-sm text-gray-500">
                      <span>Por: {selectedTicket.userName}</span>
                      <span>•</span>
                      <span>{getCategoryLabel(selectedTicket.category)}</span>
                      <span>•</span>
                      <span>{new Date(selectedTicket.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedTicket(null)}
                  >
                    Cerrar
                  </Button>
                </div>

                {/* Status Actions (Support only) */}
                {isSupport && (
                  <div className="flex flex-wrap gap-2 mb-6 p-3 bg-gray-50 rounded-lg">
                    <Button
                      size="sm"
                      variant={selectedTicket.assignedTo === user?.id ? 'default' : 'outline'}
                      onClick={() => updateTicketStatus(selectedTicket.id, 'in_progress')}
                    >
                      Asignarme
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedTicket.status === 'waiting' ? 'default' : 'outline'}
                      onClick={() => updateTicketStatus(selectedTicket.id, 'waiting')}
                    >
                      En Espera
                    </Button>
                    <Button 
                      size="sm" 
                      variant={selectedTicket.status === 'resolved' ? 'default' : 'outline'}
                      onClick={() => updateTicketStatus(selectedTicket.id, 'resolved')}
                      className="text-green-600"
                    >
                      Marcar Resuelto
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => updateTicketStatus(selectedTicket.id, 'closed')}
                    >
                      Cerrar Ticket
                    </Button>
                  </div>
                )}

                {/* Messages */}
                <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                  {(selectedTicket.messages || []).map(message => (
                    <div 
                      key={message.id}
                      className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] rounded-lg p-3 ${
                        message.senderId === user?.id 
                          ? 'bg-indigo-600 text-white'
                          : message.senderRole === 'support'
                            ? 'bg-green-100 text-green-900'
                            : 'bg-gray-100 text-gray-900'
                      }`}>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-sm">{message.senderName}</span>
                          {(message.senderRole === 'support') && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              message.senderId === user?.id 
                                ? 'bg-indigo-500' 
                                : 'bg-green-200 text-green-800'
                            }`}>
                              Soporte
                            </span>
                          )}
                        </div>
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.senderId === user?.id ? 'text-indigo-200' : 'text-gray-500'
                        }`}>
                          {new Date(message.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reply Input */}
                {selectedTicket.status !== 'closed' && (
                  <div className="flex space-x-2">
                    <Input
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      placeholder="Escribe tu mensaje..."
                      onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    />
                    <Button onClick={sendMessage}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Nuevo Ticket de Soporte</h2>
              
              <div className="space-y-4">
                <div>
                  <Label>Asunto *</Label>
                  <Input
                    value={ticketForm.subject}
                    onChange={e => setTicketForm(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Describe brevemente tu problema"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Categoría</Label>
                    <select
                      value={ticketForm.category}
                      onChange={e => setTicketForm(prev => ({ 
                        ...prev, 
                        category: e.target.value as Ticket['category']
                      }))}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="technical">Técnico</option>
                      <option value="course">Curso</option>
                      <option value="payment">Pago</option>
                      <option value="account">Cuenta</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                  <div>
                    <Label>Prioridad</Label>
                    <select
                      value={ticketForm.priority}
                      onChange={e => setTicketForm(prev => ({ 
                        ...prev, 
                        priority: e.target.value as Ticket['priority']
                      }))}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                      <option value="critical">Crítica</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <Label>Descripción *</Label>
                  <textarea
                    value={ticketForm.description}
                    onChange={e => setTicketForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={5}
                    placeholder="Describe tu problema con el mayor detalle posible..."
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={createTicket}>
                  Crear Ticket
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
