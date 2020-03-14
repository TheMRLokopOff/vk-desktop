# VK Desktop

## Планы на ветку next

Данная ветка расчитана __только__ на улучшение, рефакторинг и оптимизацию всего кода,
а значит каких-то крутых фич для пользователей здесь реализовано не будет.

- Обновить мажорные версии основных зависимостей:
  + [vue-3.0.0-alpha.x](https://github.com/vuejs/vue-next)
  + [vue-loader-next](https://github.com/vuejs/vue-loader/tree/next)
  + [vuex-next](https://github.com/kiaking/vuex3-on-vue3/tree/4.0)
  + [vue-router-next](https://github.com/vuejs/vue-router-next)
  + [webpack-5.0.0-beta.x](https://github.com/webpack/webpack) (если успеет выйти)
- Начать использовать [ESLint](https://eslint.org/)
- Переписать весь код

## Скачать VK Desktop

Скачать последнюю версию приложения всегда можно [здесь](https://github.com/danyadev/vk-desktop/releases).

## Сборка приложения

У вас должен быть установлен [Node.js](http://nodejs.org) **версии минимум 10.13.0** и [Git](https://git-scm.com/downloads).

```bash
$ git clone https://github.com/danyadev/vk-desktop.git # Клонирование репозитория
$ cd vk-desktop # Переход в папку приложения
$ npm i # Установка всех зависимостей в проекте
$ npm run build # Сборка клиента
# ТОЛЬКО ДЛЯ WINDOWS
# Здесь можно указать 32, 64 или ничего, чтобы собрать под все разрядности
$ npm run win-setup[32|64] # Сборка установщика
```

После сборки все файлы будут находиться в папке out.

## Возможная проблема при разработке (Windows)

Если у вас вдруг при обновлении страницы приложения перестал отображаться контент, то необходимо
открыть папку `AppData/Roaming` (открывается с помощью комбинации клавиш `Win+R` и вводе там `%appdata%`)
и удалить оттуда папки `vk-desktop` и `Electron`. В данных папках находится кеш приложения, поэтому
после их удаления приложение полностью сбросится и необходимо будет заново войти в аккаунт.
