// TODO описать новый тип кнопок
// TODO описание кнопок в комментариях
export interface VKKeyboardButton {
  // default = secondary
  color: 'primary' | 'default' | 'secondary' | 'positive' | 'negative'

  action: {
    type: 'text' | 'location' | 'vkpay' | 'open_app' | 'open_link'
    app_id?: number
    hash?: string
    link?: string
    label?: string
    owner_id?: number
    payload: string
  }
}

export interface VKKeyboard {
  author_id: number
  one_time: boolean
  inline?: true
  buttons?: VKKeyboardButton[][]
}

export type VKKeyboardInline = VKKeyboard & { inline: true };