/**
 * UI Component Library
 * 
 * Barrel export for all UI components
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Central export point for all reusable UI components.
 * Allows clean imports: import { Button, Card } from '@/components/ui'
 */

export { StatCard } from './StatCard';
export { Panel } from './Panel';
export { Button } from './Button';
export { Badge } from './Badge';
export { ProgressBar } from './ProgressBar';
export { Card } from './Card';
export { Skeleton, SkeletonGroup } from './Skeleton';
export { Divider } from './Divider';
export { IconButton } from './IconButton';
export { Input } from './Input';
export { Alert } from './Alert';
export { RichTextEditor } from './RichTextEditor';

// ============================================================
// USAGE:
// ============================================================
// import { Button, Card, StatCard } from '@/components/ui';
// 
// <StatCard label="Power" value={1000} />
// <Button variant="primary">Click Me</Button>
// <Card><p>Content</p></Card>
// ============================================================
// END OF FILE
// ============================================================
