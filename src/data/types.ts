export type Segment = {
  id: number;
  startSec: number;
  endSec: number;
  text: string;
};

export type Track = {
  id: string;
  title: string;
  book: string;
  audioFile: string;
  durationSec: number;
  segments: Segment[];
};

export type Manifest = {
  version: number;
  generatedAt: string | null;
  tracks: Track[];
};
