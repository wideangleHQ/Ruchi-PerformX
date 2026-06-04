# RUCHI PerformX Frontend - Deployment Guide

## Project Overview
This is a production-ready Next.js 15 frontend for RUCHI PerformX, an enterprise workflow management platform. The frontend communicates exclusively with a NestJS backend via Axios API calls.

## Technology Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Component Library:** shadcn/ui
- **State Management:** TanStack Query + React Context
- **Form Handling:** React Hook Form + Zod
- **Real-time:** Socket.IO Client
- **HTTP Client:** Axios
- **Icons:** Lucide React
- **Date Handling:** date-fns

## Environment Variables
Create a `.env.local` file with the following variables:

```env
# Backend API URL (adjust based on environment)
NEXT_PUBLIC_API_URL=https://your-nestjs-api.com

# Socket.IO URL (adjust based on environment)
NEXT_PUBLIC_SOCKET_URL=https://your-nestjs-api.com

# Environment flag
NEXT_PUBLIC_ENV=production
```

## Deployment Steps

### 1. Prerequisites
- Node.js 18+
- pnpm 10+
- NestJS backend running and accessible

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Build
```bash
pnpm run build
```

### 4. Deploy to Vercel
Option A: Using Vercel CLI
```bash
pnpm install -g vercel
vercel --prod
```

Option B: GitHub Integration
- Push to GitHub repository
- Connect repository to Vercel
- Set environment variables in Vercel dashboard
- Vercel will auto-deploy on push

### 5. Environment Variables in Vercel
Set in Vercel Dashboard > Settings > Environment Variables:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `NEXT_PUBLIC_ENV`

## Architecture Overview

### Folder Structure
```
src/
├── api/              # Axios API modules for NestJS communication
├── components/       # Reusable UI components
├── context/          # React Context (Auth only)
├── features/         # Page components
├── hooks/            # Custom React hooks (TanStack Query, custom logic)
├── lib/              # Utilities and helpers
├── types/            # TypeScript interfaces
└── config/           # Configuration (TanStack Query, Socket.IO)

app/
├── (public)/         # Login, signup, forgot-password
└── (protected)/      # Authenticated routes
```

### Authentication Flow
1. User submits credentials on login page
2. Frontend calls `POST /auth/login` via NestJS backend
3. Backend returns JWT token and user object
4. Frontend stores token in httpOnly cookie + Auth Context
5. Axios interceptor adds JWT to all subsequent requests
6. On 401: Frontend calls `POST /auth/refresh` to get new token
7. Protected routes redirect unauthenticated users to login

### Key Features

#### Role-Based Access
- MD: Full system access
- HOD: Department-level management
- EMPLOYEE: Personal tasks and actions
- ADMIN: System administration

#### Real-time Updates (Phase 1)
- Notification events (`notification:new`)
- Task updates (`task:updated`)
- Comment notifications (`comment:new`)

#### Dashboard
- Single unified dashboard component
- Role-based widget rendering
- Data from `GET /analytics/dashboard`

#### Task Management
- Task list with filtering
- Task detail with comments
- Task creation/editing forms

### Performance Optimization
- TanStack Query: 5-minute stale time, 10-minute garbage collection
- Code splitting by route
- Lazy loading of components
- Image optimization via Next.js
- Socket.IO: Rooms-based subscriptions

### Security
- JWT tokens in httpOnly cookies
- CSRF protection via middleware
- XSS prevention with proper escaping
- SQL injection protection (backend)
- Input validation via Zod
- Role-based access guards

## Development

### Local Development
```bash
# Install dependencies
pnpm install

# Start dev server
pnpm run dev

# Open http://localhost:3000
```

### Build for Production
```bash
pnpm run build

# Analyze bundle
pnpm run build --analyze
```

### Linting and Type Checking
```bash
# Type check
pnpm tsc --noEmit

# Format code
pnpm format
```

## Monitoring & Logging

### Recommendations
- **Error Tracking:** Sentry
- **Performance Monitoring:** Vercel Analytics
- **Logging:** Pino or Winston
- **APM:** DataDog or New Relic

## Troubleshooting

### Build Issues
- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && pnpm install`
- Check Node.js version compatibility

### Runtime Issues
- Check browser console for errors
- Verify API URL is correct and accessible
- Ensure backend is running
- Check network tab in DevTools

### Socket.IO Connection Issues
- Verify Socket.IO server is running
- Check CORS configuration on backend
- Enable WebSocket support in deployment environment

## Support & Resources
- Project Documentation: See `v0_plans/sharp-design.md`
- Next.js Docs: https://nextjs.org/docs
- TanStack Query Docs: https://tanstack.com/query
- Vercel Docs: https://vercel.com/docs
