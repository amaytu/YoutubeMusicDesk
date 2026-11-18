export interface Ref {
  name: string;
  id?: string;
}

export interface Track {
  kind: "song";
  videoId: string;
  title: string;
  subtitle?: string;
  artists?: Ref[];
  album?: Ref;
  duration?: string;
  thumb?: string;
  playlistId?: string;
  /** Posição na fila (apenas na fila). */
  index?: number;
  selected?: boolean;
}

interface CardBase {
  id: string;
  title: string;
  subtitle?: string;
  thumb?: string;
}

export interface AlbumItem extends CardBase {
  kind: "album";
  artists?: Ref[];
  year?: string;
}
export interface ArtistItem extends CardBase {
  kind: "artist";
}
export interface PlaylistItem extends CardBase {
  kind: "playlist";
}
export interface OtherItem extends CardBase {
  kind: "other";
}

export type Item = Track | AlbumItem | ArtistItem | PlaylistItem | OtherItem;

export interface Shelf {
  title: string;
  items: Item[];
  /** Resultado principal da busca. */
  top?: boolean;
}

export interface Collection {
  kind: "album" | "playlist";
  id: string;
  title: string;
  subtitle: string;
  info: string;
  description: string;
  artists: Ref[];
  year?: string;
  thumb: string;
  playlistId?: string;
  tracks: Track[];
}

export interface ArtistPage {
  id: string;
  name: string;
  description: string;
  thumb: string;
  subscribers: string;
  monthlyListeners: string;
  playlistId?: string;
  radioPlaylistId?: string;
  songs: Track[];
  albums: AlbumItem[];
  singles: AlbumItem[];
  videos: Track[];
  related: ArtistItem[];
}

export type RepeatMode = "NONE" | "ALL" | "ONE";

export interface PlayerState {
  videoId: string;
  title: string;
  artist: string;
  album: string;
  artistId: string;
  albumId: string;
  thumb: string;
  duration: number;
  time: number;
  playing: boolean;
  volume: number;
  muted: boolean;
  liked: boolean;
  repeat: RepeatMode;
  /** Date.now() do momento em que `time` foi medido. */
  at: number;
}

export interface Lyrics {
  text: string;
  source: string;
}

export type YtmEvent =
  | { kind: "state"; data: PlayerState }
  | { kind: "auth"; data: { signedIn: boolean; changed: boolean } };
