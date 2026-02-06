import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { firebaseDB } from '@shared/services/firebaseDataService';
import { courseService } from '@shared/services/dataService';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Send, 
  ThumbsUp,
  MessageCircle,
  Pin,
  Trash2,
  BookOpen,
  User,
  Clock,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';

// Types
interface ForumPost {
  id: string;
  courseId: string;
  courseName: string;
  moduleId?: string;
  moduleName?: string;
  lessonId?: string;
  lessonName?: string;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'teacher' | 'admin';
  authorAvatar?: string;
  title: string;
  content: string;
  isPinned: boolean;
  isResolved: boolean;
  likesCount: number;
  likedBy: string[];
  repliesCount: number;
  views: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface ForumReply {
  id: string;
  postId: string;
  parentReplyId?: string;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'teacher' | 'admin';
  authorAvatar?: string;
  content: string;
  isAnswer: boolean;
  likesCount: number;
  likedBy: string[];
  createdAt: string;
  updatedAt: string;
}

interface Course {
  id: string;
  title: string;
}

export default function ForumsPage() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [replies, setReplies] = useState<Record<string, ForumReply[]>>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'resolved' | 'unresolved'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'unanswered'>('recent');

  // New post form
  const [newPost, setNewPost] = useState({
    courseId: '',
    title: '',
    content: '',
    tags: [] as string[]
  });
  const [tagInput, setTagInput] = useState('');

