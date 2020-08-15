<template>
  <Transition name="fade-out">
    <div v-if="text">
      <div class="tooltip_arrow" :style="arrowPosition"></div>
      <div ref="tooltip" class="tooltip_text" :style="textPosition">{{ text }}</div>
    </div>
  </Transition>
</template>

<script lang="ts">
import { defineComponent, reactive, nextTick } from 'vue';
import getTranslate from 'js/getTranslate';
import { IEventAddon } from 'types/internal';

export default defineComponent({
  setup() {
    interface IState {
      tooltip: HTMLDivElement | null
      text: string
      arrowPosition: Record<string, string>
      textPosition: Record<string, string>
    }

    const state = reactive<IState>({
      tooltip: null,
      text: '',
      arrowPosition: {},
      textPosition: {}
    });

    function setPosition(el: HTMLElement) {
      const [titlebar, app] = document.querySelector('.root').children as unknown as HTMLDivElement[];
      const { clientWidth } = app;
      const { width: tooltipWidth }: DOMRect = state.tooltip.getBoundingClientRect();
      let { x, y, width, height } = el.getBoundingClientRect();

      const centerElX = x + width / 2;
      const maxTooltipRight = clientWidth - tooltipWidth - 8;

      // Вычитаем из координаты высоту тайтлбара, т.к. враппер контекстного меню имеет высоту в виде
      // <высота приложения> - <высота тайтлбара>, а координаты приходят с верхней точки приложения
      y -= titlebar.clientHeight - height;
      // Центруем тултип по центру элемента
      x = centerElX - tooltipWidth / 2;

      if (x > maxTooltipRight) {
        x = maxTooltipRight;
      }

      state.textPosition = {
        left: x + 'px',
        top: y + 'px'
      };

      state.arrowPosition = {
        left: centerElX - 5 + 'px',
        top: y - 2 + 'px'
      };
    }

    let prevEl: HTMLElement;

    window.addEventListener('mousemove', async (event: MouseEvent & IEventAddon) => {
      const el = event.path.find((el) => ('dataset' in el) && el.dataset.tooltip) as HTMLElement;

      if (el && prevEl !== el) {
        state.text = getTranslate(el.dataset.tooltip);
        await nextTick();
        setPosition(el);
      } else if (!el && prevEl) {
        state.text = '';
      }

      prevEl = el;
    });

    return state;
  }
});
</script>

<style>
.tooltip_text {
  position: absolute;
  margin-top: 8px;
  background: rgba(0, 0, 0, .7);
  border-radius: 3px;
  font-size: 12.5px;
  color: #fff;
  pointer-events: none;
  white-space: nowrap;
  padding: 5px 8px;
}

.tooltip_arrow {
  position: absolute;
  border: 5px solid transparent;
  border-bottom: 5px solid rgba(0, 0, 0, .7);
}
</style>
