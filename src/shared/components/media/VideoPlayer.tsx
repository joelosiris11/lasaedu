import { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  CheckCircle
} from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  title?: string;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  completionThreshold?: number; // Porcentaje para marcar como completado (default 90%)
  initialProgress?: number;
  poster?: string;
}

export default function VideoPlayer({
  url,
  title,
  onProgress,
  onComplete,
  completionThreshold = 90,
  initialProgress = 0,
  poster
}: VideoPlayerProps) {
  const playerRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [played, setPlayed] = useState(initialProgress / 100);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detectar tipo de video
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  const isVimeo = url.includes('vimeo.com');

  // Añadir params para ocultar sugerencias de YouTube
  const playerSrc = isYouTube
    ? `${url}${url.includes('?') ? '&' : '?'}rel=0&modestbranding=1`
    : url;

  useEffect(() => {
    // Marcar como completado si supera el threshold
    if (played * 100 >= completionThreshold && !isCompleted) {
      setIsCompleted(true);
      onComplete?.();
    }
  }, [played, completionThreshold, isCompleted, onComplete]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const el = e.currentTarget;
    if (el.duration && !seeking) {
      const p = el.currentTime / el.duration;
      setPlayed(p);
      onProgress?.(Math.round(p * 100));
    }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayed(parseFloat(e.target.value));
  };

  const handleSeekMouseDown = () => {
    setSeeking(true);
  };

  const handleSeekMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    setSeeking(false);
    const time = parseFloat((e.target as HTMLInputElement).value) * duration;
    if (playerRef.current) playerRef.current.currentTime = time;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setMuted(newVolume === 0);
  };

  const toggleMute = () => {
    setMuted(!muted);
  };

  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (playing) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div 
      ref={containerRef}
      className="relative bg-black rounded-xl overflow-hidden group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      {/* Video Player */}
      <div className="aspect-video">
        <ReactPlayer
          ref={playerRef}
          src={playerSrc}
          width="100%"
          height="100%"
          playing={playing}
          volume={volume}
          muted={muted}
          playbackRate={playbackRate}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => {
            setPlaying(false);
            if (!isCompleted) {
              setIsCompleted(true);
              onComplete?.();
            }
          }}
          light={poster}
        />
      </div>

      {/* Overlay de completado */}
      {isCompleted && !playing && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <div className="text-center text-white">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <p className="text-xl font-semibold">¡Video completado!</p>
            <button 
              onClick={() => {
                if (playerRef.current) playerRef.current.currentTime = 0;
                setPlaying(true);
              }}
              className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
            >
              Ver de nuevo
            </button>
          </div>
        </div>
      )}

      {/* Controles */}
      <div 
        className={`absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Título */}
        {title && (
          <div className="text-white text-sm font-medium mb-2 truncate">
            {title}
          </div>
        )}

        {/* Barra de progreso */}
        <div className="relative mb-3">
          <input
            type="range"
            min={0}
            max={0.999999}
            step="any"
            value={played}
            onChange={handleSeekChange}
            onMouseDown={handleSeekMouseDown}
            onMouseUp={handleSeekMouseUp}
            className="w-full h-1 appearance-none bg-white/20 rounded-full cursor-pointer 
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 
              [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full 
              [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:shadow-lg"
            style={{
              background: `linear-gradient(to right, #3b82f6 ${played * 100}%, rgba(255,255,255,0.2) ${played * 100}%)`
            }}
          />
        </div>

        {/* Controles inferiores */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center space-x-3">
            {/* Play/Pause */}
            <button 
              onClick={() => setPlaying(!playing)}
              className="p-2 hover:bg-white/20 rounded-full transition"
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>

            {/* Volume */}
            <div className="flex items-center space-x-2 group/volume">
              <button 
                onClick={toggleMute}
                className="p-1.5 hover:bg-white/20 rounded-full transition"
              >
                {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover/volume:w-20 transition-all duration-200 h-1 appearance-none bg-white/30 rounded-full cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 
                  [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full 
                  [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            {/* Time */}
            <span className="text-sm">
              {formatTime(played * duration)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Indicador de completado */}
            {isCompleted && (
              <span className="flex items-center text-green-400 text-sm">
                <CheckCircle className="h-4 w-4 mr-1" />
                Completado
              </span>
            )}

            {/* Settings */}
            <div className="relative">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="p-1.5 hover:bg-white/20 rounded-full transition"
              >
                <Settings className="h-4 w-4" />
              </button>
              
              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 bg-gray-900 rounded-lg p-2 min-w-32">
                  <div className="text-xs text-gray-400 mb-2">Velocidad</div>
                  {playbackRates.map(rate => (
                    <button
                      key={rate}
                      onClick={() => {
                        setPlaybackRate(rate);
                        setShowSettings(false);
                      }}
                      className={`block w-full text-left px-3 py-1.5 rounded text-sm hover:bg-white/10 ${
                        playbackRate === rate ? 'text-blue-400' : 'text-white'
                      }`}
                    >
                      {rate}x {rate === 1 && '(Normal)'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button 
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-white/20 rounded-full transition"
            >
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Click to play/pause overlay */}
      {!isCompleted && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={() => setPlaying(!playing)}
        >
          {!playing && (
            <div className="bg-blue-600/90 hover:bg-blue-500/90 p-5 rounded-full transition shadow-2xl">
              <Play className="h-10 w-10 text-white" fill="white" />
            </div>
          )}
        </div>
      )}

      {/* Badges de plataforma */}
      {(isYouTube || isVimeo) && (
        <div className="absolute top-3 right-3">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            isYouTube ? 'bg-red-600 text-white' : 'bg-blue-500 text-white'
          }`}>
            {isYouTube ? 'YouTube' : 'Vimeo'}
          </span>
        </div>
      )}
    </div>
  );
}