  // Reply
  const [replyContent, setReplyContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load courses
      const coursesData = await courseService.getAll();
      setCourses(coursesData.map(c => ({ id: c.id, title: c.title })));

      // Load forum posts
      const postsData = await firebaseDB.getAll<ForumPost>('forum_posts') || [];
      setPosts(postsData);
    } catch (error) {
      console.error('Error loading forum data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReplies = async (postId: string) => {
    try {
      const allReplies = await firebaseDB.getAll<ForumReply>('forum_replies') || [];
      const postReplies = allReplies.filter(r => r.postId === postId);
      setReplies(prev => ({ ...prev, [postId]: postReplies }));
    } catch (error) {
      console.error('Error loading replies:', error);
    }
  };

  const handleSelectPost = async (post: ForumPost) => {
    setSelectedPost(post);
    await loadReplies(post.id);
    
    // Increment views
    const updatedPost = { ...post, views: post.views + 1 };
    await firebaseDB.update('forum_posts', post.id, updatedPost as any);
    setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
  };

  const handleCreatePost = async () => {
    if (!newPost.courseId || !newPost.title.trim() || !newPost.content.trim()) return;

    const course = courses.find(c => c.id === newPost.courseId);
    const post: ForumPost = {
      id: `post_${Date.now()}`,
      courseId: newPost.courseId,
      courseName: course?.title || '',
      authorId: user?.id || '',
      authorName: user?.name || '',
      authorRole: user?.role as ForumPost['authorRole'] || 'student',
      title: newPost.title,
      content: newPost.content,
      isPinned: false,
      isResolved: false,
      likesCount: 0,
      likedBy: [],
      repliesCount: 0,
      views: 0,
      tags: newPost.tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await firebaseDB.create('forum_posts', post);
    setPosts([post, ...posts]);
    setNewPost({ courseId: '', title: '', content: '', tags: [] });
    setShowCreatePost(false);
  };

  const handleReply = async () => {
    if (!selectedPost || !replyContent.trim()) return;

    const reply: ForumReply = {
      id: `reply_${Date.now()}`,
      postId: selectedPost.id,
      parentReplyId: replyingTo || undefined,
      authorId: user?.id || '',
      authorName: user?.name || '',
      authorRole: user?.role as ForumReply['authorRole'] || 'student',
      content: replyContent,
      isAnswer: false,
      likesCount: 0,
      likedBy: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await firebaseDB.create('forum_replies', reply);
    setReplies(prev => ({
      ...prev,
      [selectedPost.id]: [...(prev[selectedPost.id] || []), reply]
    }));

    // Update post replies count
    const updatedPost = { ...selectedPost, repliesCount: selectedPost.repliesCount + 1 };
    await firebaseDB.update('forum_posts', selectedPost.id, updatedPost as any);
    setSelectedPost(updatedPost);
    setPosts(prev => prev.map(p => p.id === selectedPost.id ? updatedPost : p));

    setReplyContent('');
    setReplyingTo(null);
  };

  const handleLikePost = async (post: ForumPost) => {
    const userId = user?.id || '';
    const hasLiked = post.likedBy.includes(userId);
    
    const updatedPost = {
      ...post,
      likesCount: hasLiked ? post.likesCount - 1 : post.likesCount + 1,
      likedBy: hasLiked 
        ? post.likedBy.filter(id => id !== userId)
        : [...post.likedBy, userId]
    };

    await firebaseDB.update('forum_posts', post.id, updatedPost as any);

    setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
    if (selectedPost?.id === post.id) setSelectedPost(updatedPost);
  };

  const handleLikeReply = async (reply: ForumReply) => {
    const userId = user?.id || '';
    const hasLiked = reply.likedBy.includes(userId);
    
    const updatedReply = {
      ...reply,
      likesCount: hasLiked ? reply.likesCount - 1 : reply.likesCount + 1,
      likedBy: hasLiked 
        ? reply.likedBy.filter(id => id !== userId)
        : [...reply.likedBy, userId]
    };

    await firebaseDB.update('forum_replies', reply.id, updatedReply as any);

    setReplies(prev => ({
      ...prev,
      [reply.postId]: prev[reply.postId].map(r => r.id === reply.id ? updatedReply : r)
    }));
  };

  const handleMarkAsAnswer = async (reply: ForumReply) => {
    if (!selectedPost || user?.id !== selectedPost.authorId && user?.role !== 'admin' && user?.role !== 'teacher') return;

    // Unmark any existing answer
    const postReplies = replies[selectedPost.id] || [];
    for (const r of postReplies) {
      if (r.isAnswer && r.id !== reply.id) {
        await firebaseDB.update('forum_replies', r.id, { ...r, isAnswer: false } as any);
      }
    }

    // Mark this as answer
    const updatedReply = { ...reply, isAnswer: !reply.isAnswer };
    await firebaseDB.update('forum_replies', reply.id, updatedReply as any);

    // Update post resolved status
    const updatedPost = { ...selectedPost, isResolved: updatedReply.isAnswer };
    await firebaseDB.update('forum_posts', selectedPost.id, updatedPost as any);

    setReplies(prev => ({
      ...prev,
      [selectedPost.id]: prev[selectedPost.id].map(r => 
        r.id === reply.id ? updatedReply : { ...r, isAnswer: false }
      )
    }));
    setSelectedPost(updatedPost);
    setPosts(prev => prev.map(p => p.id === selectedPost.id ? updatedPost : p));
  };

  const handlePinPost = async (post: ForumPost) => {
    if (user?.role !== 'admin' && user?.role !== 'teacher') return;

    const updatedPost = { ...post, isPinned: !post.isPinned };
    await firebaseDB.update('forum_posts', post.id, updatedPost as any);
    setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
    if (selectedPost?.id === post.id) setSelectedPost(updatedPost);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta publicación?')) return;
    
    await firebaseDB.delete('forum_posts', postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    if (selectedPost?.id === postId) setSelectedPost(null);
  };

  const addTag = () => {
    if (tagInput.trim() && !newPost.tags.includes(tagInput.trim())) {
      setNewPost(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setNewPost(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  // Filter and sort posts
  const filteredPosts = posts
    .filter(post => {
      const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           post.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCourse = filterCourse === 'all' || post.courseId === filterCourse;
      const matchesStatus = filterStatus === 'all' || 
                           (filterStatus === 'resolved' && post.isResolved) ||
                           (filterStatus === 'unresolved' && !post.isResolved);
      return matchesSearch && matchesCourse && matchesStatus;
    })
    .sort((a, b) => {
      // Pinned posts always first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      if (sortBy === 'recent') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'popular') {
        return (b.likesCount + b.repliesCount) - (a.likesCount + a.repliesCount);
      }
      if (sortBy === 'unanswered') {
        if (a.repliesCount === 0 && b.repliesCount > 0) return -1;
        if (a.repliesCount > 0 && b.repliesCount === 0) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      admin: { color: 'bg-red-100 text-red-800', label: 'Admin' },
      teacher: { color: 'bg-blue-100 text-blue-800', label: 'Profesor' },
      student: { color: 'bg-gray-100 text-gray-800', label: 'Estudiante' }
    };
    const badge = badges[role] || badges.student;
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="flex h-[calc(100vh-180px)] gap-6">
      {/* Posts List */}
      <div className={`${selectedPost ? 'w-1/3' : 'w-full'} flex flex-col`}>
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="border-b bg-gray-50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <MessageSquare className="h-5 w-5 mr-2 text-blue-600" />
                Foros de Discusión
              </CardTitle>
              <Button onClick={() => setShowCreatePost(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nueva Pregunta
              </Button>
            </div>

            {/* Filters */}
            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar en los foros..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <select
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">Todos los cursos</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">Todos</option>
                  <option value="unresolved">Sin resolver</option>
                  <option value="resolved">Resueltos</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="recent">Más recientes</option>
                  <option value="popular">Más populares</option>
                  <option value="unanswered">Sin responder</option>
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-0">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                <MessageSquare className="h-12 w-12 mb-2 text-gray-300" />
                <p>No hay publicaciones</p>
                <p className="text-sm">Sé el primero en preguntar</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredPosts.map(post => (
                  <div
                    key={post.id}
                    onClick={() => handleSelectPost(post)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedPost?.id === post.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium">
                          {post.authorName.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {post.isPinned && (
                            <Pin className="h-3 w-3 text-orange-500" />
                          )}
                          {post.isResolved && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          <h3 className="font-medium text-gray-900 truncate">{post.title}</h3>
                        </div>
                        
                        <p className="text-sm text-gray-600 line-clamp-2">{post.content}</p>
                        
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center">
                            <BookOpen className="h-3 w-3 mr-1" />
                            {post.courseName}
                          </span>
                          <span className="flex items-center">
                            <ThumbsUp className="h-3 w-3 mr-1" />
                            {post.likesCount}
                          </span>
                          <span className="flex items-center">
                            <MessageCircle className="h-3 w-3 mr-1" />
                            {post.repliesCount}
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatDate(post.createdAt)}
                          </span>
                        </div>

                        {post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {post.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                {tag}
                              </span>
                            ))}
                            {post.tags.length > 3 && (
                              <span className="text-xs text-gray-400">+{post.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Post Detail */}
      {selectedPost && (
        <div className="w-2/3 flex flex-col">
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="border-b bg-gray-50 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {selectedPost.isPinned && (
                      <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full flex items-center">
                        <Pin className="h-3 w-3 mr-1" />
                        Fijado
                      </span>
                    )}
                    {selectedPost.isResolved && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full flex items-center">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Resuelto
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedPost.title}</h2>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                    <span className="flex items-center">
                      <User className="h-4 w-4 mr-1" />
                      {selectedPost.authorName}
                    </span>
                    {getRoleBadge(selectedPost.authorRole)}
                    <span>•</span>
                    <span>{formatDate(selectedPost.createdAt)}</span>
                    <span>•</span>
                    <span>{selectedPost.views} vistas</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(user?.role === 'admin' || user?.role === 'teacher') && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handlePinPost(selectedPost)}
                      className={selectedPost.isPinned ? 'text-orange-600' : ''}
                    >
                      <Pin className="h-4 w-4" />
                    </Button>
                  )}
                  {(user?.id === selectedPost.authorId || user?.role === 'admin') && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeletePost(selectedPost.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedPost(null)}
                  >
                    ×
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-6">
              {/* Post Content */}
              <div className="prose max-w-none mb-6">
                <p className="whitespace-pre-wrap">{selectedPost.content}</p>
              </div>

              {selectedPost.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedPost.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Post Actions */}
              <div className="flex items-center gap-4 pb-6 border-b">
                <Button
                  variant={selectedPost.likedBy.includes(user?.id || '') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleLikePost(selectedPost)}
                >
                  <ThumbsUp className="h-4 w-4 mr-1" />
                  {selectedPost.likesCount}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReplyingTo(null);
                    replyInputRef.current?.focus();
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Responder
                </Button>
              </div>

              {/* Replies */}
              <div className="mt-6">
                <h3 className="font-medium text-gray-900 mb-4">
                  {selectedPost.repliesCount} {selectedPost.repliesCount === 1 ? 'Respuesta' : 'Respuestas'}
                </h3>

                <div className="space-y-4">
                  {(replies[selectedPost.id] || []).map(reply => (
                    <div 
                      key={reply.id} 
                      className={`p-4 rounded-lg ${
                        reply.isAnswer 
                          ? 'bg-green-50 border-2 border-green-200' 
                          : 'bg-gray-50'
                      }`}
                    >
                      {reply.isAnswer && (
                        <div className="flex items-center text-green-700 text-sm font-medium mb-2">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Respuesta aceptada
                        </div>
                      )}
                      
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                          {reply.authorName.charAt(0).toUpperCase()}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{reply.authorName}</span>
                            {getRoleBadge(reply.authorRole)}
                            <span className="text-xs text-gray-500">{formatDate(reply.createdAt)}</span>
                          </div>
                          
                          <p className="text-gray-700 whitespace-pre-wrap">{reply.content}</p>
                          
                          <div className="flex items-center gap-3 mt-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLikeReply(reply)}
                              className={reply.likedBy.includes(user?.id || '') ? 'text-blue-600' : ''}
                            >
                              <ThumbsUp className="h-3 w-3 mr-1" />
                              {reply.likesCount}
                            </Button>
                            
                            {(user?.id === selectedPost.authorId || user?.role === 'admin' || user?.role === 'teacher') && !reply.isAnswer && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsAnswer(reply)}
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Marcar como respuesta
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>

            {/* Reply Input */}
            <div className="border-t p-4 bg-gray-50">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1">
                  <textarea
                    ref={replyInputRef}
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Escribe tu respuesta..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <Button onClick={handleReply} disabled={!replyContent.trim()}>
                      <Send className="h-4 w-4 mr-2" />
                      Responder
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Nueva Pregunta</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCreatePost(false)}>
                ×
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Curso *
                </label>
                <select
                  value={newPost.courseId}
                  onChange={(e) => setNewPost(prev => ({ ...prev, courseId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Selecciona un curso</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título *
                </label>
                <Input
                  value={newPost.title}
                  onChange={(e) => setNewPost(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="¿Cuál es tu pregunta?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción *
                </label>
                <textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Describe tu pregunta con detalle..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Etiquetas
                </label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Agrega etiquetas"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    Agregar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newPost.tags.map(tag => (
                    <span 
                      key={tag} 
                      className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {tag}
                      <button 
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowCreatePost(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreatePost}
                disabled={!newPost.courseId || !newPost.title.trim() || !newPost.content.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                Publicar Pregunta
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
