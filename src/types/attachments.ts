export interface MessageAttachments {
  type?:
    | 'geo' | 'doc' | 'link' | 'poll' | 'wall' | 'call' | 'gift' | 'story' | 'photo' | 'audio' | 'video' | 'event'
    | 'market' | 'artist' | 'sticker' | 'article' | 'podcast' | 'graffiti' | 'wall_reply' | 'audio_message'
    | 'money_request' | 'audio_playlist'

  geo?: Geo
}

export interface Geo {
  type: 'point'
  coordinates: {
    latitude: number
    longitude: number
  }
  place?: {
    country: string
    city: string
    title: string
  }
}
