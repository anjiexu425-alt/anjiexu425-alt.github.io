import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BookOpen, 
  Book, 
  PenTool, 
  Plus, 
  ChevronRight, 
  ChevronLeft, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Music, 
  Trash2, 
  Sparkles, 
  X, 
  Loader2, 
  Check, 
  Layers, 
  Heart,
  Calendar,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DiarySpread, PresetMedia } from './types';
import { INITIAL_SPREADS, PRESET_MEDIA_LIST, AMBIENT_TRACKS, curDate, BLANK_SPREAD, CATEGORY_OPTIONS } from './data';

/* =======================================================
   REUSABLE SUB-COMPONENTS FOR 3D STAGE & PAGE TRANSITIONS
   ======================================================= */

function BookCover({ onClick, isInsideFlip = false }: { onClick?: (e: React.MouseEvent) => void; isInsideFlip?: boolean }) {
  return (
    <div
      id="diary-closed-book-inner"
      className={`w-full h-full rounded-[24px] md:rounded-[32px] bg-brand-blue relative flex flex-col justify-between p-8 sm:p-12 text-white overflow-hidden select-none border-l-8 border-[#002699] ${!isInsideFlip ? 'book-shadow cursor-pointer' : ''}`}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {/* Book Spine Overlay Tactile Highlight */}
      <div id="spine-line" className="absolute left-2 top-0 bottom-0 w-[2px] bg-black/10 z-10"></div>
      <div id="spine-highlight" className="absolute left-3 top-0 bottom-0 w-[4px] bg-white/5 z-10"></div>
      
      {/* Visual Cover Art Embossing Blobs */}
      <div id="cover-glow-blob" className="absolute -top-[10%] -right-[10%] w-[250px] h-[250px] rounded-full bg-white/10 blur-[50px] pointer-events-none"></div>

      {/* Cover Top section */}
      <div id="cover-tagline-sec" className="flex items-center gap-1.5 opacity-60">
        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
        <span id="cover-category-title" className="font-mono text-[9px] tracking-[0.3em] uppercase">Healing Journey</span>
      </div>

      {/* Cover Title section (Matches user image exactly) */}
      <div id="cover-title-sec" className="mb-6 z-10">
        <p id="cover-year-label" className="font-serif italic text-sm tracking-[0.1em] text-white/70 mb-2 font-light">
          ABROAD DIARY / 2026
        </p>
        <h1 id="cover-main-title" className="font-serif font-black text-5xl md:text-[54px] tracking-tight leading-[1.05] text-white">
          Abroad<br />Diary.
        </h1>
      </div>

      {/* Overlapping Next Button on Right Side (Matches user cover button exactly) */}
      {onClick && (
        <button
          id="cover-enter-book-btn"
          onClick={onClick}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-14 h-14 rounded-full bg-white flex items-center justify-center text-brand-blue shadow-lg border border-neutral-100 hover:scale-110 active:scale-95 duration-200 group z-20 cursor-pointer"
        >
          <ChevronRight size={24} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* Staggered pages under cover edge */}
      <div id="staggered-under-pages" className="absolute right-0 top-4 bottom-4 w-[5px] bg-[#f9f9f9] rounded-r-sm shadow-md" style={{ transform: 'translateZ(-10px)' }}></div>
      <div id="staggered-under-pages-2" className="absolute right-0 top-8 bottom-8 w-[10px] bg-[#eeeeee] rounded-r-xs shadow-sm" style={{ transform: 'translateZ(-20px)' }}></div>
    </div>
  );
}

const LeftPage = React.memo(function LeftPage({ 
  spread, 
  canDelete, 
  handleDeleteSpread,
  onWrite
}: { 
  spread: DiarySpread; 
  canDelete: boolean;
  handleDeleteSpread: (id: string, e: React.MouseEvent) => void;
  onWrite?: () => void;
}) {
  return (
    <div 
      className="w-full h-full p-4 sm:p-8 md:p-12 lg:p-14 flex flex-col justify-between bg-cream-light relative border-r border-black/[0.04] book-page-left-shadow overflow-y-auto paper-texture select-text"
      style={{ backfaceVisibility: 'hidden' }}
    >
      {/* Top metadata row */}
      <div id="left-page-header-meta" className="flex items-center justify-between pb-3 sm:pb-4 border-b border-neutral-200/60 font-mono text-[9px] sm:text-[10px] tracking-wider text-neutral-400">
        <span id="page-tag-label" className="uppercase font-semibold text-brand-blue/80 truncate max-w-[80px] sm:max-w-none">
          {spread.leftPage.category || '01 / JOURNAL'}
        </span>
        <span id="page-date-label" className="flex items-center gap-1 whitespace-nowrap">
          <Calendar size={10} />
          {spread.leftPage.date}
        </span>
      </div>

      {/* Inner scrollable writing body */}
      <div id="left-page-scrollable-body" className="flex-1 flex flex-col justify-center py-4 sm:py-6">
        {/* Main serif title */}
        <h2 id="left-page-title" className="font-serif font-black text-sm sm:text-2xl md:text-3xl lg:text-[36px] text-neutral-800 leading-[1.15] tracking-tight mb-2 sm:mb-4">
          {spread.leftPage.title}
        </h2>

        {/* Poetic Blockquote / Quote section */}
        {spread.leftPage.quote && (
          <blockquote id="left-page-blockquote" className="font-serif italic text-[10px] sm:text-xs md:text-sm text-neutral-500 border-l-2 border-brand-blue/40 pl-2.5 sm:pl-3.5 py-1 my-2 sm:my-4 leading-relaxed bg-brand-blue/[0.01]">
            {spread.leftPage.quote}
          </blockquote>
        )}

        {/* Diary body paragraph block */}
        <div id="left-page-body-text" className="text-neutral-600 font-sans text-[10px] sm:text-xs md:text-[13px] lg:text-[14px] leading-relaxed space-y-2.5 sm:space-y-4 font-light tracking-wide whitespace-pre-wrap mb-4">
          {spread.leftPage.bodyText}
        </div>

        {spread.id === 'blank-spread' && onWrite && (
          <div className="mt-2 flex justify-start">
            <button
              id="blank-page-write-btn"
              onClick={onWrite}
              className="px-5 py-2 bg-brand-blue hover:bg-brand-blue-hover text-white rounded-full font-medium text-xs shadow-md shadow-brand-blue/20 transition-all flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95"
            >
              <PenTool size={12} />
              <span>Write My First Entry</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom metadata / deletion control */}
      <div id="left-page-footer-meta" className="flex items-center justify-between pt-3 sm:pt-4 border-t border-neutral-200/60 text-neutral-400 font-mono text-[9px] sm:text-[10px]">
        <span className="italic flex items-center gap-1 truncate max-w-[120px] sm:max-w-none">
          <Heart size={10} className="text-brand-blue" /> Abroad & Reflection Sanctuary
        </span>
        
        {canDelete && (
          <button 
            id={`delete-spread-btn-${spread.id}`}
            onClick={(e) => handleDeleteSpread(spread.id, e)}
            className="text-neutral-400 hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer"
            title="Delete this entry"
          >
            <Trash2 size={12} />
            <span className="hidden sm:inline">Discard</span>
          </button>
        )}
      </div>
    </div>
  );
});

const RightPage = React.memo(function RightPage({
  spread, 
  currentIndex, 
  totalSpreads, 
  isMutedVideos, 
  setIsMutedVideos, 
  videoRefs 
}: { 
  spread: DiarySpread; 
  currentIndex: number;
  totalSpreads: number;
  isMutedVideos: boolean;
  setIsMutedVideos: (muted: boolean) => void;
  videoRefs: React.MutableRefObject<{ [key: string]: HTMLVideoElement | null }>;
}) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const hasMultipleImages = !!(spread.rightPage.urls && spread.rightPage.urls.length > 0);

  return (
    <div 
      className="w-full h-full p-4 sm:p-8 md:p-12 lg:p-14 flex flex-col justify-between bg-[#fafaf9] book-page-right-shadow overflow-y-auto paper-texture"
      style={{ backfaceVisibility: 'hidden' }}
    >
      {/* Top right indicator */}
      <div id="right-page-header-meta" className="flex items-center justify-between pb-3 sm:pb-4 border-b border-neutral-200/60 font-mono text-[8px] sm:text-[9px] text-neutral-400 uppercase tracking-widest">
        <span className="flex items-center gap-1 truncate max-w-[100px] sm:max-w-none">
          <Layers size={10} /> Page Spread {currentIndex + 1} of {totalSpreads}
        </span>
        <span className="font-semibold text-brand-blue/80 truncate">
          {hasMultipleImages ? '📸 4 SNAPSHOTS' : spread.rightPage.type === 'video' ? '📽️ HEALING LOOP' : '🖼️ STILLNESS'}
        </span>
      </div>

      {/* Sunken Media Frame Canvas */}
      <div id="right-page-media-container" className="flex-1 flex flex-col justify-center py-4 sm:py-6">
        <div className="w-full aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-inner border border-black/10 bg-neutral-900 relative group flex items-center justify-center">
          
          {/* Media Loader */}
          <div className="absolute inset-0 bg-neutral-900/30 flex items-center justify-center -z-10">
            <Loader2 size={20} className="text-neutral-400 animate-spin" />
          </div>

          {hasMultipleImages ? (
            <div className="grid grid-cols-2 grid-rows-2 gap-1.5 w-full h-full p-1.5 bg-neutral-950">
              {spread.rightPage.urls!.map((imgUrl, idx) => (
                <div key={idx} className="relative overflow-hidden rounded-lg group/img cursor-zoom-in" onClick={() => setLightboxImage(imgUrl)}>
                  <img
                    src={imgUrl}
                    alt={`Snapshot ${idx + 1}`}
                    className="w-full h-full object-cover transition-all duration-500 ease-out hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors pointer-events-none" />
                </div>
              ))}
            </div>
          ) : spread.rightPage.type === 'video' ? (
            <video
              id={`right-page-video-${spread.id}`}
              ref={(el) => { if (el) { videoRefs.current[spread.id] = el; } }}
              src={spread.rightPage.url}
              autoPlay
              loop
              muted={isMutedVideos}
              playsInline
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
            />
          ) : (
            <img
              id={`right-page-image-${spread.id}`}
              src={spread.rightPage.url}
              alt={spread.leftPage.title}
              className="w-full h-full object-cover transition-all duration-[8000ms] ease-out hover:scale-110"
            />
          )}

          {spread.rightPage.type === 'video' && !hasMultipleImages && (
            <button
              id={`video-unmute-btn-${spread.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsMutedVideos(!isMutedVideos);
              }}
              className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 sm:p-2 backdrop-blur-xs transition-colors shadow-md border border-white/10 cursor-pointer z-10 animate-fade-in"
              title={isMutedVideos ? 'Unmute Video Atmosphere' : 'Mute Video Atmosphere'}
            >
              {isMutedVideos ? <VolumeX size={11} /> : <Volume2 size={11} />}
            </button>
          )}

          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-black/50 backdrop-blur-xs text-[8px] sm:text-[9px] font-mono font-medium text-white px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-white/10 uppercase tracking-widest pointer-events-none">
            {hasMultipleImages ? 'gallery' : spread.rightPage.type}
          </div>
        </div>

        {spread.rightPage.caption && (
          <p id="right-page-caption" className="font-display text-[9px] sm:text-xs text-neutral-400 text-center italic mt-2.5 sm:mt-4 leading-relaxed max-w-sm mx-auto px-2 select-text">
            {spread.rightPage.caption}
          </p>
        )}
      </div>

      {/* Bottom metadata */}
      <div id="right-page-footer-meta" className="flex items-center justify-between pt-3 sm:pt-4 border-t border-neutral-200/60 text-neutral-400 font-mono text-[8px] sm:text-[9px]">
        <span className="uppercase tracking-widest">Abroad in serenity</span>
        <span className="font-bold">2026 EDITION</span>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 shadow-2xl flex flex-col justify-center items-center">
            <img 
              src={lightboxImage} 
              alt="Enlarged gallery snapshot" 
              className="max-w-full max-h-[80vh] object-contain rounded-xl"
            />
            <button 
              className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 cursor-pointer transition-colors border border-white/10"
              onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }}
            >
              <X size={16} />
            </button>
            {spread.rightPage.caption && (
              <p className="text-center text-xs text-neutral-300 font-sans tracking-wide mt-3 px-4 py-2 rounded-lg bg-black/40 backdrop-blur-xs">
                {spread.rightPage.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.75)); // Compresses to lightweight JPEG
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image for compression.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
};

export default function App() {
  // State
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isFlipping, setIsFlipping] = useState<'next' | 'prev' | 'opening' | null>(null);
  const [spreads, setSpreads] = useState<DiarySpread[]>(() => {
    const saved = localStorage.getItem('abroad_diary_spreads') || localStorage.getItem('study_diary_spreads');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as DiarySpread[];
        // Automatically delete the old preset mock spreads from the user session
        const filtered = parsed.filter(s => !['old-spread-1', 'spread-2', 'spread-3', 'spread-4', 'spread-5'].includes(s.id));
        // Update spread-1 with the latest beach images
        const mapped = filtered.map(s => {
          if (s.id === 'spread-1') {
            return INITIAL_SPREADS[0];
          }
          return s;
        });
        return mapped.length > 0 ? mapped : INITIAL_SPREADS;
      } catch (e) {
        return INITIAL_SPREADS;
      }
    }
    return INITIAL_SPREADS;
  });
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Diary Writing Modal
  const [isWriting, setIsWriting] = useState<boolean>(false);
  const [editingSpreadId, setEditingSpreadId] = useState<string | null>(null);
  const handleOpenWriter = useCallback(() => setIsWriting(true), []);
  const [writingTitle, setWritingTitle] = useState<string>('');
  const [writingBody, setWritingBody] = useState<string>('');
  const [writingCategory, setWritingCategory] = useState<string>('Abroad');
  const [writingDate, setWritingDate] = useState<string>(curDate());
  const [customQuote, setCustomQuote] = useState<string>('');
  
  // Media selection for new entry
  const [selectedMedia, setSelectedMedia] = useState<PresetMedia>(PRESET_MEDIA_LIST[0]);
  const [customMediaUrl, setCustomMediaUrl] = useState<string>('');
  const [customImageUrls, setCustomImageUrls] = useState<string[]>(['', '', '', '']);
  const [customMediaType, setCustomMediaType] = useState<'image' | 'video'>('video');
  const [mediaCaption, setMediaCaption] = useState<string>('');
  const [useCustomMedia, setUseCustomMedia] = useState<boolean>(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState<boolean>(false);

  // Resets every writer-modal field back to its "new entry" defaults and
  // clears edit mode. Used after a successful save and on cancel/close so
  // an in-progress edit never leaks into the next "Write Diary" draft.
  const resetWriterForm = useCallback(() => {
    setEditingSpreadId(null);
    setWritingTitle('');
    setWritingBody('');
    setWritingCategory('Abroad');
    setWritingDate(curDate());
    setCustomQuote('');
    setSelectedMedia(PRESET_MEDIA_LIST[0]);
    setCustomMediaUrl('');
    setCustomImageUrls(['', '', '', '']);
    setCustomMediaType('video');
    setMediaCaption('');
    setUseCustomMedia(false);
  }, []);

  // AI Enrichment state
  const [isEnriching, setIsEnriching] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Background Music State
  const [isPlayingMusic, setIsPlayingMusic] = useState<boolean>(false);
  const [activeTrackIndex, setActiveTrackIndex] = useState<number>(0);
  const [musicVolume, setMusicVolume] = useState<number>(0.3);
  
  // Video player control state
  const [isMutedVideos, setIsMutedVideos] = useState<boolean>(true);

  // References
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  // Categories extracted from all spreads for filtering
  const allCategories: string[] = ['All', ...(Array.from(new Set(spreads.map(s => s.leftPage.category?.split('/')?.[1]?.trim() || s.leftPage.category || 'Abroad'))).filter(Boolean) as string[])];

  // Save to localStorage when spreads change
  useEffect(() => {
    localStorage.setItem('abroad_diary_spreads', JSON.stringify(spreads));
  }, [spreads]);

  // Audio setup and player synchronization
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(AMBIENT_TRACKS[activeTrackIndex].url);
      audioRef.current.loop = true;
    } else {
      audioRef.current.src = AMBIENT_TRACKS[activeTrackIndex].url;
    }
    
    audioRef.current.volume = musicVolume;
    
    if (isPlayingMusic) {
      audioRef.current.play().catch(err => {
        console.log('Audio autoplay blocked by browser permissions:', err);
        setIsPlayingMusic(false);
      });
    } else {
      audioRef.current.pause();
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [activeTrackIndex]);

  // Sync music play state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicVolume;
      if (isPlayingMusic) {
        audioRef.current.play().catch(() => setIsPlayingMusic(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlayingMusic, musicVolume]);

  // Filter spreads based on category and search query
  const filteredSpreads = spreads.filter(spread => {
    const categoryMatch = selectedCategory === 'All' || 
      (spread.leftPage.category && spread.leftPage.category.toLowerCase().includes(selectedCategory.toLowerCase())) ||
      (spread.leftPage.category === 'WELCOME' && selectedCategory === 'Welcome') ||
      (spread.leftPage.category?.includes('/') && spread.leftPage.category.split('/')[1].trim().toLowerCase() === selectedCategory.toLowerCase());
    
    const searchText = searchQuery.toLowerCase();
    const searchMatch = !searchQuery || 
      spread.leftPage.title.toLowerCase().includes(searchText) || 
      spread.leftPage.bodyText.toLowerCase().includes(searchText) ||
      (spread.leftPage.quote && spread.leftPage.quote.toLowerCase().includes(searchText));

    return categoryMatch && searchMatch;
  });

  // If the diary is completely empty, display the beautiful Welcoming BLANK_SPREAD fallback.
  const isDiaryEmpty = spreads.length === 0;
  const displaySpreads = isDiaryEmpty ? [BLANK_SPREAD] : filteredSpreads;

  // Keep index in safe range when filtered spreads change
  useEffect(() => {
    if (currentIndex >= displaySpreads.length && displaySpreads.length > 0) {
      setCurrentIndex(displaySpreads.length - 1);
    }
  }, [displaySpreads, currentIndex]);

  // Handle AI Diary Enrichment
  const handleAiEnrich = async () => {
    if (!writingTitle.trim() || !writingBody.trim()) {
      setAiError('Please enter an initial title and body text first so the AI has context to polish.');
      return;
    }

    setIsEnriching(true);
    setAiError(null);

    try {
      const response = await fetch('/api/enrich-diary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: writingTitle,
          bodyText: writingBody
        })
      });

      if (!response.ok) {
        throw new Error('Server responded with an error during AI processing');
      }

      const data = await response.json();
      
      // Update form values with gorgeous AI generated content
      if (data.polishedTitle) {
        setWritingTitle(data.polishedTitle);
      }
      if (data.polishedQuote) {
        setCustomQuote(data.polishedQuote);
      }
      if (data.polishedBody) {
        setWritingBody(data.polishedBody);
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Failed to connect to the server-side AI model.');
    } finally {
      setIsEnriching(false);
    }
  };

  // Create a new spread
  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!writingTitle.trim() || !writingBody.trim()) return;

    const newSpreadId = `spread-${Date.now()}`;
    const mediaUrl = useCustomMedia ? customMediaUrl : selectedMedia.url;
    const mediaType = useCustomMedia ? customMediaType : selectedMedia.type;

    // Filter valid custom image urls
    const activeUrls = useCustomMedia && customMediaType === 'image'
      ? [customMediaUrl, ...customImageUrls].map(u => u.trim()).filter(Boolean)
      : [];

    const newSpread: DiarySpread = {
      id: newSpreadId,
      leftPage: {
        id: `left-${Date.now()}`,
        category: `${String(spreads.length).padStart(2, '0')} / ${writingCategory.toUpperCase()}`,
        date: writingDate || curDate(),
        title: writingTitle,
        quote: customQuote || `“Finding beauty in the slow hours of my ${writingCategory.toLowerCase()} journey.”`,
        bodyText: writingBody
      },
      rightPage: {
        type: mediaType,
        url: mediaUrl || PRESET_MEDIA_LIST[0].url,
        ...(activeUrls.length > 1 ? { urls: activeUrls } : {}),
        caption: mediaCaption || `Capturing the perfect aesthetic moment during my ${writingCategory.toLowerCase()} journey.`
      }
    };

    const updated = [...spreads, newSpread];
    setSpreads(updated);

    resetWriterForm();
    setIsWriting(false);

    // Switch filter to 'All' so they can see it and jump to it
    setSelectedCategory('All');
    setIsOpen(true);
    
    // Jump to the newly added page
    setTimeout(() => {
      setCurrentIndex(updated.length - 1);
    }, 100);
  };

  // Delete spread
  const handleDeleteSpread = useCallback((spreadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this diary page spread forever?')) return;

    const updated = spreads.filter(s => s.id !== spreadId);
    setSpreads(updated);

    // Adjust current index
    if (currentIndex >= updated.length && currentIndex > 0) {
      setCurrentIndex(updated.length - 1);
    }
  }, [spreads, currentIndex]);

  // Restore original preset beach diary spreads
  const handleResetPresets = () => {
    if (confirm('确定要恢复默认预设日记吗？这将用精美的默认日记覆盖您当前的修改。')) {
      localStorage.removeItem('study_diary_spreads');
      localStorage.removeItem('abroad_diary_spreads');
      setSpreads(INITIAL_SPREADS);
      setCurrentIndex(0);
      setSelectedCategory('All');
    }
  };

  // Clear all diary content completely
  const handleClearAll = () => {
    if (confirm('确定要清空所有日记内容（包括文字、图片和视频）吗？此操作无法撤销。')) {
      setSpreads([]);
      setCurrentIndex(0);
      setSelectedCategory('All');
      localStorage.removeItem('study_diary_spreads');
      localStorage.removeItem('abroad_diary_spreads');
    }
  };

  const handleNextPage = () => {
    if (currentIndex < displaySpreads.length - 1 && !isFlipping) {
      setDirection('next');
      setIsFlipping('next');
    }
  };

  const handlePrevPage = () => {
    if (currentIndex > 0 && !isFlipping) {
      setDirection('prev');
      setIsFlipping('prev');
    }
  };

  const handleNextComplete = () => {
    setCurrentIndex(prev => prev + 1);
    setIsFlipping(null);
  };

  const handlePrevComplete = () => {
    setCurrentIndex(prev => prev - 1);
    setIsFlipping(null);
  };

  const handleOpenBook = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isFlipping) {
      setIsFlipping('opening');
      setIsOpen(true);
    }
  };

  // Current active spread
  const activeSpread = displaySpreads[currentIndex];

  return (
    <div id="diary-app-root" className="min-h-screen relative overflow-hidden bg-[#f5f4f0] text-neutral-800 font-sans flex flex-col justify-between selection:bg-brand-blue/10 selection:text-brand-blue">
      
      {/* Healing Blurred Background Blobs */}
      <div id="bg-blob-container" className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div id="blob-1" className="absolute top-[10%] left-[20%] w-[350px] h-[350px] rounded-full bg-blue-400/10 blur-[80px] animate-blob-1"></div>
        <div id="blob-2" className="absolute bottom-[15%] right-[15%] w-[450px] h-[450px] rounded-full bg-indigo-500/10 blur-[100px] animate-blob-2"></div>
        <div id="blob-3" className="absolute top-[50%] left-[45%] w-[300px] h-[300px] rounded-full bg-amber-400/5 blur-[90px] animate-blob-3"></div>
      </div>

      {/* Floating Elegant Top Header Bar */}
      <header id="app-header" className="w-full max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 z-30 border-b border-neutral-200/50 backdrop-blur-md">
        
        {/* Left Side: Brand Logo */}
        <div id="brand-logo" className="flex items-center gap-2.5 cursor-pointer" onClick={() => setIsOpen(false)}>
          <div id="logo-icon-wrapper" className="w-9 h-9 rounded-full bg-brand-blue flex items-center justify-center text-white shadow-md shadow-brand-blue/20">
            <BookOpen size={18} id="logo-icon" />
          </div>
          <div className="flex flex-col">
            <span id="logo-title" className="font-serif font-bold text-lg tracking-tight text-neutral-900 leading-none">Abroad Diary</span>
            <span id="logo-subtitle" className="font-mono text-[9px] tracking-widest text-neutral-400 uppercase mt-0.5">Virtual Book / 2026</span>
          </div>
        </div>

        {/* Middle: Live Filters & Category Quick Tabs */}
        <div id="search-filter-controls" className="flex flex-wrap items-center gap-2 justify-center max-w-xl">
          <div id="search-bar" className="relative">
            <input 
              id="search-input"
              type="text"
              placeholder="Search reflections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-44 focus:w-56 transition-all duration-300 px-3.5 py-1.5 pl-8 text-xs bg-white/70 hover:bg-white focus:bg-white rounded-full border border-neutral-300/60 focus:border-brand-blue focus:outline-none placeholder-neutral-400 font-sans shadow-sm"
            />
            <span id="search-icon" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[10px] font-mono">🔍</span>
          </div>

          <div id="category-selector-wrapper" className="flex items-center gap-1 bg-white/50 p-1 rounded-full border border-neutral-300/40 shadow-sm overflow-x-auto max-w-[320px] md:max-w-md no-scrollbar">
            {allCategories.map((category) => (
              <button
                key={category}
                id={`category-tab-${category.toLowerCase().replace(/\s/g, '-')}`}
                onClick={() => {
                  setSelectedCategory(category);
                  setCurrentIndex(0);
                }}
                className={`px-3 py-1 text-[11px] font-medium rounded-full transition-all duration-200 uppercase tracking-wider whitespace-nowrap ${
                  selectedCategory === category 
                    ? 'bg-brand-blue text-white shadow-sm' 
                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/50'
                }`}
              >
                {category === 'WELCOME' ? 'Welcome' : category}
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Tools & Music Controls */}
        <div id="header-utilities" className="flex items-center gap-3">
          
          {/* Sound Controls (Vinyl Disc Aesthetic) */}
          <div id="audio-dashboard" className="flex items-center gap-2 bg-white/80 border border-neutral-300/40 rounded-full px-3 py-1.5 shadow-sm">
            <button 
              id="music-play-btn"
              onClick={() => setIsPlayingMusic(!isPlayingMusic)}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                isPlayingMusic 
                  ? 'bg-brand-blue/10 text-brand-blue animate-spin [animation-duration:8s]' 
                  : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
              }`}
              title="Calm Background Music"
            >
              <Music size={13} />
            </button>
            <div id="music-track-info" className="flex flex-col max-w-[80px]">
              <span className="font-mono text-[9px] text-neutral-400 truncate uppercase leading-none">
                {AMBIENT_TRACKS[activeTrackIndex].name}
              </span>
              <button 
                id="music-skip-btn"
                onClick={() => {
                  setActiveTrackIndex((prev) => (prev + 1) % AMBIENT_TRACKS.length);
                  setIsPlayingMusic(true);
                }}
                className="text-[9px] text-left hover:text-brand-blue text-neutral-500 font-sans font-medium mt-0.5 leading-none transition-colors"
              >
                Next Track
              </button>
            </div>
            
            <input 
              id="music-volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={musicVolume}
              onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
              className="w-12 h-1 accent-brand-blue bg-neutral-200 rounded-lg cursor-pointer"
              title={`Volume: ${Math.round(musicVolume * 100)}%`}
            />
          </div>

          {/* Write Button */}
          <button
            id="write-diary-btn"
            onClick={() => setIsWriting(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-blue text-white rounded-full font-medium text-xs shadow-md shadow-brand-blue/20 hover:bg-brand-blue-hover hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <PenTool size={13} />
            <span>Write Diary</span>
          </button>
        </div>
      </header>

      {/* Main Container Stage (The Book Viewer) */}
      <main id="diary-viewport" className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 flex items-center justify-center z-10">
        <AnimatePresence mode="popLayout">
          {!isOpen ? (
            
            /* ==============================================
               CLOSED COVER STATE - Centers Cover Book Card
               ============================================== */
            <motion.div
              key="closed-cover-container"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ 
                opacity: 0, 
                scale: 0.95,
                transition: { duration: 0.3 } 
              }}
              className="w-full max-w-[380px] md:max-w-[420px] h-[500px] md:h-[640px] flex items-center justify-center perspective-[1500px]"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <motion.div
                id="diary-closed-book"
                onClick={handleOpenBook}
                whileHover={{ 
                  rotateY: -12, 
                  rotateX: 4, 
                  boxShadow: '25px 30px 50px rgba(0, 0, 0, 0.25), 0px 10px 20px rgba(0, 49, 196, 0.15)'
                }}
                className="w-full h-full duration-500 transition-shadow select-none"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <BookCover onClick={handleOpenBook} />
              </motion.div>
            </motion.div>
          ) : (
            
            /* ==============================================
               OPEN DOUBLE-PAGE SPREAD STATE
               ============================================== */
            <motion.div
              key="open-book-container"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ 
                opacity: 0, 
                scale: 0.98,
                transition: { duration: 0.7, ease: [0.25, 1, 0.5, 1] }
              }}
              transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
              className="w-full flex flex-col items-center animate-fade-in"
            >
              
              {/* Staggered layered pages behind the main book (Thick book feel) */}
              <div id="book-stage-wrapper" className="relative w-full max-w-5xl flex items-center justify-center">
                
                {/* Left staggered paper depth edges */}
                <div id="left-depth-sheet-1" className="absolute left-[-6px] top-[10px] bottom-[10px] w-full bg-[#f3f2eb] rounded-lg shadow-sm border border-black/5 -z-10 transform scale-x-[0.99]"></div>
                <div id="left-depth-sheet-2" className="absolute left-[-12px] top-[20px] bottom-[20px] w-full bg-[#ebe9e0] rounded-lg shadow-sm border border-black/5 -z-20 transform scale-x-[0.98]"></div>
                
                {/* Right staggered paper depth edges */}
                <div id="right-depth-sheet-1" className="absolute right-[-6px] top-[10px] bottom-[10px] w-full bg-[#f3f2eb] rounded-lg shadow-sm border border-black/5 -z-10 transform scale-x-[0.99]"></div>
                <div id="right-depth-sheet-2" className="absolute right-[-12px] top-[20px] bottom-[20px] w-full bg-[#ebe9e0] rounded-lg shadow-sm border border-black/5 -z-20 transform scale-x-[0.98]"></div>
 
                {/* Main Double-Page Book spread */}
                <div 
                  id="diary-open-book" 
                  className="w-full h-[520px] sm:h-[580px] md:h-[640px] flex flex-row rounded-[24px] book-shadow relative bg-cream-light paper-texture border border-black/5 select-none"
                  style={{ perspective: 2000, transformStyle: 'preserve-3d' }}
                >
                  
                  {/* Center Crease / Folding Bind Highlight shadow */}
                  <div id="book-binding-spine" className="absolute left-1/2 top-0 bottom-0 w-[30px] sm:w-[40px] -ml-[15px] sm:-ml-[20px] z-40 book-crease-highlight pointer-events-none"></div>

                  {(!isDiaryEmpty && filteredSpreads.length === 0) ? (
                    
                    /* Empty State when no spreads match filter */
                    <div 
                      id="empty-spreads-state"
                      className="w-full flex flex-col items-center justify-center p-12 text-center"
                    >
                      <Layers size={48} className="text-neutral-300 mb-4 animate-bounce" />
                      <h3 className="font-serif font-bold text-2xl text-neutral-800 mb-2">No Diary Entries Found</h3>
                      <p className="text-neutral-500 max-w-sm text-sm mb-6">
                        Try searching for different keywords, selecting another category, or writing your first diary!
                      </p>
                      <div className="flex gap-3">
                        <button
                          id="reset-filter-btn"
                          onClick={() => {
                            setSelectedCategory('All');
                            setSearchQuery('');
                          }}
                          className="px-4 py-2 bg-neutral-200 text-neutral-800 rounded-full font-medium text-xs hover:bg-neutral-300 transition-colors cursor-pointer"
                        >
                          Reset Filters
                        </button>
                        <button
                          id="add-first-entry-btn"
                          onClick={() => setIsWriting(true)}
                          className="px-4 py-2 bg-brand-blue text-white rounded-full font-medium text-xs hover:bg-brand-blue-hover transition-colors shadow-md shadow-brand-blue/10 cursor-pointer"
                        >
                          Write Your First Entry
                        </button>
                      </div>
                    </div>
                  ) : (
                    
                    <React.Fragment>
                      {/* =======================================================
                         STATIC DOUBLE-PAGE SPREAD
                         ======================================================= */}
                      {isFlipping === null && (
                        <div className="w-full h-full flex flex-row relative z-10" style={{ transformStyle: 'preserve-3d' }}>
                          <div className="w-1/2 h-full rounded-l-[24px] overflow-hidden">
                            <LeftPage
                              spread={activeSpread}
                              canDelete={spreads.length > 0 && activeSpread.id !== 'blank-spread'}
                              handleDeleteSpread={handleDeleteSpread}
                              onWrite={handleOpenWriter}
                            />
                          </div>
                          <div className="w-1/2 h-full rounded-r-[24px] overflow-hidden">
                            <RightPage
                              spread={activeSpread}
                              currentIndex={currentIndex}
                              totalSpreads={displaySpreads.length}
                              isMutedVideos={isMutedVideos}
                              setIsMutedVideos={setIsMutedVideos}
                              videoRefs={videoRefs}
                            />
                          </div>
                        </div>
                      )}

                      {/* =======================================================
                         FLIPPING FORWARD (NEXT PAGE TURN)
                         ======================================================= */}
                      {isFlipping === 'next' && (
                        <div className="w-full h-full flex flex-row relative z-10" style={{ transformStyle: 'preserve-3d' }}>
                          
                          {/* Static left page beneath (the old left page) */}
                          <div className="w-1/2 h-full rounded-l-[24px] overflow-hidden relative">
                            <LeftPage
                              spread={activeSpread}
                              canDelete={spreads.length > 0 && activeSpread.id !== 'blank-spread'}
                              handleDeleteSpread={handleDeleteSpread}
                              onWrite={handleOpenWriter}
                            />
                            {/* Dynamic shadow casting over left page as sheet flips over */}
                            <motion.div 
                              className="absolute inset-0 bg-black/15 mix-blend-multiply pointer-events-none z-15"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 0.6 }}
                              transition={{ duration: 0.9, ease: [0.25, 1, 0.5, 1] }}
                            />
                          </div>

                          {/* Static right page beneath (the new right page starting to reveal) */}
                          <div className="w-1/2 h-full rounded-r-[24px] overflow-hidden relative">
                            <RightPage
                              spread={displaySpreads[currentIndex + 1]}
                              currentIndex={currentIndex + 1}
                              totalSpreads={displaySpreads.length}
                              isMutedVideos={isMutedVideos}
                              setIsMutedVideos={setIsMutedVideos}
                              videoRefs={videoRefs}
                            />
                            {/* Initial shadow starting dark, fading out as sheet lands */}
                            <motion.div 
                              className="absolute inset-0 bg-black/25 mix-blend-multiply pointer-events-none z-15"
                              initial={{ opacity: 0.7 }}
                              animate={{ opacity: 0 }}
                              transition={{ duration: 0.9, ease: [0.25, 1, 0.5, 1] }}
                            />
                          </div>

                          {/* Dual-Sided 3D Flipping Sheet */}
                          <motion.div
                            key="flipping-sheet-next"
                            initial={{ rotateY: 0 }}
                            animate={{ rotateY: -180 }}
                            transition={{ duration: 0.9, ease: [0.25, 1, 0.5, 1] }}
                            onAnimationComplete={handleNextComplete}
                            className="w-1/2 h-full absolute left-1/2 top-0 z-30 pointer-events-none"
                            style={{ transformStyle: 'preserve-3d', transformOrigin: 'left center' }}
                          >
                            {/* Front side of flipping sheet: right page of old spread N */}
                            <div 
                              className="absolute inset-0 w-full h-full rounded-r-[24px] overflow-hidden border-l border-black/5"
                              style={{ backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}
                            >
                              <RightPage
                                spread={activeSpread}
                                currentIndex={currentIndex}
                                totalSpreads={displaySpreads.length}
                                isMutedVideos={isMutedVideos}
                                setIsMutedVideos={setIsMutedVideos}
                                videoRefs={videoRefs}
                              />
                              <motion.div 
                                className="absolute inset-0 bg-gradient-to-r from-black/25 via-black/5 to-transparent mix-blend-multiply z-20"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0, 0.45, 0.2] }}
                                transition={{ duration: 0.9 }}
                              />
                            </div>

                            {/* Back side of flipping sheet: left page of new spread N+1 */}
                            <div 
                              className="absolute inset-0 w-full h-full rounded-l-[24px] overflow-hidden border-r border-black/5"
                              style={{ 
                                backfaceVisibility: 'hidden', 
                                transform: 'rotateY(180deg)',
                                transformStyle: 'preserve-3d'
                              }}
                            >
                              <LeftPage
                                spread={displaySpreads[currentIndex + 1]}
                                canDelete={spreads.length > 0 && displaySpreads[currentIndex + 1].id !== 'blank-spread'}
                                handleDeleteSpread={handleDeleteSpread}
                                onWrite={handleOpenWriter}
                              />
                              <motion.div 
                                className="absolute inset-0 bg-gradient-to-l from-black/25 via-black/5 to-transparent mix-blend-multiply z-20"
                                initial={{ opacity: 0.3 }}
                                animate={{ opacity: [0.3, 0.45, 0] }}
                                transition={{ duration: 0.9 }}
                              />
                            </div>
                          </motion.div>
                        </div>
                      )}

                      {/* =======================================================
                         FLIPPING BACKWARD (PREV PAGE TURN)
                         ======================================================= */}
                      {isFlipping === 'prev' && (
                        <div className="w-full h-full flex flex-row relative z-10" style={{ transformStyle: 'preserve-3d' }}>
                          
                          {/* Static left page beneath (the new left page starting to reveal) */}
                          <div className="w-1/2 h-full rounded-l-[24px] overflow-hidden relative">
                            <LeftPage
                              spread={displaySpreads[currentIndex - 1]}
                              canDelete={spreads.length > 0 && displaySpreads[currentIndex - 1].id !== 'blank-spread'}
                              handleDeleteSpread={handleDeleteSpread}
                              onWrite={handleOpenWriter}
                            />
                            {/* Shadow fades out as turning page swings to the right */}
                            <motion.div 
                              className="absolute inset-0 bg-black/25 mix-blend-multiply pointer-events-none z-15"
                              initial={{ opacity: 0.7 }}
                              animate={{ opacity: 0 }}
                              transition={{ duration: 0.9, ease: [0.25, 1, 0.5, 1] }}
                            />
                          </div>

                          {/* Static right page beneath (the old right page) */}
                          <div className="w-1/2 h-full rounded-r-[24px] overflow-hidden relative">
                            <RightPage
                              spread={activeSpread}
                              currentIndex={currentIndex}
                              totalSpreads={displaySpreads.length}
                              isMutedVideos={isMutedVideos}
                              setIsMutedVideos={setIsMutedVideos}
                              videoRefs={videoRefs}
                            />
                            {/* Shadow darkens right side as page lands */}
                            <motion.div 
                              className="absolute inset-0 bg-black/15 mix-blend-multiply pointer-events-none z-15"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 0.6 }}
                              transition={{ duration: 0.9, ease: [0.25, 1, 0.5, 1] }}
                            />
                          </div>

                          {/* Dual-Sided 3D Flipping Sheet */}
                          <motion.div
                            key="flipping-sheet-prev"
                            initial={{ rotateY: 0 }}
                            animate={{ rotateY: 180 }}
                            transition={{ duration: 0.9, ease: [0.25, 1, 0.5, 1] }}
                            onAnimationComplete={handlePrevComplete}
                            className="w-1/2 h-full absolute left-0 top-0 z-30 pointer-events-none"
                            style={{ transformStyle: 'preserve-3d', transformOrigin: 'right center' }}
                          >
                            {/* Front side of flipping sheet: left page of old spread N */}
                            <div 
                              className="absolute inset-0 w-full h-full rounded-l-[24px] overflow-hidden border-r border-black/5"
                              style={{ backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}
                            >
                              <LeftPage
                                spread={activeSpread}
                                canDelete={spreads.length > 0 && activeSpread.id !== 'blank-spread'}
                                handleDeleteSpread={handleDeleteSpread}
                                onWrite={handleOpenWriter}
                              />
                              <motion.div 
                                className="absolute inset-0 bg-gradient-to-l from-black/25 via-black/5 to-transparent mix-blend-multiply z-20"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0, 0.45, 0.2] }}
                                transition={{ duration: 0.9 }}
                              />
                            </div>

                            {/* Back side of flipping sheet: right page of new spread N-1 */}
                            <div 
                              className="absolute inset-0 w-full h-full rounded-r-[24px] overflow-hidden border-l border-black/5"
                              style={{ 
                                backfaceVisibility: 'hidden', 
                                transform: 'rotateY(-180deg)',
                                transformStyle: 'preserve-3d'
                              }}
                            >
                              <RightPage
                                spread={displaySpreads[currentIndex - 1]}
                                currentIndex={currentIndex - 1}
                                totalSpreads={displaySpreads.length}
                                isMutedVideos={isMutedVideos}
                                setIsMutedVideos={setIsMutedVideos}
                                videoRefs={videoRefs}
                              />
                              <motion.div 
                                className="absolute inset-0 bg-gradient-to-r from-black/25 via-black/5 to-transparent mix-blend-multiply z-20"
                                initial={{ opacity: 0.3 }}
                                animate={{ opacity: [0.3, 0.45, 0] }}
                                transition={{ duration: 0.9 }}
                              />
                            </div>
                          </motion.div>
                        </div>
                      )}

                      {/* =======================================================
                         OPENING THE COVER (3D COVER FLIP TRANSITION)
                         ======================================================= */}
                      {isFlipping === 'opening' && (
                        <div className="w-full h-full flex flex-row relative z-10" style={{ transformStyle: 'preserve-3d' }}>
                          
                          {/* Static Left page beneath: Blank hardcover lining page */}
                          <div className="w-1/2 h-full rounded-l-[24px] overflow-hidden bg-[#ebe9e0] paper-texture flex flex-col justify-between p-12 border-r border-black/[0.04] relative">
                            <div className="w-full h-full flex items-center justify-center opacity-10">
                              <BookOpen size={64} className="text-[#0031c4]" />
                            </div>
                          </div>

                          {/* Static Right page beneath: Page 0 right page (video loop revealed) */}
                          <div className="w-1/2 h-full rounded-r-[24px] overflow-hidden relative">
                            <RightPage
                              spread={displaySpreads[0]}
                              currentIndex={0}
                              totalSpreads={displaySpreads.length}
                              isMutedVideos={isMutedVideos}
                              setIsMutedVideos={setIsMutedVideos}
                              videoRefs={videoRefs}
                            />
                            {/* Ambient shadow fading out as cover swings away */}
                            <motion.div 
                              className="absolute inset-0 bg-black/35 mix-blend-multiply pointer-events-none z-15"
                              initial={{ opacity: 0.85 }}
                              animate={{ opacity: 0 }}
                              transition={{ duration: 1.0, ease: [0.25, 1, 0.5, 1] }}
                            />
                          </div>

                          {/* Flipping Cover Page Sheet */}
                          <motion.div
                            key="flipping-cover"
                            initial={{ rotateY: 0 }}
                            animate={{ rotateY: -180 }}
                            transition={{ duration: 1.0, ease: [0.25, 1, 0.5, 1] }}
                            onAnimationComplete={() => setIsFlipping(null)}
                            className="w-1/2 h-full absolute left-1/2 top-0 z-30 pointer-events-none"
                            style={{ transformStyle: 'preserve-3d', transformOrigin: 'left center' }}
                          >
                            {/* Front side of flipping sheet: Cover design */}
                            <div 
                              className="absolute inset-0 w-full h-full rounded-r-[24px] overflow-hidden"
                              style={{ backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}
                            >
                              <BookCover isInsideFlip={true} />
                              <motion.div 
                                className="absolute inset-0 bg-gradient-to-r from-black/25 via-black/5 to-transparent mix-blend-multiply z-20"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0, 0.5, 0.3] }}
                                transition={{ duration: 1.0 }}
                              />
                            </div>

                            {/* Back side of flipping sheet: Left page text content of Spread 0 */}
                            <div 
                              className="absolute inset-0 w-full h-full rounded-l-[24px] overflow-hidden border-r border-black/5"
                              style={{ 
                                backfaceVisibility: 'hidden', 
                                transform: 'rotateY(180deg)',
                                transformStyle: 'preserve-3d'
                              }}
                            >
                              <LeftPage
                                spread={displaySpreads[0]}
                                canDelete={spreads.length > 0 && displaySpreads[0].id !== 'blank-spread'}
                                handleDeleteSpread={handleDeleteSpread}
                                onWrite={handleOpenWriter}
                              />
                              <motion.div 
                                className="absolute inset-0 bg-gradient-to-l from-black/25 via-black/5 to-transparent mix-blend-multiply z-20"
                                initial={{ opacity: 0.4 }}
                                animate={{ opacity: [0.4, 0.5, 0] }}
                                transition={{ duration: 1.0 }}
                              />
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </React.Fragment>
                  )}

                </div>

                {/* Left/Right Tactical Book Turning Overlays */}
                {displaySpreads.length > 0 && (
                  <React.Fragment>
                    
                    {/* PREV BUTTON OVERLAY (Left edge of screen) */}
                    <button
                      id="book-nav-prev-btn"
                      onClick={handlePrevPage}
                      disabled={currentIndex === 0}
                      className={`absolute left-1 sm:left-[-24px] md:left-[-32px] top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center bg-white/95 backdrop-blur-md shadow-xl border border-neutral-200/50 transition-all duration-300 z-30 ${
                        currentIndex === 0 
                          ? 'opacity-0 scale-75 pointer-events-none' 
                          : 'opacity-100 hover:scale-110 sm:hover:-translate-x-1 hover:bg-neutral-50 active:scale-95'
                      }`}
                    >
                      <ChevronLeft size={18} className="text-neutral-700" />
                    </button>

                    {/* NEXT BUTTON OVERLAY (Right edge of screen) */}
                    <button
                      id="book-nav-next-btn"
                      onClick={handleNextPage}
                      disabled={currentIndex === displaySpreads.length - 1}
                      className={`absolute right-1 sm:right-[-24px] md:right-[-32px] top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center bg-white/95 backdrop-blur-md shadow-xl border border-neutral-200/50 transition-all duration-300 z-30 ${
                        currentIndex === displaySpreads.length - 1 
                          ? 'opacity-0 scale-75 pointer-events-none' 
                          : 'opacity-100 hover:scale-110 sm:hover:translate-x-1 hover:bg-neutral-50 active:scale-95'
                      }`}
                    >
                      <ChevronRight size={18} className="text-neutral-700" />
                    </button>

                  </React.Fragment>
                )}

              </div>

              {/* Bottom Dot Navigator & Spread Info Indicator */}
              {displaySpreads.length > 1 && (
                <div id="book-pagination-controls" className="flex flex-col items-center mt-8 gap-3 z-20">
                  <div className="flex items-center gap-1.5">
                    {displaySpreads.map((_, idx) => (
                      <button
                        key={idx}
                        id={`pagination-dot-${idx}`}
                        onClick={() => { if (!isFlipping) setCurrentIndex(idx); }}
                        className={`transition-all duration-300 rounded-full cursor-pointer ${
                          idx === currentIndex 
                            ? 'w-6 h-2 bg-brand-blue' 
                            : 'w-2 h-2 bg-neutral-300/80 hover:bg-neutral-400'
                        }`}
                        title={`Go to spread ${idx + 1}`}
                      />
                    ))}
                  </div>
                  <span id="book-pagination-label" className="font-mono text-[10px] tracking-widest text-neutral-400 uppercase mt-0.5">
                    Reflections {currentIndex + 1} / {displaySpreads.length}
                  </span>
                </div>
              )}

              {/* Helper Options Bottom row */}
              <div id="book-util-row" className="flex flex-wrap gap-4 mt-6 z-20">
                <button
                  id="close-diary-view-btn"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-1.5 bg-white/70 hover:bg-white text-neutral-600 hover:text-neutral-950 border border-neutral-300/40 rounded-full font-medium text-xs shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Book size={12} />
                  <span>Close Diary Cover</span>
                </button>
                <button
                  id="reset-presets-btn"
                  onClick={handleResetPresets}
                  className="px-4 py-1.5 bg-brand-blue/5 hover:bg-brand-blue/10 hover:text-brand-blue text-neutral-600 border border-neutral-200/60 hover:border-brand-blue/20 rounded-full font-medium text-xs transition-all flex items-center gap-1 cursor-pointer"
                  title="Restore default beach diary spreads"
                >
                  <RotateCcw size={12} />
                  <span>Restore Demo Diary</span>
                </button>
                <button
                  id="clear-all-diaries-btn"
                  onClick={handleClearAll}
                  className="px-4 py-1.5 bg-red-50/50 hover:bg-red-50 hover:text-red-600 text-neutral-500 border border-neutral-200/60 hover:border-red-200 rounded-full font-medium text-xs transition-all flex items-center gap-1 cursor-pointer"
                  title="Clear all diary entries"
                >
                  <Trash2 size={12} />
                  <span>Clear All Diaries</span>
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Elegant Bottom Footer */}
      <footer id="app-footer" className="w-full max-w-7xl mx-auto px-6 py-4 text-center z-20 text-[11px] font-mono text-neutral-400/80 tracking-wider">
        <p>© 2026 Abroad Diary • Crafted with Serenity & Healing Vibes • Gemini Powered</p>
      </footer>

      {/* =======================================================
         THE DIARY WRITER CREATION OVERLAY DRAWERS (MODAL)
         ======================================================= */}
      <AnimatePresence>
        {isWriting && (
          <motion.div
            id="write-diary-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutral-950/40 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              id="write-diary-modal"
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 30 }}
              className="bg-white rounded-[24px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col justify-between"
            >
              
              {/* Modal Header */}
              <div id="modal-header-sec" className="px-8 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                    <PenTool size={15} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-lg text-neutral-900 leading-tight">Write Abroad Reflection</h3>
                    <p className="text-[11px] text-neutral-400 font-mono tracking-wide mt-0.5 uppercase">Draft new page spread</p>
                  </div>
                </div>
                <button
                  id="close-writer-btn"
                  onClick={() => { resetWriterForm(); setIsWriting(false); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Form Scrollable Area */}
              <form id="write-diary-form" onSubmit={handleSaveEntry} className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
                
                {/* Left Panel: Content Fields (7 cols) */}
                <div id="modal-form-left-col" className="md:col-span-7 space-y-5">
                  
                  {/* Category & Date inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-mono text-[10px] tracking-wider uppercase text-neutral-400">Category</label>
                      <select
                        id="form-input-category"
                        value={writingCategory}
                        onChange={(e) => setWritingCategory(e.target.value)}
                        className="px-3 py-2 text-xs bg-neutral-50 border border-neutral-300/60 rounded-xl focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none"
                      >
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-mono text-[10px] tracking-wider uppercase text-neutral-400">Date</label>
                      <input
                        id="form-input-date"
                        type="text"
                        value={writingDate}
                        onChange={(e) => setWritingDate(e.target.value)}
                        className="px-3 py-2 text-xs bg-neutral-50 border border-neutral-300/60 rounded-xl focus:border-brand-blue focus:outline-none font-mono"
                        placeholder="YYYY.MM.DD"
                        required
                      />
                    </div>
                  </div>

                  {/* Title and AI help button */}
                  <div className="flex flex-col gap-1.5 relative">
                    <div className="flex items-center justify-between">
                      <label className="font-mono text-[10px] tracking-wider uppercase text-neutral-400">Reflection Title</label>
                      
                      {/* AI Enrichment helper trigger */}
                      <button
                        id="ai-enrich-trigger-btn"
                        type="button"
                        onClick={handleAiEnrich}
                        disabled={isEnriching}
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue font-medium text-[10px] transition-all cursor-pointer"
                        title="AI will turn your draft title and text into a majestic poetic masterpiece!"
                      >
                        {isEnriching ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Sparkles size={10} className="animate-pulse text-brand-blue" />
                        )}
                        <span>AI Polish & Motto</span>
                      </button>
                    </div>

                    <input
                      id="form-input-title"
                      type="text"
                      value={writingTitle}
                      onChange={(e) => setWritingTitle(e.target.value)}
                      className="px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-300/60 focus:border-brand-blue focus:bg-white focus:outline-none rounded-xl"
                      placeholder="e.g. Rainy cafe notes"
                      required
                    />
                  </div>

                  {/* Comforting Quote / Motto (Self defined or AI enriched) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[10px] tracking-wider uppercase text-neutral-400">Evocative Quote / Motto (Optional)</label>
                    <input
                      id="form-input-quote"
                      type="text"
                      value={customQuote}
                      onChange={(e) => setCustomQuote(e.target.value)}
                      className="px-3.5 py-2 text-xs bg-neutral-50 italic border border-neutral-300/60 focus:border-brand-blue focus:bg-white focus:outline-none rounded-xl font-serif text-neutral-600"
                      placeholder='e.g. "Silence is the catalyst of inspiration."'
                    />
                  </div>

                  {/* Body Text */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[10px] tracking-wider uppercase text-neutral-400">Diary Content (Thoughts, reflections, learnings)</label>
                    <textarea
                      id="form-input-body"
                      value={writingBody}
                      onChange={(e) => setWritingBody(e.target.value)}
                      rows={6}
                      className="px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-300/60 focus:border-brand-blue focus:bg-white focus:outline-none rounded-xl font-sans leading-relaxed resize-none"
                      placeholder="Write your diary logs or daily mood drafts here. Tip: Click 'AI Polish' above to translate it into comforting high-end literature!"
                      required
                    />
                  </div>

                  {/* AI Status or feedback block */}
                  {isEnriching && (
                    <div id="ai-status-loader-card" className="p-3 bg-brand-blue/5 border border-brand-blue/20 rounded-xl flex items-center gap-2.5">
                      <Loader2 size={13} className="text-brand-blue animate-spin" />
                      <span className="text-[11px] font-medium text-brand-blue font-mono animate-pulse">
                        Whispering to Gemini-3.5-Flash... Translating text into healing literature...
                      </span>
                    </div>
                  )}

                  {aiError && (
                    <div id="ai-error-status" className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-[11px] font-medium">
                      {aiError}
                    </div>
                  )}

                </div>

                {/* Right Panel: Media Selection & Cover Picker (5 cols) */}
                <div id="modal-form-right-col" className="md:col-span-5 space-y-5 border-t md:border-t-0 md:border-l border-neutral-100 pt-5 md:pt-0 md:pl-6 flex flex-col justify-between">
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="font-mono text-[10px] tracking-wider uppercase text-neutral-400">Choose Living Media</label>
                      
                      {/* Presets vs Custom link togglers */}
                      <div className="flex gap-1.5 bg-neutral-100 p-0.5 rounded-full">
                        <button
                          type="button"
                          id="media-source-preset-tab"
                          onClick={() => setUseCustomMedia(false)}
                          className={`px-2.5 py-0.5 text-[9px] font-bold rounded-full transition-all ${
                            !useCustomMedia ? 'bg-white shadow-xs text-neutral-800' : 'text-neutral-400 hover:text-neutral-700'
                          }`}
                        >
                          PRESETS
                        </button>
                        <button
                          type="button"
                          id="media-source-custom-tab"
                          onClick={() => setUseCustomMedia(true)}
                          className={`px-2.5 py-0.5 text-[9px] font-bold rounded-full transition-all ${
                            useCustomMedia ? 'bg-white shadow-xs text-neutral-800' : 'text-neutral-400 hover:text-neutral-700'
                          }`}
                        >
                          CUSTOM URL
                        </button>
                      </div>
                    </div>

                    {!useCustomMedia ? (
                      
                      /* Presets Grid Selection */
                      <div id="media-preset-grid" className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                        {PRESET_MEDIA_LIST.map((media) => (
                          <div
                            key={media.id}
                            id={`media-preset-card-${media.id}`}
                            onClick={() => setSelectedMedia(media)}
                            className={`group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                              selectedMedia.id === media.id && !useCustomMedia
                                ? 'border-brand-blue shadow-md scale-95'
                                : 'border-neutral-200/50 hover:border-neutral-400 hover:scale-98'
                            }`}
                          >
                            <img
                              src={media.thumbnail}
                              alt={media.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-2 opacity-80 group-hover:opacity-100 duration-200">
                              <span className="font-sans font-bold text-[9px] text-white truncate">{media.name}</span>
                              <span className="font-mono text-[7px] text-neutral-300 uppercase mt-0.5">
                                {media.type === 'video' ? '📹 Moving Loop' : '🖼️ Image'}
                              </span>
                            </div>
                            
                            {selectedMedia.id === media.id && !useCustomMedia && (
                              <div className="absolute top-1.5 right-1.5 bg-brand-blue text-white rounded-full p-0.5 shadow">
                                <Check size={8} strokeWidth={4} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      
                      /* Custom Media Link Input Form */
                      <div id="custom-media-inputs" className="space-y-3.5 bg-neutral-50 p-4 rounded-2xl border border-neutral-200/50">
                        <div className="flex flex-col gap-1.5">
                          <label className="font-mono text-[9px] uppercase text-neutral-400 font-semibold">Media Type</label>
                          <div className="flex gap-2">
                            <button
                              id="custom-media-type-video"
                              type="button"
                              onClick={() => setCustomMediaType('video')}
                              className={`flex-1 py-1 text-xs rounded-lg font-medium border transition-all ${
                                customMediaType === 'video' 
                                  ? 'bg-neutral-800 text-white border-neutral-800 shadow' 
                                  : 'bg-white text-neutral-600 border-neutral-300/60 hover:bg-neutral-100'
                              }`}
                            >
                              📹 Video MP4
                            </button>
                            <button
                              id="custom-media-type-image"
                              type="button"
                              onClick={() => setCustomMediaType('image')}
                              className={`flex-1 py-1 text-xs rounded-lg font-medium border transition-all ${
                                customMediaType === 'image' 
                                  ? 'bg-neutral-800 text-white border-neutral-800 shadow' 
                                  : 'bg-white text-neutral-600 border-neutral-300/60 hover:bg-neutral-100'
                              }`}
                            >
                              🖼️ Image Photo
                            </button>
                          </div>
                        </div>

                        {customMediaType === 'video' ? (
                          <div className="flex flex-col gap-1.5">
                            <label className="font-mono text-[9px] uppercase text-neutral-400 font-semibold">Direct Link Address</label>
                            <input
                              id="custom-media-url-input"
                              type="url"
                              placeholder="e.g. https://.../nature.mp4"
                              value={customMediaUrl}
                              onChange={(e) => setCustomMediaUrl(e.target.value)}
                              className="px-3 py-2 text-xs bg-white border border-neutral-300/60 focus:border-brand-blue focus:outline-none rounded-xl font-mono"
                            />
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Drag and Drop File Uploader */}
                            <div className="flex flex-col gap-1.5">
                              <label className="font-mono text-[9px] uppercase text-neutral-400 font-semibold block">本地照片上传 (Local Photo Upload)</label>
                              <div 
                                className="border-2 border-dashed border-neutral-300 rounded-xl p-4 bg-white/50 text-center hover:bg-white hover:border-brand-blue cursor-pointer transition-all relative group"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={async (e) => {
                                  e.preventDefault();
                                  const files = Array.from(e.dataTransfer.files).filter((f: any) => f.type && f.type.startsWith('image/'));
                                  if (files.length === 0) return;
                                  
                                  setIsUploadingFiles(true);
                                  try {
                                    const base64s = await Promise.all(files.slice(0, 4).map((file: any) => compressImage(file)));
                                    if (base64s[0]) setCustomMediaUrl(base64s[0]);
                                    const remaining = ['', '', ''];
                                    base64s.slice(1, 4).forEach((b, i) => {
                                      remaining[i] = b;
                                    });
                                    setCustomImageUrls(remaining);
                                  } catch (err) {
                                    alert('Failed to process image uploads.');
                                  } finally {
                                    setIsUploadingFiles(false);
                                  }
                                }}
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.multiple = true;
                                  input.accept = 'image/*';
                                  input.onchange = async () => {
                                    if (!input.files) return;
                                    const files = Array.from(input.files).filter((f: any) => f.type && f.type.startsWith('image/'));
                                    if (files.length === 0) return;
                                    
                                    setIsUploadingFiles(true);
                                    try {
                                      const base64s = await Promise.all(files.slice(0, 4).map((file: any) => compressImage(file)));
                                      if (base64s[0]) setCustomMediaUrl(base64s[0]);
                                      const remaining = ['', '', ''];
                                      base64s.slice(1, 4).forEach((b, i) => {
                                        remaining[i] = b;
                                      });
                                      setCustomImageUrls(remaining);
                                    } catch (err) {
                                      alert('Failed to process image uploads.');
                                    } finally {
                                      setIsUploadingFiles(false);
                                    }
                                  };
                                  input.click();
                                }}
                              >
                                {isUploadingFiles ? (
                                  <div className="flex flex-col items-center justify-center gap-1">
                                    <Loader2 size={20} className="text-brand-blue animate-spin" />
                                    <span className="font-mono text-[10px] text-brand-blue">正在压缩并处理图片...</span>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <p className="font-sans text-xs font-semibold text-neutral-600 group-hover:text-brand-blue">
                                      📁 选择或拖拽本地图片上传 (Select/Drag Photos)
                                    </p>
                                    <p className="font-mono text-[9px] text-neutral-400">
                                      支持多选 (最多4张)，自动压缩存储，完美契合日记
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-neutral-300">
                              <hr className="flex-1 border-neutral-200" />
                              <span className="font-mono text-[8px] mx-3 uppercase tracking-wider font-semibold">或者直接填写链接 (Or Paste Links)</span>
                              <hr className="flex-1 border-neutral-200" />
                            </div>

                            <label className="font-mono text-[9px] uppercase text-neutral-400 font-semibold block">照片链接地址 (Photo Link Addresses)</label>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                id="custom-image-url-1"
                                type="text"
                                placeholder="Image 1 (Required)"
                                value={customMediaUrl}
                                onChange={(e) => setCustomMediaUrl(e.target.value)}
                                className="px-2.5 py-1.5 text-xs bg-white border border-neutral-300/60 focus:border-brand-blue focus:outline-none rounded-xl font-mono truncate"
                                required
                              />
                              <input
                                id="custom-image-url-2"
                                type="url"
                                placeholder="Image 2 (Optional)"
                                value={customImageUrls[0] || ''}
                                onChange={(e) => {
                                  const updated = [...customImageUrls];
                                  updated[0] = e.target.value;
                                  setCustomImageUrls(updated);
                                }}
                                className="px-2.5 py-1.5 text-xs bg-white border border-neutral-300/60 focus:border-brand-blue focus:outline-none rounded-xl font-mono truncate"
                              />
                              <input
                                id="custom-image-url-3"
                                type="url"
                                placeholder="Image 3 (Optional)"
                                value={customImageUrls[1] || ''}
                                onChange={(e) => {
                                  const updated = [...customImageUrls];
                                  updated[1] = e.target.value;
                                  setCustomImageUrls(updated);
                                }}
                                className="px-2.5 py-1.5 text-xs bg-white border border-neutral-300/60 focus:border-brand-blue focus:outline-none rounded-xl font-mono truncate"
                              />
                              <input
                                id="custom-image-url-4"
                                type="url"
                                placeholder="Image 4 (Optional)"
                                value={customImageUrls[2] || ''}
                                onChange={(e) => {
                                  const updated = [...customImageUrls];
                                  updated[2] = e.target.value;
                                  setCustomImageUrls(updated);
                                }}
                                className="px-2.5 py-1.5 text-xs bg-white border border-neutral-300/60 focus:border-brand-blue focus:outline-none rounded-xl font-mono truncate"
                              />
                            </div>
                          </div>
                        )}
                        <p className="text-[9px] font-mono leading-relaxed text-neutral-400 italic">
                          {customMediaType === 'video' 
                            ? "Tip: For videos, paste direct looping .mp4 links from Pexels, Mixkit, or other repositories."
                            : "Tip: For images, paste direct links. Filling out more than one will automatically render a grid!"}
                        </p>
                      </div>
                    )}

                    {/* Media caption field */}
                    <div className="flex flex-col gap-1.5">
                      <label className="font-mono text-[10px] tracking-wider uppercase text-neutral-400">Photo/Video Caption</label>
                      <input
                        id="form-input-caption"
                        type="text"
                        value={mediaCaption}
                        onChange={(e) => setMediaCaption(e.target.value)}
                        className="px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-300/60 focus:border-brand-blue focus:bg-white focus:outline-none rounded-xl"
                        placeholder="e.g. Capturing the river waves as shadows begin to grow long."
                      />
                    </div>
                  </div>

                  {/* Active Preview block */}
                  <div id="modal-form-preview-sec" className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/50 text-center">
                    <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest block mb-2 font-semibold">Active Selection Preview</span>
                    <div className="aspect-[16/10] w-full max-w-[200px] mx-auto rounded-xl overflow-hidden shadow-sm border border-black/10 bg-neutral-900 flex items-center justify-center">
                      {!useCustomMedia ? (
                        <img src={selectedMedia.thumbnail} className="w-full h-full object-cover" />
                      ) : customMediaUrl ? (
                        customMediaType === 'video' ? (
                          <div className="text-[10px] font-mono text-neutral-400">📹 Custom Video Connected</div>
                        ) : (
                          <img src={customMediaUrl} className="w-full h-full object-cover" />
                        )
                      ) : (
                        <div className="text-[9px] font-mono text-neutral-400">No Custom Link Provided</div>
                      )}
                    </div>
                  </div>

                </div>

              </form>

              {/* Modal Footer Controls */}
              <div id="modal-footer-sec" className="px-8 py-5 border-t border-neutral-100 flex items-center justify-end gap-3 bg-neutral-50">
                <button
                  id="writer-cancel-btn"
                  type="button"
                  onClick={() => { resetWriterForm(); setIsWriting(false); }}
                  className="px-4 py-2 bg-neutral-200 text-neutral-700 hover:bg-neutral-300 rounded-full font-medium text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="writer-submit-btn"
                  type="submit"
                  form="write-diary-form"
                  className="px-5 py-2 bg-brand-blue text-white rounded-full font-medium text-xs shadow-md shadow-brand-blue/25 hover:bg-brand-blue-hover hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                >
                  <PenTool size={13} />
                  <span>Insert to Abroad Diary</span>
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
