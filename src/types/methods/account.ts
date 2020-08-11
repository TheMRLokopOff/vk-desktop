export interface AccountGetPushSettings {
  disabled: 1
  conversations: {
    count: number
    items: {
      /**
       * ID диалога
       */
      peer_id: number
      /**
       * Время в unixtime, когда уведомления будут включены
       *
       * Если вернулось значение -1, то уведомления либо включены,
       * либо выключены на неограниченный срок.
       */
      disabled_until: number
      /**
       * Неизвестное значение, которое стоит игнорировать
       */
      sound: 0 | 1
    }[]
  }
}

export interface AccountGetCounters {
  /**
   * Количество запросов в играх
   */
  app_requests?: number
  /**
   * ???
   */
  events?: number
  /**
   * Количество заявок в друзья
   */
  friends?: number
  /**
   * Количество новых рекомендаций друзей
   */
  friends_recommendations?: number
  /**
   * ???
   */
  gifts?: number
  /**
   * Количество приглашений в группы
   */
  groups?: number
  /**
   * ???
   */
  menu_discover_badge?: number
  /**
   * ???
   */
  menu_clips_badge?: number
  /**
   * ???
   */
  menu_superapp_friends_badge?: number
  /**
   * Количество непрочитанных сообщений
   */
  messages?: number
  /**
   * ???
   */
  notes?: number
  /**
   * ???
   */
  notifications?: number
  /**
   * ???
   */
  photos?: number
  /**
   * ???
   */
  sdk?: number
  /**
   * ???
   */
  videos?: number
}
