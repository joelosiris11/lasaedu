import { useState, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { gamificationService } from '@shared/services/dataService';
import { 
  Trophy,
  Star,
  Zap,
  Target,
  Award,
  TrendingUp,
  Medal,
  Crown,
  Flame,
  BookOpen,
  CheckCircle,
  Lock
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
// Button import removed - not currently used

interface UserPoints {
  id: string;
  oderId: string;
  totalPoints: number;
  level: number;
  currentLevelPoints: number;
  pointsToNextLevel: number;
  streak: number;
  lastActivityDate: string;
  badges: string[];
  achievements: Achievement[];
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  pointsRequired?: number;
  coursesRequired?: number;
  streakRequired?: number;
  unlockedAt?: string;
  progress: number; // 0-100
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  points: number;
  level: number;
  badges: number;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  requirement: string;
}

const BADGES: Badge[] = [
  { id: 'first_course', name: 'Primer Paso', description: 'Completar tu primer curso', icon: '🎯', rarity: 'common', requirement: 'Completar 1 curso' },
  { id: 'five_courses', name: 'Estudiante Dedicado', description: 'Completar 5 cursos', icon: '📚', rarity: 'rare', requirement: 'Completar 5 cursos' },
  { id: 'perfect_score', name: 'Perfeccionista', description: 'Obtener 100% en una evaluación', icon: '💯', rarity: 'epic', requirement: '100% en evaluación' },
  { id: 'streak_7', name: 'Constante', description: 'Mantener una racha de 7 días', icon: '🔥', rarity: 'rare', requirement: 'Racha de 7 días' },
  { id: 'streak_30', name: 'Imparable', description: 'Mantener una racha de 30 días', icon: '⚡', rarity: 'legendary', requirement: 'Racha de 30 días' },
  { id: 'early_bird', name: 'Madrugador', description: 'Completar una lección antes de las 7am', icon: '🌅', rarity: 'common', requirement: 'Lección antes de 7am' },
  { id: 'night_owl', name: 'Búho Nocturno', description: 'Completar una lección después de las 11pm', icon: '🦉', rarity: 'common', requirement: 'Lección después de 11pm' },
  { id: 'helper', name: 'Ayudante', description: 'Responder 10 preguntas en foros', icon: '🤝', rarity: 'rare', requirement: '10 respuestas en foros' },
  { id: 'quiz_master', name: 'Maestro del Quiz', description: 'Completar 20 quizzes', icon: '🧠', rarity: 'epic', requirement: 'Completar 20 quizzes' },
  { id: 'champion', name: 'Campeón', description: 'Alcanzar el top 3 del leaderboard', icon: '👑', rarity: 'legendary', requirement: 'Top 3 leaderboard' }
];

const GAME_LEVELS = [
  { level: 1, name: 'Novato', minPoints: 0, maxPoints: 100 },
  { level: 2, name: 'Aprendiz', minPoints: 100, maxPoints: 300 },
  { level: 3, name: 'Estudiante', minPoints: 300, maxPoints: 600 },
  { level: 4, name: 'Intermedio', minPoints: 600, maxPoints: 1000 },
  { level: 5, name: 'Avanzado', minPoints: 1000, maxPoints: 1500 },
  { level: 6, name: 'Experto', minPoints: 1500, maxPoints: 2200 },
  { level: 7, name: 'Maestro', minPoints: 2200, maxPoints: 3000 },
  { level: 8, name: 'Gran Maestro', minPoints: 3000, maxPoints: 4000 },
  { level: 9, name: 'Leyenda', minPoints: 4000, maxPoints: 5500 },
  { level: 10, name: 'Iluminado', minPoints: 5500, maxPoints: Infinity }
];

export default function GamificationPage() {
  const { user } = useAuthStore();
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [unlockedBadges, setUnlockedBadges] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'leaderboard'>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGamificationData();
  }, []);

  const loadGamificationData = async () => {
    try {
      // Load user points from Firebase
      let points = await gamificationService.getUserPoints(user?.id || '');

      if (!points && user) {
        // Initialize user points
        points = await gamificationService.createUserPoints(user.id);
      }

      // Load user badges
      const userBadges = await gamificationService.getUserBadges(user?.id || '');
      const badgeIds = userBadges.map(b => b.badgeId);

      // Load user streak
      const streak = await gamificationService.getUserStreak(user?.id || '');

      // Map to local interface if points exist
      const mappedPoints: UserPoints | null = points ? {
        id: points.id,
        oderId: points.userId || user?.id || '',
        totalPoints: points.totalPoints || 0,
        level: points.level || 1,
        currentLevelPoints: (points.totalPoints || 0) % 100,
        pointsToNextLevel: points.nextLevelPoints || 100,
        streak: streak?.currentStreak || 0,
        lastActivityDate: streak?.lastActiveDate || new Date().toISOString(),
        badges: badgeIds,
        achievements: []
      } : null;

      setUserPoints(mappedPoints);
      setUnlockedBadges(badgeIds);

      // Load leaderboard from Firebase
      const leaderboardData = await gamificationService.getLeaderboard(10);

      // If user is not in top 10, add them at their position
      const userInLeaderboard = leaderboardData.find(e => e.userId === user?.id);
      if (!userInLeaderboard && user && mappedPoints) {
        // Calculate user rank (count how many have more points)
        const allPoints = await gamificationService.getUserPoints(user.id);
        const userRank = leaderboardData.filter(e => e.points > (allPoints?.totalPoints || 0)).length + 1;

        leaderboardData.push({
          rank: userRank,
          userId: user.id,
          userName: user.name,
          points: mappedPoints.totalPoints,
          level: mappedPoints.level,
          badges: 0
        });
      }

      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Error loading gamification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLevel = () => {
    return GAME_LEVELS.find(l => 
      (userPoints?.totalPoints || 0) >= l.minPoints && 
      (userPoints?.totalPoints || 0) < l.maxPoints
    ) || GAME_LEVELS[0];
  };

  const getProgressToNextLevel = () => {
    const currentLevel = getCurrentLevel();
    const nextLevel = GAME_LEVELS.find(l => l.level === currentLevel.level + 1);
    if (!nextLevel) return 100;
    
    const pointsInLevel = (userPoints?.totalPoints || 0) - currentLevel.minPoints;
    const levelRange = currentLevel.maxPoints - currentLevel.minPoints;
    return Math.round((pointsInLevel / levelRange) * 100);
  };

  const getRarityColor = (rarity: Badge['rarity']) => {
    switch (rarity) {
      case 'common': return 'from-gray-100 to-gray-200 border-gray-300';
      case 'rare': return 'from-blue-100 to-blue-200 border-blue-400';
      case 'epic': return 'from-purple-100 to-purple-200 border-purple-400';
      case 'legendary': return 'from-yellow-100 to-amber-200 border-yellow-500';
    }
  };

  const getRarityLabel = (rarity: Badge['rarity']) => {
    switch (rarity) {
      case 'common': return { text: 'Común', color: 'text-gray-600' };
      case 'rare': return { text: 'Raro', color: 'text-blue-600' };
      case 'epic': return { text: 'Épico', color: 'text-purple-600' };
      case 'legendary': return { text: 'Legendario', color: 'text-yellow-600' };
    }
  };

  const userRank = leaderboard.find(e => e.userId === user?.id)?.rank || '-';
  const currentLevel = getCurrentLevel();

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
          <h1 className="text-2xl font-bold text-gray-900">Gamificación</h1>
          <p className="text-gray-600">Gana puntos, desbloquea logros y compite con otros estudiantes</p>
        </div>
      </div>

      {/* User Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm">Puntos Totales</p>
                <p className="text-3xl font-bold">{userPoints?.totalPoints || 0}</p>
              </div>
              <Star className="h-10 w-10 text-indigo-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Nivel Actual</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {currentLevel.level} - {currentLevel.name}
                </p>
              </div>
              <Trophy className="h-10 w-10 text-yellow-500" />
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progreso al siguiente nivel</span>
                <span>{getProgressToNextLevel()}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all"
                  style={{ width: `${getProgressToNextLevel()}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Racha Actual</p>
                <p className="text-2xl font-bold text-orange-600">
                  {userPoints?.streak || 0} días
                </p>
              </div>
              <Flame className="h-10 w-10 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Ranking</p>
                <p className="text-2xl font-bold text-green-600">#{userRank}</p>
              </div>
              <Medal className="h-10 w-10 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2 px-1 font-medium ${
            activeTab === 'overview' 
              ? 'border-b-2 border-indigo-600 text-indigo-600' 
              : 'text-gray-500'
          }`}
        >
          <Target className="h-4 w-4 inline mr-2" />
          Resumen
        </button>
        <button
          onClick={() => setActiveTab('badges')}
          className={`pb-2 px-1 font-medium ${
            activeTab === 'badges' 
              ? 'border-b-2 border-indigo-600 text-indigo-600' 
              : 'text-gray-500'
          }`}
        >
          <Award className="h-4 w-4 inline mr-2" />
          Insignias ({unlockedBadges.length}/{BADGES.length})
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`pb-2 px-1 font-medium ${
            activeTab === 'leaderboard' 
              ? 'border-b-2 border-indigo-600 text-indigo-600' 
              : 'text-gray-500'
          }`}
        >
          <TrendingUp className="h-4 w-4 inline mr-2" />
          Clasificación
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* How to Earn Points */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Zap className="h-5 w-5 text-yellow-500 mr-2" />
                Cómo Ganar Puntos
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <BookOpen className="h-5 w-5 text-blue-500 mr-3" />
                    <span>Completar una lección</span>
                  </div>
                  <span className="font-bold text-indigo-600">+10 pts</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    <span>Aprobar un quiz</span>
                  </div>
                  <span className="font-bold text-indigo-600">+25 pts</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <Trophy className="h-5 w-5 text-yellow-500 mr-3" />
                    <span>Completar un curso</span>
                  </div>
                  <span className="font-bold text-indigo-600">+100 pts</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <Flame className="h-5 w-5 text-orange-500 mr-3" />
                    <span>Bonus de racha diaria</span>
                  </div>
                  <span className="font-bold text-indigo-600">+5 pts/día</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <Star className="h-5 w-5 text-purple-500 mr-3" />
                    <span>100% en evaluación</span>
                  </div>
                  <span className="font-bold text-indigo-600">+50 pts</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Achievements */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Award className="h-5 w-5 text-purple-500 mr-2" />
                Insignias Recientes
              </h3>
              <div className="space-y-3">
                {BADGES.filter(b => unlockedBadges.includes(b.id)).slice(0, 4).map(badge => (
                  <div 
                    key={badge.id}
                    className={`flex items-center p-3 rounded-lg bg-gradient-to-r ${getRarityColor(badge.rarity)} border`}
                  >
                    <span className="text-2xl mr-3">{badge.icon}</span>
                    <div>
                      <p className="font-medium">{badge.name}</p>
                      <p className="text-xs text-gray-600">{badge.description}</p>
                    </div>
                  </div>
                ))}
                {unlockedBadges.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    ¡Completa actividades para desbloquear insignias!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Level Progress */}
          <Card className="md:col-span-2">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Progreso de Niveles</h3>
              <div className="flex flex-wrap gap-2">
                {GAME_LEVELS.map(level => {
                  const isUnlocked = (userPoints?.totalPoints || 0) >= level.minPoints;
                  const isCurrent = level.level === currentLevel.level;
                  
                  return (
                    <div 
                      key={level.level}
                      className={`flex-1 min-w-[100px] p-3 rounded-lg border-2 transition-all ${
                        isCurrent 
                          ? 'border-indigo-500 bg-indigo-50' 
                          : isUnlocked 
                            ? 'border-green-300 bg-green-50' 
                            : 'border-gray-200 bg-gray-50 opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-lg">{level.level}</span>
                        {!isUnlocked && <Lock className="h-4 w-4 text-gray-400" />}
                        {isUnlocked && !isCurrent && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {isCurrent && <Crown className="h-4 w-4 text-indigo-500" />}
                      </div>
                      <p className="text-sm font-medium">{level.name}</p>
                      <p className="text-xs text-gray-500">{level.minPoints} pts</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Badges Tab */}
      {activeTab === 'badges' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {BADGES.map(badge => {
            const isUnlocked = unlockedBadges.includes(badge.id);
            const rarityInfo = getRarityLabel(badge.rarity);
            
            return (
              <Card 
                key={badge.id}
                className={`transition-all hover:shadow-lg ${
                  isUnlocked ? '' : 'opacity-50 grayscale'
                }`}
              >
                <CardContent className="p-4 text-center">
                  <div className={`w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center bg-gradient-to-br ${getRarityColor(badge.rarity)} border-2`}>
                    <span className="text-3xl">{badge.icon}</span>
                  </div>
                  <h4 className="font-medium text-sm mb-1">{badge.name}</h4>
                  <p className="text-xs text-gray-500 mb-2">{badge.description}</p>
                  <span className={`text-xs font-medium ${rarityInfo.color}`}>
                    {rarityInfo.text}
                  </span>
                  {!isUnlocked && (
                    <div className="mt-2 flex items-center justify-center text-xs text-gray-400">
                      <Lock className="h-3 w-3 mr-1" />
                      Bloqueado
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Posición</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Estudiante</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Nivel</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Puntos</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Insignias</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => {
                    const isCurrentUser = entry.userId === user?.id;
                    const levelInfo = GAME_LEVELS.find(l => l.level === entry.level);
                    
                    return (
                      <tr 
                        key={entry.userId}
                        className={`border-b hover:bg-gray-50 ${
                          isCurrentUser ? 'bg-indigo-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            {entry.rank <= 3 ? (
                              <span className={`text-2xl ${
                                entry.rank === 1 ? 'text-yellow-500' :
                                entry.rank === 2 ? 'text-gray-400' :
                                'text-amber-600'
                              }`}>
                                {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                              </span>
                            ) : (
                              <span className="text-lg font-bold text-gray-600 w-8 text-center">
                                {entry.rank}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center mr-3 ${
                              isCurrentUser ? 'bg-indigo-600 text-white' : 'bg-gray-200'
                            }`}>
                              {entry.userName.charAt(0)}
                            </div>
                            <div>
                              <p className={`font-medium ${isCurrentUser ? 'text-indigo-600' : ''}`}>
                                {entry.userName}
                                {isCurrentUser && <span className="ml-2 text-xs">(Tú)</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            Nv. {entry.level} - {levelInfo?.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-lg">{entry.points.toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center">
                            <Award className="h-4 w-4 text-yellow-500 mr-1" />
                            {entry.badges}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
