import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import HomeView from '../views/HomeView.vue'
import AuthView from '../views/AuthView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/auth',
      name: 'auth',
      component: AuthView,
      meta: { requiresAuth: false }
    },
    {
      path: '/',
      redirect: '/home'
    },
    {
      path: '/home',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: true, roles: ['STUDENT'] }
    },
    {
      path: '/therapy',
      name: 'therapy',
      component: () => import('../views/TherapyView.vue'),
      meta: { requiresAuth: true, roles: ['STUDENT'] }
    },
    {
      path: '/live2d',
      name: 'live2d',
      component: () => import('../views/Live2DView.vue'),
      meta: { requiresAuth: true, roles: ['STUDENT'] }
    },
    {
      path: '/assessment',
      name: 'assessment',
      component: () => import('../views/AssessmentView.vue'),
      meta: { requiresAuth: true, roles: ['STUDENT'] }
    },
    {
      path: '/counselor',
      name: 'counselor',
      component: () => import('../views/CounselorView.vue'),
      meta: { requiresAuth: true, roles: ['COUNSELOR'] }
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: { requiresAuth: true, roles: ['ADMIN'] }
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // 获取当前用户信息
  if (authStore.token && !authStore.user) {
    await authStore.fetchCurrentUser()
  }
  
  // 检查是否需要认证
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/auth')
    return
  }
  
  // 检查角色权限
  if (to.meta.roles) {
    const allowed = to.meta.roles as string[]
    const currentRole = authStore.user?.role ?? (authStore.roles.length ? authStore.roles[0] : null)
    if (currentRole && !allowed.includes(currentRole)) {
      next('/auth')
      return
    }
  }
  
  // 已登录用户访问登录页，按角色重定向，避免 ADMIN/Counselor 被送去 /home 造成循环
  if (to.path === '/auth' && authStore.isAuthenticated) {
    const currentRole = authStore.user?.role ?? (authStore.roles.length ? authStore.roles[0] : null)
    if (currentRole === 'ADMIN') {
      next('/admin')
      return
    }
    if (currentRole === 'COUNSELOR') {
      next('/counselor')
      return
    }
    next('/home')
    return
  }
  
  next()
})

export default router