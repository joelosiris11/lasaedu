import { useState, useEffect, useRef } from 'react';
import { forumService, type DBForumPost, type DBForumReply } from '@shared/services/dataService';
import type { DBLesson } from '@shared/services/dataService';
import type { ForumLessonContent } from './ForumLessonEditor';
import {
  MessageSquare,
  Plus,
  Send,
  ThumbsUp,
  MessageCircle,
  Pin,
  Trash2,
  User,
  Clock,
  CheckCircle,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';

interface LessonForumViewProps {
  lesson: DBLesson;
  courseId: string;
  userId: string;
  userName: string;
  userRole: string;
  onParticipated: () => void;
}

interface ForumPost {
  id: string;
  courseId: string;
  courseName: string;
  lessonId?: string;
  lessonName?: string;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'teacher' | 'admin';
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
  content: string;
  isAnswer: boolean;
  likesCount: number;
  likedBy: string[];
  createdAt: string;
  updatedAt: string;
}

export default function LessonForumView({
  lesson,
  courseId,
  userId,
  userName,
  userRole,
  onParticipated,
}: LessonForumViewProps) {
  const [forumConfig, setForumConfig] = useState<ForumLessonContent | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [replies, setReplies] = useState<Record<string, ForumReply[]>>({});
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [hasParticipated, setHasParticipated] = useState(false);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Parse lesson content for forum config
    try {
      const parsed = typeof lesson.content === 'string'
        ? JSON.parse(lesson.content)
        : lesson.content;
      setForumConfig(parsed as ForumLessonContent);
    } catch {
      setForumConfig({ prompt: '', settings: { allowNewThreads: true, requirePost: true, requireReply: false } });
    }
    loadPosts();
  }, [lesson.id]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const postsData = await forumService.getPostsByLesson(lesson.id);
      const mapped = postsData as unknown as ForumPost[];
      setPosts(mapped);
      // Check if user already participated
      const userPosted = mapped.some(p => p.authorId === userId);
      if (userPosted) {
        setHasParticipated(true);
      } else {
        // Check replies too
        const allReplies = await forumService.getAllReplies();
        const postIds = new Set(mapped.map(p => p.id));
        const lessonReplies = (allReplies as unknown as ForumReply[]).filter(r => postIds.has(r.postId));
        if (lessonReplies.some(r => r.authorId === userId)) {
          setHasParticipated(true);
        }
      }
    } catch (error) {
      console.error('Error loading forum posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReplies = async (postId: string) => {
    try {
      const postReplies = await forumService.getReplies(postId);
      setReplies(prev => ({ ...prev, [postId]: postReplies as unknown as ForumReply[] }));
    } catch (error) {
      console.error('Error loading replies:', error);
    }
  };

  const handleSelectPost = async (post: ForumPost) => {
    setSelectedPost(post);
    await loadReplies(post.id);
    // Increment views
    await forumService.updatePost(post.id, { views: post.views + 1 });
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, views: p.views + 1 } : p));
  };

  const markParticipated = () => {
    if (!hasParticipated) {
      setHasParticipated(true);
      onParticipated();
    }
  };

  const handleCreatePost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) return;

    if (forumConfig?.settings.minPostLength && newPostContent.trim().length < forumConfig.settings.minPostLength) {
      alert(`La publicación debe tener al menos ${forumConfig.settings.minPostLength} caracteres.`);
      return;
    }

    const postData = {
      courseId,
      courseName: '',
      lessonId: lesson.id,
      lessonName: lesson.title,
      authorId: userId,
      authorName: userName,
      authorRole: userRole as 'student' | 'teacher' | 'admin',
      title: newPostTitle.trim(),
      content: newPostContent.trim(),
      isPinned: false,
      isResolved: false,
      likesCount: 0,
      likedBy: [],
      repliesCount: 0,
      views: 0,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const created = await forumService.createPost(postData as any);
    const newPost = { ...postData, id: created.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as ForumPost;
    setPosts(prev => [newPost, ...prev]);
    setNewPostTitle('');
    setNewPostContent('');
    setShowNewPost(false);
    markParticipated();
  };

  const handleReply = async () => {
    if (!selectedPost || !replyContent.trim()) return;

    if (forumConfig?.settings.minPostLength && replyContent.trim().length < forumConfig.settings.minPostLength) {
      alert(`La respuesta debe tener al menos ${forumConfig.settings.minPostLength} caracteres.`);
      return;
    }

    const replyData = {
      postId: selectedPost.id,
      parentReplyId: replyingTo || undefined,
      authorId: userId,
      authorName: userName,
      authorRole: userRole as 'student' | 'teacher' | 'admin',
      content: replyContent.trim(),
      isAnswer: false,
      likesCount: 0,
      likedBy: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const created = await forumService.createReply(replyData as any);
    const newReply = { ...replyData, id: created.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as ForumReply;

    setReplies(prev => ({
      ...prev,
      [selectedPost.id]: [...(prev[selectedPost.id] || []), newReply],
    }));

    const updatedPost = { ...selectedPost, repliesCount: selectedPost.repliesCount + 1 };
    await forumService.updatePost(selectedPost.id, { repliesCount: updatedPost.repliesCount });
    setSelectedPost(updatedPost);
    setPosts(prev => prev.map(p => p.id === selectedPost.id ? updatedPost : p));

    setReplyContent('');
    setReplyingTo(null);
    markParticipated();
  };

  const handleLikePost = async (post: ForumPost) => {
    const hasLiked = post.likedBy.includes(userId);
    const updated = {
      ...post,
      likesCount: hasLiked ? post.likesCount - 1 : post.likesCount + 1,
      likedBy: hasLiked ? post.likedBy.filter(id => id !== userId) : [...post.likedBy, userId],
    };
    await forumService.updatePost(post.id, { likesCount: updated.likesCount, likedBy: updated.likedBy });
    setPosts(prev => prev.map(p => p.id === post.id ? updated : p));
    if (selectedPost?.id === post.id) setSelectedPost(updated);
  };

  const handleLikeReply = async (reply: ForumReply) => {
    const hasLiked = reply.likedBy.includes(userId);
    const updated = {
      ...reply,
      likesCount: hasLiked ? reply.likesCount - 1 : reply.likesCount + 1,
      likedBy: hasLiked ? reply.likedBy.filter(id => id !== userId) : [...reply.likedBy, userId],
    };
    await forumService.updateReply(reply.id, { likesCount: updated.likesCount, likedBy: updated.likedBy });
    setReplies(prev => ({
      ...prev,
      [reply.postId]: prev[reply.postId].map(r => r.id === reply.id ? updated : r),
    }));
  };

  const handleMarkAsAnswer = async (reply: ForumReply) => {
    if (!selectedPost) return;
    if (userId !== selectedPost.authorId && userRole !== 'admin' && userRole !== 'teacher') return;

    // Unmark existing answers
    const postReplies = replies[selectedPost.id] || [];
    for (const r of postReplies) {
      if (r.isAnswer && r.id !== reply.id) {
        await forumService.updateReply(r.id, { isAnswer: false });
      }
    }

    const updated = { ...reply, isAnswer: !reply.isAnswer };
    await forumService.updateReply(reply.id, { isAnswer: updated.isAnswer });

    const updatedPost = { ...selectedPost, isResolved: updated.isAnswer };
    await forumService.updatePost(selectedPost.id, { isResolved: updatedPost.isResolved });

    setReplies(prev => ({
      ...prev,
      [selectedPost.id]: prev[selectedPost.id].map(r =>
        r.id === reply.id ? updated : { ...r, isAnswer: false }
      ),
    }));
    setSelectedPost(updatedPost);
    setPosts(prev => prev.map(p => p.id === selectedPost.id ? updatedPost : p));
  };

  const handlePinPost = async (post: ForumPost) => {
    if (userRole !== 'admin' && userRole !== 'teacher') return;
    const updated = { ...post, isPinned: !post.isPinned };
    await forumService.updatePost(post.id, { isPinned: updated.isPinned });
    setPosts(prev => prev.map(p => p.id === post.id ? updated : p));
    if (selectedPost?.id === post.id) setSelectedPost(updated);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta publicación?')) return;
    await forumService.deletePost(postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    if (selectedPost?.id === postId) setSelectedPost(null);
  };

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
      student: { color: 'bg-gray-100 text-gray-800', label: 'Estudiante' },
    };
    const badge = badges[role] || badges.student;
    return <span className={`text-xs px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>;
  };

  const sortedPosts = [...posts].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Prompt del profesor */}
      {forumConfig?.prompt && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-5 w-5 text-teal-600" />
            <h3 className="font-semibold text-teal-900">Tema de Discusión</h3>
          </div>
          <p className="text-teal-800 whitespace-pre-wrap">{forumConfig.prompt}</p>
        </div>
      )}

      {/* Participation status */}
      {forumConfig?.settings.requirePost && (
        <div className={`flex items-center gap-2 mb-4 text-sm ${hasParticipated ? 'text-green-600' : 'text-amber-600'}`}>
          {hasParticipated ? (
            <>
              <CheckCircle className="h-4 w-4" />
              <span>Has participado en este foro - Lección completada</span>
            </>
          ) : (
            <>
              <MessageCircle className="h-4 w-4" />
              <span>Debes participar en el foro para completar esta lección</span>
            </>
          )}
        </div>
      )}

      {/* Post detail view */}
      {selectedPost ? (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedPost(null)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver a publicaciones
          </Button>

          <Card className="mb-4">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {selectedPost.isPinned && (
                      <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full flex items-center">
                        <Pin className="h-3 w-3 mr-1" /> Fijado
                      </span>
                    )}
                    {selectedPost.isResolved && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full flex items-center">
                        <CheckCircle className="h-3 w-3 mr-1" /> Resuelto
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedPost.title}</h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-medium">
                      {selectedPost.authorName.charAt(0).toUpperCase()}
                    </div>
                    <span>{selectedPost.authorName}</span>
                    {getRoleBadge(selectedPost.authorRole)}
                    <span>{formatDate(selectedPost.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {(userRole === 'admin' || userRole === 'teacher') && (
                    <Button variant="ghost" size="sm" onClick={() => handlePinPost(selectedPost)} className={selectedPost.isPinned ? 'text-orange-600' : ''}>
                      <Pin className="h-4 w-4" />
                    </Button>
                  )}
                  {(userId === selectedPost.authorId || userRole === 'admin') && (
                    <Button variant="ghost" size="sm" onClick={() => handleDeletePost(selectedPost.id)} className="text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-gray-700 whitespace-pre-wrap mb-4">{selectedPost.content}</p>

              <div className="flex items-center gap-4 pt-3 border-t">
                <Button
                  variant={selectedPost.likedBy.includes(userId) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleLikePost(selectedPost)}
                >
                  <ThumbsUp className="h-4 w-4 mr-1" />
                  {selectedPost.likesCount}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setReplyingTo(null); replyInputRef.current?.focus(); }}>
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Responder
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Replies */}
          <h4 className="font-medium text-gray-900 mb-3">
            {selectedPost.repliesCount} {selectedPost.repliesCount === 1 ? 'Respuesta' : 'Respuestas'}
          </h4>

          <div className="space-y-3 mb-6">
            {(replies[selectedPost.id] || []).map(reply => {
              const isNested = !!reply.parentReplyId;
              return (
                <div
                  key={reply.id}
                  className={`p-4 rounded-lg ${reply.isAnswer ? 'bg-green-50 border-2 border-green-200' : 'bg-gray-50'} ${isNested ? 'ml-8' : ''}`}
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
                      <div className="flex items-center gap-3 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLikeReply(reply)}
                          className={reply.likedBy.includes(userId) ? 'text-blue-600' : ''}
                        >
                          <ThumbsUp className="h-3 w-3 mr-1" />
                          {reply.likesCount}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setReplyingTo(reply.id); replyInputRef.current?.focus(); }}
                        >
                          <MessageCircle className="h-3 w-3 mr-1" />
                          Responder
                        </Button>
                        {(userId === selectedPost.authorId || userRole === 'admin' || userRole === 'teacher') && !reply.isAnswer && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkAsAnswer(reply)}
                            className="text-green-600"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Marcar como respuesta
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reply input */}
          <div className="border-t pt-4">
            {replyingTo && (
              <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
                <span>Respondiendo a un comentario</span>
                <button onClick={() => setReplyingTo(null)} className="text-red-500 hover:underline">Cancelar</button>
              </div>
            )}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <textarea
                  ref={replyInputRef}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Escribe tu respuesta..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
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
        </div>
      ) : (
        /* Posts list */
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-teal-600" />
              Publicaciones ({posts.length})
            </h3>
            {(forumConfig?.settings.allowNewThreads || userRole === 'teacher' || userRole === 'admin') && (
              <Button size="sm" onClick={() => setShowNewPost(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Nueva Publicación
              </Button>
            )}
          </div>

          {sortedPosts.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No hay publicaciones aún</p>
              <p className="text-sm mt-1">Sé el primero en participar en la discusión</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedPosts.map(post => (
                <div
                  key={post.id}
                  onClick={() => handleSelectPost(post)}
                  className="p-4 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-teal-300 hover:bg-teal-50/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium flex-shrink-0">
                      {post.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {post.isPinned && <Pin className="h-3 w-3 text-orange-500" />}
                        {post.isResolved && <CheckCircle className="h-4 w-4 text-green-500" />}
                        <h4 className="font-medium text-gray-900 truncate">{post.title}</h4>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{post.content}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center">
                          <User className="h-3 w-3 mr-1" />
                          {post.authorName}
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New Post Modal */}
          {showNewPost && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg max-w-xl w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Nueva Publicación</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowNewPost(false)}>×</Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                    <input
                      value={newPostTitle}
                      onChange={(e) => setNewPostTitle(e.target.value)}
                      placeholder="Título de tu publicación"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contenido *</label>
                    <textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="Escribe tu publicación..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 h-32 resize-none"
                    />
                    {forumConfig?.settings.minPostLength && (
                      <p className="text-xs text-gray-500 mt-1">
                        Mínimo {forumConfig.settings.minPostLength} caracteres ({newPostContent.length}/{forumConfig.settings.minPostLength})
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowNewPost(false)}>Cancelar</Button>
                  <Button onClick={handleCreatePost} disabled={!newPostTitle.trim() || !newPostContent.trim()}>
                    <Send className="h-4 w-4 mr-2" />
                    Publicar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
