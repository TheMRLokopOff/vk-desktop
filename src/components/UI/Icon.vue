<script lang="ts">
import { h, SVGAttributes } from 'vue';

interface IconProps {
  name: string
  iconProps: SVGAttributes
}

export default function Icon({ name, ...iconProps }: IconProps) {
  const icon = require(`!vue-svg-loader!assets/${name}.svg`).default;
  return h(icon, iconProps);
}
</script>
