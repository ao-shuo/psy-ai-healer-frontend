<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="branding">
        <p class="brand-pill">psy·ai healer</p>
        <p class="tagline">陪伴式心理 AI 助手</p>
      </div>
      <nav class="app-nav">
        <RouterLink to="/">仪表板</RouterLink>
        <RouterLink to="/auth">登录 / 注册</RouterLink>
      </nav>
    </header>

    <main class="app-main">
      <RouterView />
    </main>

    <footer class="app-footer">
      <p>2025 · Psy AI Healer · 情绪洞察与陪伴式引导</p>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 2rem clamp(1rem, 4vw, 3rem);
  position: relative;
  color: var(--color-ink);
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.branding {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.brand-pill {
  align-self: flex-start;
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  background: var(--gradient-sage);
  color: var(--color-ink-strong);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.2rem;
  text-transform: uppercase;
}

.tagline {
  font-size: 0.95rem;
  color: var(--color-ink-muted);
}

.app-nav {
  display: flex;
  gap: 1rem;
}

.app-nav a {
  font-weight: 600;
  padding: 0.65rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.2);
  color: var(--color-ink-strong);
  transition: border-color 0.3s ease, transform 0.3s ease;
}

.app-nav a:hover {
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
}

.app-main {
  flex: 1;
}

.app-footer {
  text-align: center;
  font-size: 0.85rem;
  color: var(--color-ink-muted);
  letter-spacing: 0.1rem;
}
</style>
