import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
app.mount('#app')

// Avisar a script.js que el DOM de Vue ya está listo
window.vueIsMounted = true;
window.dispatchEvent(new Event('vue-mounted'));
