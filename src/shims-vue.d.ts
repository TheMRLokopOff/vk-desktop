declare module '*.vue' {
  import { defineComponent } from 'vue';

  const Component: ReturnType<typeof defineComponent>;
  // eslint-disable-next-line import/no-unused-modules
  export default Component;
}
