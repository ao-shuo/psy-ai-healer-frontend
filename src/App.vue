<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const logout = () => {
  auth.logout()
  router.push('/auth')
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="branding">
        <p class="brand-pill">psy·ai healer</p>
        <p class="tagline">陪伴式心理 AI 助手</p>
      </div>
      <nav class="app-nav">
        <RouterLink :to="auth.isAdmin ? '/admin' : auth.isCounselor ? '/counselor' : '/home'">仪表板</RouterLink>
        <RouterLink v-if="!auth.isAuthenticated" to="/auth">登录 / 注册</RouterLink>
        <div v-else class="user-chip">
          <span>{{ auth.username }}</span>
          <span class="role-pill" v-if="auth.roles.length">{{ auth.roles.join(', ') }}</span>
        </div>
        <button v-if="auth.isAuthenticated" type="button" class="logout-btn" @click="logout">退出</button>
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
  background: var(--surface-2);
  color: var(--color-ink-strong);
  transition: border-color 0.3s ease, transform 0.3s ease;
}

.logout-btn {
  font-weight: 600;
  padding: 0.65rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid transparent;
  background: var(--surface-2);
  color: var(--color-ink-strong);
  cursor: pointer;
  transition: border-color 0.3s ease, transform 0.3s ease;
}

.logout-btn:hover {
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
}

.app-nav a:hover {
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
}

.user-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
  padding: 0.35rem 0.9rem;
  border-radius: 0.75rem;
  background: var(--surface-3);
  border: 1px solid var(--border-1);
}

.role-pill {
  font-size: 0.75rem;
  color: var(--color-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.2rem;
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
