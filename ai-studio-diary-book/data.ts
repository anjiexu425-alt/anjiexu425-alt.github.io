import { DiarySpread, PresetMedia } from './types';

export const curDate = () => {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

export const INITIAL_SPREADS: DiarySpread[] = [
  {
    id: 'spread-1',
    leftPage: {
      id: 'left-1',
      category: '01 / CHILL BEACH',
      date: '2026.07.20',
      title: 'A Sunset Dream at Chill Beach',
      quote: '“Smell the sea, and feel the sky. Let your soul and spirit fly.”',
      bodyText: 'Today was spent on the tranquil coast of Chill Beach. There is something profoundly healing about the rhythmic hum of the sea, the soft sand between my toes, and the fresh breeze that clears all thoughts.\n\nWalking along the shore, I watched seagulls glide over the turquoise waters and felt completely at peace. These four snapshots are a humble tribute to the beautiful, slow moments from today\'s seaside escape.'
    },
    rightPage: {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=600&q=80',
      urls: [
        'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1519419691348-3b3433c4c20e?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=600&q=80'
      ],
      caption: 'Four beautiful snapshots from my relaxing day at Chill Beach.'
    }
  }
];

export const BLANK_SPREAD: DiarySpread = {
  id: 'blank-spread',
  leftPage: {
    id: 'left-blank',
    category: 'NEW DIARY',
    date: curDate(),
    title: 'Your Quiet Sanctuary.',
    quote: '“Every blank page is an open invitation to reflect, travel, and grow.”',
    bodyText: 'This diary is a peaceful space for your thoughts, reflections, and journeys abroad.\n\nCurrently, there are no entries. Click the "Write Diary" button in the upper right to begin your first abroad record.'
  },
  rightPage: {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=1200&q=80',
    caption: 'A fresh, clean desk waiting for your words.'
  }
};

export const PRESET_MEDIA_LIST: PresetMedia[] = [
  {
    id: 'preset-video-reading',
    name: 'Quiet Reading Window',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-woman-reading-a-book-by-the-window-41846-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=300&q=80',
    category: 'Abroad'
  },
  {
    id: 'preset-video-mountain',
    name: 'Mountain River Loop',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-beautiful-scenic-green-mountains-and-river-loop-42865-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=300&q=80',
    category: 'Nature'
  },
  {
    id: 'preset-video-coffee',
    name: 'Steaming Coffee Vibe',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-steam-rising-from-a-cup-of-hot-coffee-43015-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=300&q=80',
    category: 'Cozy'
  },
  {
    id: 'preset-video-sunset',
    name: 'Sunset City Lights',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-traffic-at-sunset-in-a-modern-city-loop-42845-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=300&q=80',
    category: 'City'
  },
  {
    id: 'preset-video-fireplace',
    name: 'Crackling Fireplace',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-fireplace-with-burning-wood-and-bright-flames-44589-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1545147986-a9d6f210df7e?auto=format&fit=crop&w=300&q=80',
    category: 'Cozy'
  },
  {
    id: 'preset-video-rain',
    name: 'Raindrops on Window',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-raindrops-on-window-silhouettes-of-people-walking-40615-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=300&q=80',
    category: 'Rain'
  },
  {
    id: 'preset-video-forest-stream',
    name: 'Forest Water Stream',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-stream-of-water-in-the-forest-42284-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=300&q=80',
    category: 'Nature'
  },
  {
    id: 'preset-video-ocean-waves',
    name: 'Sunset Ocean Waves',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-ocean-waves-crashing-on-shore-during-sunset-41712-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=300&q=80',
    category: 'Nature'
  },
  // High quality premium images
  {
    id: 'preset-img-library',
    name: 'Serene Grand Library',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=300&q=80',
    category: 'Abroad'
  },
  {
    id: 'preset-img-desk',
    name: 'Vintage Writing Desk',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=300&q=80',
    category: 'Abroad'
  },
  {
    id: 'preset-img-flowers',
    name: 'Fresh Flowers & Coffee',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=300&q=80',
    category: 'Cozy'
  }
];

export const AMBIENT_TRACKS = [
  {
    id: 'lofi-1',
    name: 'Calm Healing Lofi',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' // public fallback
  },
  {
    id: 'lofi-2',
    name: 'Rain & Piano Atmosphere',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
  }
];
