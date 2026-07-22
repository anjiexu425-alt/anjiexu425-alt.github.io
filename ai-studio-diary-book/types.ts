export type MediaType = 'image' | 'video';

export interface DiaryPageContent {
  id: string;
  category?: string;
  date?: string;
  title: string;
  quote?: string;
  bodyText: string;
}

export interface DiaryPageMedia {
  type: MediaType;
  url: string;
  urls?: string[]; // Multiple image URLs for grid layouts (e.g. 4 images)
  caption?: string;
}

export interface DiarySpread {
  id: string;
  leftPage: DiaryPageContent;
  rightPage: DiaryPageMedia;
}

export interface PresetMedia {
  id: string;
  name: string;
  type: MediaType;
  url: string;
  thumbnail: string;
  category: string;
}
