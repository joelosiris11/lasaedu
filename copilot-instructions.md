# Copilot Instructions for LasaEdu

This document helps Copilot sessions work effectively in the LasaEdu Learning Management System (LMS) repository.

## Quick Start

- **Node Version**: 18.x or higher
- **Package Manager**: npm
- **Main Dev Command**: `npm run dev` (starts Vite at http://localhost:5173)
- **Firebase Emulator**: `npm run firebase:emulator` (required for local development)

## Build, Test & Lint Commands

### Development
```bash
npm run dev              # Start Vite dev server (watch mode)
npm run build            # TypeScript check + Vite build → dist/
npm run preview          # Preview production build locally
```

### Testing
```bash
npm run test             # Vitest in watch mode (all tests)
npm run test:run         # Run tests once (CI mode)
npm run test:coverage    # Generate coverage report
npm run test:ui          # Interactive test UI
```

**Running a Single Test File:**
```bash
# In watch mode
npm run test -- src/path/to/component.test.ts

# Single run
npm run test:run -- src/path/to/component.test.ts
```

### Linting
```bash
npm run lint             # ESLint check (no auto-fix)
```

### Firebase Emulators
```bash
npm run firebase:emulator           # Start all emulators
npm run firebase:emulator:export    # Export emulator data
npm run firebase:emulator:import    # Start with imported data
```

Emulator URLs: Database (9000), Storage (9199), Emulator UI (4000)

### Deployment
```bash
npm run deploy           # Build + deploy to Firebase Hosting
npm run deploy:preview   # Deploy to preview channel
```

---

## High-Level Architecture

LasaEdu uses a **multi-role, service-based architecture** with clear separation between UI and data layers:

```
┌─ UI LAYER (React Components) ─────────┐
│  Pages → Components → Hooks            │
├────────────────────────────────────────┤
│ SERVICE LAYER (Typed, singleton)      │
│ • dataService (facade)                │
│ • courseService, userService, etc.    │
│ • authService                         │
├────────────────────────────────────────┤
│ STATE MANAGEMENT (Zustand)             │
│ • authStore (persisted with devtools) │
│ • notificationStore                   │
├────────────────────────────────────────┤
│ FIREBASE ABSTRACTION                  │
│ • firebaseDataService (types + CRUD)  │
│ • Real Firebase DB or Emulator        │
└────────────────────────────────────────┘
```

### Key Architectural Principles

1. **No Mock Data**: The app reads EVERYTHING from Firebase (Realtime DB). No hardcoded constants—all CRUD operations hit the database.

2. **Role-Based UI**: Router uses `useAuthStore()` to determine dashboard (AdminDashboard, TeacherDashboard, StudentDashboard, SupportDashboard). Protected routes check role before rendering.

3. **Firebase-First Development**: Must have Firebase Emulator running (`npm run firebase:emulator`). Without seed data, dashboards show empty lists.

4. **Zustand with Persistence**: Auth state persists across sessions via `persist` middleware. Enable devtools in browser DevTools.

5. **Type Safety**: Comprehensive TypeScript types defined in `src/shared/types/` (User, Course, Module, Enrollment, Evaluation, etc.). DB types exported from `firebaseDataService.ts`.

### Path Aliases
All imports use aliases for readability:
- `@` = `src/`
- `@components` = `src/shared/components/`
- `@modules` = `src/modules/`
- `@shared` = `src/shared/`
- `@app` = `src/app/`
- `@assets` = `src/assets/`

---

## Key Conventions

### File Structure

**Module Layout** (e.g., `src/modules/courses/`):
```
modules/courses/
├── components/          # React components specific to this module
├── pages/              # Full-page components (routed)
├── services/           # Business logic (optional, use shared services for most)
├── hooks/              # Custom hooks (if complex logic)
└── types.ts            # Module-specific types (if needed)
```

**Shared Structure** (`src/shared/`):
```
shared/
├── components/layout/  # MainLayout, Sidebar, Header
├── components/ui/      # Reusable UI: Button, Card, Input, Label
├── components/media/   # VideoPlayer, ImageUploader
├── hooks/              # useDashboard, useEnrollments, etc.
├── services/           # dataService (facade), Firebase abstraction
├── types/              # Core types: User, Course, Enrollment, etc.
└── utils/              # Helper functions
```

### Naming Conventions

- **Services**: camelCase, `*Service` suffix (e.g., `courseService`, `authService`)
- **Components**: PascalCase (e.g., `CourseCard`, `StudentDashboard`)
- **Hooks**: camelCase, `use*` prefix (e.g., `useCourses`, `useEnrollments`)
- **Types**: PascalCase interfaces/types (e.g., `User`, `Course`, `Enrollment`)
- **DB Collections**: lowercase, plural (e.g., `users`, `courses`, `enrollments`)
- **DB Document IDs**: descriptive with underscore (e.g., `admin_1`, `course_1`, `enroll_1`)

### Component Patterns

**Functional Components**: Always use function declarations for clarity:
```typescript
export function CourseCard({ course }: { course: Course }) {
  return <div>...</div>;
}
```

**Props Interface**: Define beside component or in separate types file for complex modules.

**Hooks Usage**: Use Zustand stores and custom hooks for state:
- `const { user, logout } = useAuthStore()`
- `const { courses, loading } = useCourses()`

### Service Patterns

**Layered Calls**: Services call other services (composition):
```typescript
// dataService.ts exports facade with typed methods
export const dataService = {
  courses: {
    getAll: () => firebaseDB.getCourses(),
    getById: (id: string) => firebaseDB.getCourseById(id),
    create: (data: CourseInput) => firebaseDB.createCourse(data),
  },
  // ... other entity services
};
```

**Firebase Integration**: All data operations route through `firebaseDataService.ts`, which provides:
- Typed CRUD methods for each collection
- Error handling with meaningful messages
- Type safety with strict TypeScript

### State Management (Zustand)

**Auth Store** (`src/app/store/authStore.ts`):
```typescript
const { user, isAuthenticated, login, logout, register } = useAuthStore();
```
- Persisted across sessions
- Devtools enabled
- Handles JWT tokens and sessions

**Notification Store**: For app-wide toasts/alerts—check before adding new stores.

**Pattern**: Single source of truth; avoid prop drilling via stores, not context.

### Form Handling

- Use **React Hook Form** with `useForm()` hook
- Validate with **Zod** schemas via `@hookform/resolvers`
- Example:
```typescript
const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });
```

### Styling

- **TailwindCSS** for all styling
- Utility-first approach; avoid custom CSS unless unavoidable
- For conflicts: use `clsx` or `tailwind-merge`
- Dark mode: Use `dark:` prefix in Tailwind classes

### Testing (Vitest + React Testing Library)

**Location**: `.test.ts` or `.spec.ts` files alongside source.

**Pattern**:
```typescript
import { render, screen } from '@testing-library/react';
import { CourseCard } from './CourseCard';

it('renders course title', () => {
  render(<CourseCard course={mockCourse} />);
  expect(screen.getByText(mockCourse.title)).toBeInTheDocument();
});
```

---

## Firebase Realtime Database Schema

### Key Collections

| Collection | Purpose | Key Fields |
|-----------|---------|-----------|
| `users` | User accounts and profiles | id, email, name, role, emailVerified, createdAt |
| `courses` | Course definitions | id, title, instructorId, status, level, category |
| `modules` | Course modules | id, courseId, title, order |
| `lessons` | Course lessons | id, moduleId, title, type, content |
| `enrollments` | Student enrollments | id, userId, courseId, status, progress |
| `evaluations` | Quizzes/exams | id, courseId, title, questions, timeLimit |
| `evaluationAttempts` | Evaluation responses | id, evaluationId, userId, answers, score |
| `grades` | Grade records | id, userId, courseId, evaluationId, score |
| `certificates` | Issued certificates | id, userId, courseId, certificateNumber, issuedAt |
| `messages` | Direct messages | id, senderId, receiverId, content, timestamp |
| `notifications` | User notifications | id, userId, title, message, read, createdAt |
| `supportTickets` | Support requests | id, userId, subject, status, priority |
| `userPoints` | Gamification points | id, userId, points, history |

### User Roles

```typescript
type UserRole = 'student' | 'teacher' | 'admin' | 'support';
```

Each role has different route permissions via `ProtectedRoute` component.

---

## Common Tasks

### Adding a New Course Feature

1. Create module: `src/modules/courses/pages/NewFeaturePage.tsx`
2. Add route in `src/app/router/index.tsx` with appropriate role check
3. Create service method if needed in `dataService`
4. Use `useCourses()` or similar hook for data
5. Persist with `firebaseDB.updateCourse(id, data)`

### Creating a Custom Hook

1. Add to `src/shared/hooks/` (e.g., `useEnrollmentFilter.ts`)
2. Use Zustand store + `firebaseDB` calls
3. Return typed data and helper functions
4. Add test file in same directory

### Adding a Database Collection

1. Define types in `src/shared/types/index.ts`
2. Add CRUD methods to `firebaseDataService.ts`
3. Export facade methods in `dataService.ts`
4. Create service hook (e.g., `useMyEntity()`)

### Testing a Component

1. Create `Component.test.tsx` in same directory
2. Import `render, screen` from Testing Library
3. Mock dependencies using `vi.mock()`
4. Test user interactions and state changes
5. Run: `npm run test:run -- Component.test.tsx`

---

## Debugging & Development Tips

### Firebase Emulator UI
- Dashboard: http://localhost:4000/database
- See real-time data, inspect collections, manually edit
- Very useful for seed data verification

### Console Logs & Devtools
- Zustand state visible in Redux DevTools extension (has devtools middleware)
- Check Network tab for Firebase REST calls
- Emulator logs appear in terminal

### Hot Module Replacement (HMR)
- Vite auto-refreshes on file save
- Preserve state in stores; component state resets
- If HMR breaks, restart `npm run dev`

### Build Optimization
- Chunks split by vendor (React, Firebase, UI, utils) in `vite.config.ts`
- Source maps disabled in production (`vite.config.ts`)
- Target: ES2020 (modern browsers)

---

## Important Notes

- **No Hardcoded Data**: Every piece of UI data comes from Firebase. Empty emulator = empty UI. Populate with seed data or cURL.
- **Dependencies Stay Sync'd**: Check `package.json` before installing new libs. Pin versions to avoid drift.
- **Git Conventions**: Use conventional commits (feat:, fix:, docs:, test:, refactor:, chore:)
- **TypeScript Strict Mode**: Project enforces strict types; avoid `any` unless documented.
- **Env Variables**: `.env.local` for Firebase config; never commit secrets. See README for production setup.

---

**Last Updated**: February 2026  
**Maintained By**: LasaEdu Development Team
