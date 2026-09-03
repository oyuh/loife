import type { LucideIcon } from 'lucide-react'
import {
  Atom,
  Backpack,
  Bike,
  Binary,
  Blocks,
  Bone,
  Book,
  BookMarked,
  Bookmark,
  BookOpen,
  Braces,
  Brain,
  Briefcase,
  Brush,
  Bug,
  Building2,
  Calculator,
  Calendar,
  Camera,
  Car,
  CircuitBoard,
  Clapperboard,
  ClipboardList,
  Clock,
  Code,
  Coffee,
  Cog,
  Coins,
  Cpu,
  Database,
  Dna,
  DollarSign,
  DraftingCompass,
  Drama,
  Dumbbell,
  Feather,
  FileText,
  Film,
  FlaskConical,
  Gavel,
  Globe,
  GraduationCap,
  Guitar,
  Hammer,
  Handshake,
  HardHat,
  Hash,
  Headphones,
  HeartPulse,
  Home,
  // Aliased: the export shadows the global of the same name.
  Infinity as InfinityIcon,
  Landmark,
  Languages,
  Leaf,
  Library,
  Lightbulb,
  LineChart,
  Magnet,
  Mail,
  Medal,
  Mic,
  Microscope,
  Music,
  Network,
  Newspaper,
  NotebookPen,
  Orbit,
  Palette,
  Pencil,
  Percent,
  Phone,
  Piano,
  PieChart,
  Plane,
  Presentation,
  Puzzle,
  Rocket,
  Ruler,
  Scale,
  School,
  ScrollText,
  Server,
  ShoppingCart,
  Sigma,
  Speech,
  Star,
  Stethoscope,
  Sun,
  Target,
  Telescope,
  Terminal,
  TestTube,
  TrendingUp,
  Trophy,
  Users,
  Utensils,
  Volleyball,
  Wallet,
  Wrench,
  Zap,
} from 'lucide-react'
import type { CourseIconName } from '#/lib/course-icon'
import { cn } from '#/lib/utils'

/**
 * Every icon a course may wear, imported by name.
 *
 * The hundred imports are the point. A dynamic `lucide-react/dist/esm/icons/${name}`
 * would be shorter and would defeat tree shaking, pulling the whole set into
 * the bundle. Typing the map against the catalogue means dropping an icon from
 * one list and not the other fails the build rather than rendering a hole.
 */
const ICONS: Record<CourseIconName, LucideIcon> = {
  Atom,
  FlaskConical,
  TestTube,
  Microscope,
  Dna,
  Telescope,
  Orbit,
  Rocket,
  Magnet,
  Brain,
  Bone,
  Bug,
  Leaf,
  Calculator,
  Sigma,
  Infinity: InfinityIcon,
  Percent,
  Hash,
  Binary,
  Code,
  Braces,
  Terminal,
  Cpu,
  Database,
  Server,
  Network,
  BookOpen,
  Book,
  BookMarked,
  Library,
  ScrollText,
  Feather,
  Languages,
  Globe,
  Landmark,
  Scale,
  Gavel,
  Speech,
  Newspaper,
  Palette,
  Brush,
  Music,
  Guitar,
  Piano,
  Drama,
  Camera,
  Film,
  Clapperboard,
  Mic,
  Headphones,
  Briefcase,
  TrendingUp,
  PieChart,
  LineChart,
  DollarSign,
  Coins,
  Building2,
  Handshake,
  Target,
  Presentation,
  Wrench,
  Hammer,
  Cog,
  Ruler,
  DraftingCompass,
  HardHat,
  Zap,
  Lightbulb,
  CircuitBoard,
  Blocks,
  Puzzle,
  Dumbbell,
  Bike,
  Trophy,
  Medal,
  Volleyball,
  HeartPulse,
  Stethoscope,
  GraduationCap,
  School,
  Backpack,
  Pencil,
  NotebookPen,
  ClipboardList,
  FileText,
  Calendar,
  Clock,
  Star,
  Bookmark,
  Home,
  Coffee,
  Utensils,
  Car,
  Plane,
  Wallet,
  ShoppingCart,
  Users,
  Phone,
  Mail,
  Sun,
}

/** Whether a stored name still resolves, used to fall back to a plain dot. */
export function hasCourseIcon(name: string | null | undefined): boolean {
  return Boolean(name && name in ICONS)
}

/** Narrows a stored string, which may predate a rename, to a drawable icon. */
function resolve(name: string | null | undefined): LucideIcon | undefined {
  if (!name) return undefined
  return ICONS[name as CourseIconName]
}

/**
 * A course's icon in its course colour, or nothing when it has neither.
 *
 * Returns null rather than a placeholder so callers can decide what an
 * icon-less course looks like. The lists fall back to the colour bar they
 * already drew before icons existed.
 */
export function CourseIcon({
  name,
  color,
  className,
}: {
  name: string | null | undefined
  color?: string | null
  className?: string
}) {
  const Icon = resolve(name)
  if (!Icon) return null

  return (
    <Icon
      aria-hidden="true"
      className={cn('size-4 shrink-0', className)}
      style={{ color: color ?? 'var(--primary)' }}
    />
  )
}

/**
 * The mark that stands for a course: its icon when it has one, a dot in its
 * colour when it does not.
 *
 * One component because a dozen lists were each drawing their own dot, and
 * once a course can carry an icon they all have to make the same choice. An
 * item with no course passes nothing and keeps whatever `dotClassName` says,
 * which is how the neutral dots stay neutral.
 */
export function CourseMark({
  color,
  icon,
  className,
  dotClassName,
}: {
  color?: string | null
  icon?: string | null
  /** Sizing for the icon. */
  className?: string
  /** Sizing and shape for the dot, including its colour when there is none. */
  dotClassName?: string
}) {
  if (hasCourseIcon(icon)) {
    return <CourseIcon className={className} color={color} name={icon} />
  }

  return (
    <span
      aria-hidden="true"
      className={cn('shrink-0 rounded-full', dotClassName)}
      // Beats the class when the course has a colour, and leaves the class to
      // decide when it does not.
      style={color ? { backgroundColor: color } : undefined}
    />
  )
}
