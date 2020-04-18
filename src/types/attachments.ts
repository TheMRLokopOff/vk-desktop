export type Attachments = (
  any
)[];

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