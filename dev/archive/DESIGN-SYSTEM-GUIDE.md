# DarkFrame Design System Guide

**Version**: 1.0  
**Last Updated**: January 17, 2025  
**Framework**: React 18 + TypeScript + Tailwind CSS + Framer Motion  

---

## Table of Contents

1. [Introduction](#introduction)
2. [Design Tokens](#design-tokens)
3. [Component Library](#component-library)
4. [Animation System](#animation-system)
5. [Utility Functions](#utility-functions)
6. [Best Practices](#best-practices)
7. [Accessibility Guidelines](#accessibility-guidelines)
8. [Performance Considerations](#performance-considerations)

---

## Introduction

The DarkFrame Design System provides a comprehensive set of reusable components, animations, and utilities for building consistent, accessible, and performant user interfaces in the DarkFrame game.

### Core Principles
- **Consistency**: Unified visual language across all interfaces
- **Accessibility**: WCAG 2.1 Level AA compliance
- **Performance**: 60fps animations, optimized rendering
- **Developer Experience**: TypeScript-first, comprehensive documentation
- **Responsive**: Mobile-first design with progressive enhancement

### Tech Stack
- **React 18**: Component architecture with concurrent features
- **TypeScript**: Type safety and IntelliSense support
- **Tailwind CSS**: Utility-first CSS framework
- **Framer Motion**: Production-ready animation library
- **Lucide Icons**: Lightweight icon library

---

## Design Tokens

Design tokens are the visual design atoms of the design system — specifically, they are named entities that store visual design attributes.

### Colors

#### Grayscale (Primary Palette)
```css
gray-50:  #F9FAFB  /* Lightest */
gray-100: #F3F4F6
gray-200: #E5E7EB
gray-300: #D1D5DB  /* Light text on dark */
gray-400: #9CA3AF  /* Muted text on dark */
gray-500: #6B7280
gray-600: #4B5563
gray-700: #374151  /* Borders */
gray-800: #1F2937  /* Card backgrounds */
gray-900: #111827  /* Primary background */
gray-950: #030712  /* Darkest */
```

#### Brand Colors
```css
blue-400: #60A5FA  /* Links, accents */
blue-500: #3B82F6  /* Focus rings */
blue-600: #2563EB  /* Primary buttons */
blue-700: #1D4ED8  /* Primary hover */
```

#### Semantic Colors
```css
/* Success */
green-400: #4ADE80  /* Success text */
green-500: #22C55E  /* Success accent */
green-600: #16A34A  /* Success buttons */
green-700: #15803D  /* Success hover */

/* Warning */
yellow-400: #FACC15  /* Warning text */
yellow-500: #EAB308  /* Warning accent */
yellow-600: #CA8A04  /* Warning buttons */

/* Danger */
red-400: #F87171  /* Error text */
red-500: #EF4444  /* Danger accent */
red-600: #DC2626  /* Danger buttons */
red-700: #B91C1C  /* Danger hover */

/* Purple (Special) */
purple-500: #A855F7  /* Epic rarity */

/* Cyan (Rare) */
cyan-500: #06B6D4  /* Rare items */

/* Orange (Legendary) */
orange-500: #F97316  /* Legendary rarity */
```

#### Rarity Colors (Game-Specific)
```css
Common:    gray-400   (#9CA3AF)
Uncommon:  green-400  (#4ADE80)
Rare:      cyan-500   (#06B6D4)
Epic:      purple-500 (#A855F7)
Legendary: orange-500 (#F97316)
```

### Typography

#### Font Families
```css
font-sans: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji"
/* Tailwind default system font stack */
```

#### Font Sizes
```css
text-xs:   12px (0.75rem)   /* Small labels, badges */
text-sm:   14px (0.875rem)  /* Secondary text, descriptions */
text-base: 16px (1rem)      /* Body text, default */
text-lg:   18px (1.125rem)  /* Emphasized text */
text-xl:   20px (1.25rem)   /* Small headings */
text-2xl:  24px (1.5rem)    /* Panel titles */
text-3xl:  30px (1.875rem)  /* Page titles */
text-4xl:  36px (2.25rem)   /* Hero text */
```

#### Font Weights
```css
font-normal:   400  /* Body text */
font-medium:   500  /* Emphasized text, buttons */
font-semibold: 600  /* Headings */
font-bold:     700  /* Strong emphasis, stats */
```

#### Line Heights
```css
leading-tight:   1.25  /* Headings */
leading-snug:    1.375 /* Compact text */
leading-normal:  1.5   /* Body text */
leading-relaxed: 1.625 /* Comfortable reading */
```

### Spacing

Tailwind's default spacing scale (1 unit = 0.25rem = 4px):
```css
1:  4px    (0.25rem)
2:  8px    (0.5rem)
3:  12px   (0.75rem)
4:  16px   (1rem)     /* Standard padding/margin */
5:  20px   (1.25rem)
6:  24px   (1.5rem)   /* Card padding */
8:  32px   (2rem)     /* Section spacing */
10: 40px   (2.5rem)
12: 48px   (3rem)
16: 64px   (4rem)
```

### Shadows

```css
shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.05)
shadow:     0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)
shadow-md:  0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)
shadow-lg:  0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)
shadow-xl:  0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)
shadow-2xl: 0 25px 50px rgba(0, 0, 0, 0.25)
```

### Border Radius
```css
rounded-none: 0
rounded-sm:   0.125rem (2px)
rounded:      0.25rem  (4px)  /* Default buttons, inputs */
rounded-md:   0.375rem (6px)  /* Cards */
rounded-lg:   0.5rem   (8px)  /* Panels */
rounded-xl:   0.75rem  (12px) /* Modals */
rounded-full: 9999px          /* Circular elements */
```

### Transitions
```css
transition-all:    all 0.15s ease-in-out
transition-colors: color, background-color, border-color 0.15s
transition-opacity: opacity 0.15s
transition-transform: transform 0.15s
```

---

## Component Library

### Button

**File**: `components/ui/Button.tsx`  
**Purpose**: Primary interaction component for user actions

**Props**:
```typescript
interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  className?: string;
}
```

**Variants**:
- **primary**: Blue background, white text (default)
- **secondary**: Gray background, white text
- **danger**: Red background, white text (destructive actions)
- **success**: Green background, white text (confirmations)
- **ghost**: Transparent background, gray text (subtle actions)

**Sizes**:
- **sm**: 32px height, 12px padding, 14px text
- **md**: 40px height, 16px padding, 16px text (default)
- **lg**: 48px height, 24px padding, 18px text

**Usage**:
```tsx
import { Button } from '@/components/ui/Button';

// Primary button (default)
<Button onClick={handleClick}>Click Me</Button>

// Danger button (large)
<Button variant="danger" size="lg" onClick={handleDelete}>
  Delete Item
</Button>

// Ghost button (small)
<Button variant="ghost" size="sm">Cancel</Button>

// Full width button
<Button fullWidth>Submit Form</Button>

// Disabled button
<Button disabled>Processing...</Button>
```

**Accessibility**:
- Minimum 44px touch target (≥md size)
- Clear focus indicators (`focus:ring-2`)
- Disabled state communicated visually and via `disabled` attribute
- Use icon buttons with `aria-label` for icon-only buttons

---

### Card

**File**: `components/ui/Card.tsx`  
**Purpose**: Container for grouped content with border and shadow

**Props**:
```typescript
interface CardProps {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;      // Hover lift effect
  glowColor?: string;   // Optional glow color (e.g., 'blue', 'purple')
  onClick?: () => void;
  className?: string;
}
```

**Features**:
- Rounded corners (`rounded-lg`)
- Gray border (`border-gray-700`)
- Dark background (`bg-gray-800`)
- Optional hover effect (lift + glow)
- Configurable padding
- Optional glow effect for emphasis

**Usage**:
```tsx
import { Card } from '@/components/ui/Card';

// Basic card
<Card>
  <h3>Card Title</h3>
  <p>Card content goes here...</p>
</Card>

// Hoverable card with glow
<Card hover glowColor="blue" onClick={handleClick}>
  <p>Interactive card with blue glow on hover</p>
</Card>

// Card with custom padding
<Card padding="lg">
  <p>Large padding content</p>
</Card>

// Card with no padding (for full-bleed content)
<Card padding="none">
  <img src="image.jpg" alt="Full width image" />
</Card>
```

**Accessibility**:
- Semantic `<article>` element
- If clickable, uses `<button>` semantics
- Clear focus indicators on interactive cards

---

### Badge

**File**: `components/ui/Badge.tsx`  
**Purpose**: Small label for status, categories, counts

**Props**:
```typescript
interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
}
```

**Variants**:
- **default**: Gray background (neutral status)
- **primary**: Blue background (active/selected)
- **success**: Green background (positive status)
- **warning**: Yellow background (caution)
- **danger**: Red background (error/critical)

**Sizes**:
- **sm**: 10px padding, 12px text
- **md**: 12px padding, 14px text (default)

**Usage**:
```tsx
import { Badge } from '@/components/ui/Badge';

// Default badge
<Badge>Common</Badge>

// Success badge
<Badge variant="success">Active</Badge>

// Danger badge (small)
<Badge variant="danger" size="sm">Error</Badge>

// Count badge
<Badge variant="primary">{unreadCount}</Badge>

// Rarity badges (game-specific)
<Badge variant="success">Uncommon</Badge>
<Badge className="bg-cyan-600">Rare</Badge>
<Badge className="bg-purple-600">Epic</Badge>
<Badge className="bg-orange-500">Legendary</Badge>
```

**Accessibility**:
- Use `aria-label` for icon-only badges
- Ensure sufficient color contrast (4.5:1 minimum)

---

### Panel

**File**: `components/ui/Panel.tsx`  
**Purpose**: Section container with optional title and border

**Props**:
```typescript
interface PanelProps {
  children: ReactNode;
  title?: string;
  titleRight?: ReactNode;  // Optional right-aligned content (buttons, etc.)
  className?: string;
}
```

**Features**:
- Optional title bar with right-aligned actions
- Border and background styling
- Consistent padding
- Flexible content area

**Usage**:
```tsx
import { Panel } from '@/components/ui/Panel';

// Panel with title
<Panel title="Player Stats">
  <p>Stats content...</p>
</Panel>

// Panel with title and action button
<Panel 
  title="Inventory" 
  titleRight={<Button size="sm">Sort</Button>}
>
  <div>Inventory items...</div>
</Panel>

// Panel without title
<Panel>
  <p>Content without header</p>
</Panel>
```

**Accessibility**:
- Uses `<section>` semantic element
- Title uses appropriate heading level (h2/h3)
- Clear visual hierarchy

---

### StatCard

**File**: `components/ui/StatCard.tsx`  
**Purpose**: Display animated statistics with icon and trend

**Props**:
```typescript
interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}
```

**Features**:
- Icon display (left-aligned)
- Label and value with clear hierarchy
- Optional trend indicator (arrow + percentage)
- Hover effect for interactivity
- Pairs well with `useCountUp` for animated numbers

**Usage**:
```tsx
import { StatCard } from '@/components/ui/StatCard';
import { Coins } from 'lucide-react';

// Basic stat card
<StatCard 
  icon={<Coins className="h-6 w-6" />}
  label="Metal"
  value="1,234"
/>

// Stat card with trend
<StatCard 
  icon={<TrendingUp className="h-6 w-6" />}
  label="Power"
  value="850"
  trend={{ value: 12.5, isPositive: true }}
/>

// Animated stat card (with useCountUp)
const metalDisplay = useCountUp(player.metalCount, { duration: 1000 });
<StatCard 
  icon={<Coins className="h-6 w-6" />}
  label="Metal"
  value={metalDisplay}
/>
```

**Accessibility**:
- Label and value clearly associated
- Trend direction communicated visually (color + arrow)
- Icon is decorative (aria-hidden if needed)

---

### ProgressBar

**File**: `components/ui/ProgressBar.tsx`  
**Purpose**: Visual representation of progress or completion

**Props**:
```typescript
interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  className?: string;
}
```

**Features**:
- Configurable value and maximum
- Optional label and percentage display
- Smooth transition animation
- Responsive width

**Usage**:
```tsx
import { ProgressBar } from '@/components/ui/ProgressBar';

// Basic progress bar
<ProgressBar value={75} max={100} />

// Progress bar with label and value
<ProgressBar 
  value={450}
  max={1000}
  label="XP Progress"
  showValue
/>

// Full width progress bar
<ProgressBar 
  value={player.currentXP}
  max={player.nextLevelXP}
  label="Level 5 → Level 6"
  showValue
  className="w-full"
/>
```

**Accessibility**:
- Uses `role="progressbar"` ARIA role
- `aria-valuenow`, `aria-valuemin`, `aria-valuemax` attributes
- `aria-label` for screen reader context
- Visual percentage display for sighted users

---

### Modal

**File**: `components/ui/Modal.tsx`  
**Purpose**: Overlay dialog for focused interactions

**Props**:
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  className?: string;
}
```

**Sizes**:
- **sm**: max-w-md (448px)
- **md**: max-w-lg (512px) - default
- **lg**: max-w-2xl (672px)
- **xl**: max-w-4xl (896px)
- **full**: max-w-[90vw] (90% viewport width)

**Features**:
- Backdrop overlay with blur effect
- Centered positioning
- Close button (X)
- Escape key to close
- Focus trap within modal
- Smooth enter/exit animations

**Usage**:
```tsx
import { Modal } from '@/components/ui/Modal';
import { useState } from 'react';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      
      <Modal 
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Modal Title"
        size="lg"
      >
        <p>Modal content goes here...</p>
        <Button onClick={() => setIsOpen(false)}>Close</Button>
      </Modal>
    </>
  );
}
```

**Accessibility**:
- `role="dialog"` ARIA role
- `aria-modal="true"` attribute
- `aria-labelledby` references title
- Focus trapped within modal
- Escape key closes modal
- Focus returned to trigger element on close
- Overlay click closes modal (configurable)

---

### Tabs

**File**: `components/ui/Tabs.tsx`  
**Purpose**: Navigate between multiple content panels

**Props**:
```typescript
interface Tab {
  id: string;
  label: string;
  content: ReactNode;
  badge?: number;  // Optional badge count
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  className?: string;
}
```

**Features**:
- Horizontal tab navigation
- Active tab indicator
- Optional badge counts
- Smooth content transitions
- Keyboard navigation (arrow keys)

**Usage**:
```tsx
import { Tabs } from '@/components/ui/Tabs';

const tabs = [
  {
    id: 'overview',
    label: 'Overview',
    content: <div>Overview content...</div>
  },
  {
    id: 'details',
    label: 'Details',
    badge: 3,  // Shows "3" badge
    content: <div>Details content...</div>
  },
  {
    id: 'settings',
    label: 'Settings',
    content: <div>Settings content...</div>
  }
];

<Tabs 
  tabs={tabs}
  defaultTab="overview"
  onChange={(tabId) => console.log('Tab changed:', tabId)}
/>
```

**Accessibility**:
- `role="tablist"` on container
- `role="tab"` on each button
- `role="tabpanel"` on content areas
- `aria-selected` indicates active tab
- `aria-controls` links tab to panel
- Keyboard navigation (LEFT/RIGHT arrows, HOME/END)

---

### Select

**File**: `components/ui/Select.tsx`  
**Purpose**: Dropdown selection input

**Props**:
```typescript
interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}
```

**Features**:
- Native `<select>` element (accessible by default)
- Styled to match design system
- Clear focus indicators
- Disabled state styling

**Usage**:
```tsx
import { Select } from '@/components/ui/Select';

const rarityOptions = [
  { value: 'all', label: 'All Rarities' },
  { value: 'common', label: 'Common' },
  { value: 'rare', label: 'Rare' },
  { value: 'epic', label: 'Epic' }
];

<Select 
  options={rarityOptions}
  value={selectedRarity}
  onChange={setSelectedRarity}
  placeholder="Select rarity..."
/>
```

**Accessibility**:
- Uses native `<select>` (best accessibility)
- Associate with `<label>` element
- Clear focus indicators
- Disabled state properly communicated

---

### Input

**File**: `components/ui/Input.tsx`  
**Purpose**: Text input field

**Props**:
```typescript
interface InputProps {
  type?: 'text' | 'number' | 'email' | 'password';
  value?: string | number;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;  // Error message
  fullWidth?: boolean;
  className?: string;
}
```

**Features**:
- Multiple input types
- Error state with message
- Clear focus indicators
- Full width option

**Usage**:
```tsx
import { Input } from '@/components/ui/Input';

// Text input
<Input 
  type="text"
  value={username}
  onChange={setUsername}
  placeholder="Enter username..."
/>

// Number input with error
<Input 
  type="number"
  value={amount}
  onChange={setAmount}
  error={amountError}
  placeholder="Enter amount..."
/>

// Full width input
<Input 
  type="email"
  value={email}
  onChange={setEmail}
  fullWidth
  placeholder="your.email@example.com"
/>
```

**Accessibility**:
- Always use with associated `<label>` element
- Error message uses `aria-describedby`
- Clear focus indicators
- Placeholder supplements but doesn't replace label

---

### Divider

**File**: `components/ui/Divider.tsx`  
**Purpose**: Visual separator between sections

**Props**:
```typescript
interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  spacing?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

**Features**:
- Horizontal or vertical orientation
- Configurable spacing (margin)
- Subtle gray border

**Usage**:
```tsx
import { Divider } from '@/components/ui/Divider';

// Horizontal divider (default)
<section>
  <p>Section 1 content...</p>
  <Divider spacing="md" />
  <p>Section 2 content...</p>
</section>

// Vertical divider
<div className="flex">
  <div>Left content</div>
  <Divider orientation="vertical" />
  <div>Right content</div>
</div>
```

**Accessibility**:
- Purely decorative (uses `aria-hidden="true"`)
- Does not affect document outline or navigation

---

### IconButton

**File**: `components/ui/IconButton.tsx`  
**Purpose**: Button containing only an icon

**Props**:
```typescript
interface IconButtonProps {
  icon: ReactNode;
  label: string;  // Required for accessibility (aria-label)
  onClick?: () => void;
  variant?: 'ghost' | 'primary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}
```

**Features**:
- Circular or square shape
- Multiple variants
- Required accessibility label
- Clear hover/focus states

**Usage**:
```tsx
import { IconButton } from '@/components/ui/IconButton';
import { X, Edit, Trash } from 'lucide-react';

// Close button
<IconButton 
  icon={<X className="h-5 w-5" />}
  label="Close panel"
  variant="ghost"
  onClick={handleClose}
/>

// Edit button
<IconButton 
  icon={<Edit className="h-4 w-4" />}
  label="Edit item"
  variant="primary"
  size="sm"
  onClick={handleEdit}
/>

// Delete button
<IconButton 
  icon={<Trash className="h-4 w-4" />}
  label="Delete item"
  variant="danger"
  onClick={handleDelete}
/>
```

**Accessibility**:
- **CRITICAL**: Always provide `label` prop (becomes `aria-label`)
- Minimum 44px touch target
- Clear focus indicators
- Icon is decorative, label provides context

---

## Animation System

### StaggerChildren

**File**: `components/animations/StaggerChildren.tsx`  
**Purpose**: Animate list items with cascading delays

**Props**:
```typescript
interface StaggerChildrenProps {
  children: ReactNode;
  delay?: number;      // Delay per child (default: 0.1s)
  duration?: number;   // Animation duration (default: 0.3s)
  className?: string;
}
```

**Features**:
- Animates each child element with incremental delay
- FadeIn + SlideUp animation
- GPU-accelerated (transform + opacity)
- Respects `prefers-reduced-motion`

**Usage**:
```tsx
import { StaggerChildren } from '@/components/animations/StaggerChildren';

// Animate list of cards
<StaggerChildren delay={0.05}>
  {items.map(item => (
    <Card key={item.id}>{item.name}</Card>
  ))}
</StaggerChildren>

// Faster cascade
<StaggerChildren delay={0.03} duration={0.2}>
  {achievements.map(achievement => (
    <div key={achievement.id}>{achievement.title}</div>
  ))}
</StaggerChildren>
```

**Performance**:
- Uses `transform` and `opacity` (GPU-accelerated)
- 60fps on mobile devices
- No layout thrashing

---

### LoadingSpinner

**File**: `components/animations/LoadingSpinner.tsx`  
**Purpose**: Indicate loading state

**Props**:
```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;  // Tailwind color class (default: 'text-blue-500')
  className?: string;
}
```

**Sizes**:
- **sm**: 16px (4 units)
- **md**: 24px (6 units) - default
- **lg**: 32px (8 units)

**Usage**:
```tsx
import { LoadingSpinner } from '@/components/animations/LoadingSpinner';

// Default spinner
<LoadingSpinner />

// Large spinner with custom color
<LoadingSpinner size="lg" color="text-green-500" />

// Spinner in button
<Button disabled>
  <LoadingSpinner size="sm" />
  <span>Loading...</span>
</Button>

// Centered spinner
<div className="flex items-center justify-center h-64">
  <LoadingSpinner size="lg" />
</div>
```

**Accessibility**:
- Uses `role="status"` ARIA role
- Includes `aria-live="polite"` for screen readers
- Optional `sr-only` text: "Loading..."

---

### useCountUp

**File**: `components/animations/useCountUp.ts`  
**Purpose**: Animate numbers from 0 to target value

**Signature**:
```typescript
function useCountUp(
  targetValue: number,
  options?: {
    duration?: number;      // Animation duration (ms, default: 2000)
    startValue?: number;    // Starting value (default: 0)
    easing?: (t: number) => number;  // Easing function
  }
): string
```

**Features**:
- Smooth interpolation from start to target
- Configurable duration and easing
- Comma-formatted output (e.g., "1,234")
- Automatically re-animates when target changes

**Usage**:
```tsx
import { useCountUp } from '@/components/animations/useCountUp';

function StatsDisplay({ metalCount }: { metalCount: number }) {
  const metalDisplay = useCountUp(metalCount, { duration: 1000 });
  
  return (
    <StatCard 
      icon={<Coins />}
      label="Metal"
      value={metalDisplay}  // "1,234" (animated)
    />
  );
}

// Custom easing (ease-out cubic)
const customEasing = (t: number) => 1 - Math.pow(1 - t, 3);
const animatedValue = useCountUp(target, { 
  duration: 1500, 
  easing: customEasing 
});
```

**Performance**:
- Uses `requestAnimationFrame` for smooth 60fps
- Cancels animation on unmount (no memory leaks)
- Minimal re-renders (only when target changes)

---

### useIsMobile

**File**: `components/animations/useIsMobile.ts`  
**Purpose**: Detect mobile viewport for responsive behavior

**Signature**:
```typescript
function useIsMobile(breakpoint?: number): boolean
```

**Features**:
- Returns `true` if viewport width ≤ breakpoint (default: 768px)
- Uses `matchMedia` API (performant)
- Updates on window resize
- Cleanup on unmount

**Usage**:
```tsx
import { useIsMobile } from '@/components/animations/useIsMobile';

function ResponsiveComponent() {
  const isMobile = useIsMobile();  // Default: 768px
  const isSmallMobile = useIsMobile(640);  // Custom breakpoint
  
  return (
    <div>
      {isMobile ? (
        <MobileLayout />
      ) : (
        <DesktopLayout />
      )}
    </div>
  );
}

// Conditionally disable animations on mobile
function AnimatedList({ items }: { items: Item[] }) {
  const isMobile = useIsMobile();
  
  return isMobile ? (
    <div>
      {items.map(item => <ItemCard key={item.id} {...item} />)}
    </div>
  ) : (
    <StaggerChildren>
      {items.map(item => <ItemCard key={item.id} {...item} />)}
    </StaggerChildren>
  );
}
```

**Performance**:
- No polling, uses native browser events
- Debounced to prevent excessive re-renders
- SSR-safe (returns `false` during server render)

---

### FadeIn

**File**: `components/animations/FadeIn.tsx`  
**Purpose**: Simple fade-in animation

**Props**:
```typescript
interface FadeInProps {
  children: ReactNode;
  duration?: number;  // Duration in seconds (default: 0.3)
  delay?: number;     // Delay in seconds (default: 0)
  className?: string;
}
```

**Usage**:
```tsx
import { FadeIn } from '@/components/animations/FadeIn';

// Basic fade-in
<FadeIn>
  <Card>Content fades in...</Card>
</FadeIn>

// Delayed fade-in
<FadeIn delay={0.5} duration={0.5}>
  <p>Appears after 0.5s delay</p>
</FadeIn>
```

---

### SlideIn

**File**: `components/animations/SlideIn.tsx`  
**Purpose**: Slide-in animation from edge

**Props**:
```typescript
interface SlideInProps {
  children: ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  duration?: number;
  delay?: number;
  className?: string;
}
```

**Usage**:
```tsx
import { SlideIn } from '@/components/animations/SlideIn';

// Slide from left (default)
<SlideIn>
  <Panel>Slides in from left</Panel>
</SlideIn>

// Slide from bottom
<SlideIn direction="up" duration={0.4}>
  <Modal>Modal slides up from bottom</Modal>
</SlideIn>
```

---

## Utility Functions

### toast

**File**: `utils/toast.ts`  
**Purpose**: Display toast notifications

**Variants**:
```typescript
toast.success(message: string, options?: ToastOptions)
toast.error(message: string, options?: ToastOptions)
toast.info(message: string, options?: ToastOptions)
toast.warning(message: string, options?: ToastOptions)
toast.default(message: string, options?: ToastOptions)
```

**Usage**:
```tsx
import { toast } from '@/utils/toast';

// Success notification
toast.success('Item purchased successfully!');

// Error notification
toast.error('Failed to save changes');

// Info notification
toast.info('New update available');

// Warning notification
toast.warning('Low resources remaining');

// Custom duration
toast.success('Saved!', { duration: 2000 });

// Custom positioning
toast.info('Hello!', { position: 'top-center' });
```

**Features**:
- 5 semantic variants (success, error, info, warning, default)
- Configurable duration and position
- Auto-dismiss functionality
- Stacked notifications
- Accessible (role="alert")

---

## Best Practices

### Component Composition
```tsx
// ✅ GOOD: Compose small, focused components
<Card hover glowColor="blue">
  <div className="flex items-center gap-4">
    <img src={item.image} alt={item.name} />
    <div>
      <h3 className="text-lg font-semibold">{item.name}</h3>
      <Badge variant="success">{item.rarity}</Badge>
    </div>
  </div>
  <Divider spacing="md" />
  <div className="flex justify-between items-center">
    <span className="text-gray-400">${item.price}</span>
    <Button size="sm">Buy Now</Button>
  </div>
</Card>

// ❌ BAD: Monolithic, hard-to-maintain component
<div className="p-6 bg-gray-800 border border-gray-700 rounded-lg hover:shadow-xl transition-all">
  {/* 100+ lines of mixed concerns */}
</div>
```

### Consistent Spacing
```tsx
// ✅ GOOD: Use consistent spacing scale
<div className="space-y-4">  {/* 16px gap between children */}
  <Panel title="Section 1">...</Panel>
  <Panel title="Section 2">...</Panel>
  <Panel title="Section 3">...</Panel>
</div>

// ❌ BAD: Arbitrary spacing values
<div>
  <Panel title="Section 1">...</Panel>
  <div className="mb-3">  {/* 12px */}
  <Panel title="Section 2">...</Panel>
  <div className="mb-5">  {/* 20px */}
  <Panel title="Section 3">...</Panel>
</div>
```

### Semantic HTML
```tsx
// ✅ GOOD: Use semantic elements
<article>
  <header>
    <h2>Article Title</h2>
  </header>
  <main>
    <p>Article content...</p>
  </main>
  <footer>
    <Button>Read More</Button>
  </footer>
</article>

// ❌ BAD: Div soup
<div>
  <div>
    <div>Article Title</div>
  </div>
  <div>
    <div>Article content...</div>
  </div>
  <div>
    <div onClick={handleClick}>Read More</div>
  </div>
</div>
```

### Animation Performance
```tsx
// ✅ GOOD: GPU-accelerated properties (transform, opacity)
<motion.div
  initial={{ opacity: 0, transform: 'translateY(20px)' }}
  animate={{ opacity: 1, transform: 'translateY(0)' }}
>
  Content
</motion.div>

// ❌ BAD: Layout-triggering properties (top, left, height, width)
<motion.div
  initial={{ top: '100px', height: '0px' }}
  animate={{ top: '0px', height: '200px' }}
>
  Content
</motion.div>
```

### Error Boundaries
```tsx
// ✅ GOOD: Wrap independent sections
<main>
  <ErrorBoundary>
    <StatsPanel />
  </ErrorBoundary>
  
  <ErrorBoundary>
    <TileView />
  </ErrorBoundary>
  
  <ErrorBoundary>
    <ControlsPanel />
  </ErrorBoundary>
</main>

// ❌ BAD: Single boundary for entire app (one error crashes everything)
<ErrorBoundary>
  <StatsPanel />
  <TileView />
  <ControlsPanel />
</ErrorBoundary>
```

---

## Accessibility Guidelines

### Keyboard Navigation
- All interactive elements must be keyboard-accessible (TAB, ENTER, SPACE, ESC)
- Tab order must follow visual layout (left-to-right, top-to-bottom)
- Focus indicators must be visible (4:1 contrast minimum)
- No keyboard traps (users can always navigate out)
- Modal dialogs trap focus until closed

### Screen Readers
- Use semantic HTML (`<button>`, `<a>`, `<nav>`, `<main>`, `<header>`, etc.)
- Provide text alternatives for non-text content (alt text, aria-label)
- Use ARIA roles sparingly (only when semantic HTML insufficient)
- Announce dynamic content changes (role="alert", aria-live)
- Associate form labels with inputs (htmlFor, id)

### Color Contrast
- **Body text**: 4.5:1 minimum (18.5:1 achieved with white on gray-900)
- **Large text** (18pt+): 3:1 minimum
- **UI components**: 3:1 minimum (buttons, borders, icons)
- Don't rely on color alone to convey information (use icons + text)

### Touch Targets
- Minimum 44x44 CSS pixels (WCAG 2.5.5 Level AAA)
- All buttons size "md" and larger meet requirement (40px+ height)
- Adequate spacing between touch targets (8px minimum)

### ARIA Best Practices
```tsx
// ✅ GOOD: Use semantic HTML first
<button onClick={handleClick}>Click Me</button>

// ❌ BAD: Unnecessary ARIA
<div role="button" onClick={handleClick}>Click Me</div>

// ✅ GOOD: ARIA when semantic HTML insufficient
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">Modal Title</h2>
</div>

// ✅ GOOD: Icon button with label
<button aria-label="Close panel" onClick={onClose}>
  <X className="h-5 w-5" />
</button>
```

---

## Performance Considerations

### React.memo
Use `React.memo` for components that:
- Receive the same props frequently
- Are expensive to render (complex calculations, large lists)
- Are rendered often (parents re-render frequently)

```tsx
// ✅ GOOD: Memoize expensive component
const ExpensiveList = memo(function ExpensiveList({ items }: { items: Item[] }) {
  // Complex rendering logic
  return (
    <div>
      {items.map(item => <ComplexItem key={item.id} {...item} />)}
    </div>
  );
});

// ❌ BAD: Don't memoize simple components
const SimpleDiv = memo(function SimpleDiv({ text }: { text: string }) {
  return <div>{text}</div>;  // Overhead not worth it
});
```

### useMemo
Use `useMemo` for:
- Expensive calculations
- Array filtering/mapping/sorting
- Object/array creation when passed as props

```tsx
// ✅ GOOD: Memoize expensive calculation
const sortedItems = useMemo(() => {
  return items
    .filter(item => item.rarity === 'epic')
    .sort((a, b) => b.power - a.power);
}, [items]);

// ❌ BAD: Don't memoize simple values
const fullName = useMemo(() => `${first} ${last}`, [first, last]);
// Just use: const fullName = `${first} ${last}`;
```

### useCallback
Use `useCallback` when:
- Passing callbacks to memoized child components
- Callbacks used in dependency arrays
- Callbacks passed to third-party libraries

```tsx
// ✅ GOOD: Stable callback reference
const handleClick = useCallback(() => {
  console.log('Clicked!');
}, []);

<MemoizedChild onClick={handleClick} />

// ❌ BAD: New function every render (breaks memoization)
<MemoizedChild onClick={() => console.log('Clicked!')} />
```

### Bundle Size Optimization
- Tree-shake unused code (import only what you need)
- Lazy load heavy components (React.lazy + Suspense)
- Use production build (minification, dead code elimination)
- Analyze bundle with `next build --analyze`

```tsx
// ✅ GOOD: Tree-shaking friendly
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// ❌ BAD: Imports entire library
import * as UI from '@/components/ui';

// ✅ GOOD: Lazy load modal (heavy component)
const InventoryModal = lazy(() => import('@/components/InventoryPanel'));

<Suspense fallback={<LoadingSpinner />}>
  {showInventory && <InventoryModal />}
</Suspense>
```

---

## Conclusion

This design system provides a solid foundation for building consistent, accessible, and performant user interfaces in the DarkFrame game. By following these guidelines and using the provided components, you'll ensure a cohesive user experience across all game interfaces.

**Key Takeaways:**
1. Use design tokens for consistency
2. Compose components for flexibility
3. Prioritize accessibility (WCAG 2.1 Level AA)
4. Optimize performance (60fps animations, React.memo)
5. Write semantic HTML
6. Test with keyboard and screen readers

**Resources:**
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Framer Motion Documentation](https://www.framer.com/motion/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React Performance](https://react.dev/learn/render-and-commit)

---

**Document Version**: 1.0  
**Last Updated**: January 17, 2025  
**Maintained By**: DarkFrame Development Team  

// END OF DESIGN SYSTEM GUIDE
