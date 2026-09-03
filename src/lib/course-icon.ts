/**
 * The icons a course can wear.
 *
 * A fixed list rather than all of lucide. Two reasons: every name here is
 * imported by hand in course-icon.tsx, so the bundle carries a hundred glyphs
 * instead of sixteen hundred, and a stored name that no longer resolves is a
 * broken row rather than a caught error. Adding one means adding it in both
 * places, and the Record in the component fails to compile until you do.
 *
 * Names are lucide's own PascalCase exports, which is what makes the map in
 * the component a straight lookup rather than a translation table.
 */

export interface CourseIconEntry {
  /** The lucide export name, and what lands in the database. */
  name: string
  /** Section heading in the picker. */
  group: string
  /** Extra words the search should match, beyond the name itself. */
  keywords: string
}

/**
 * `as const` rather than a plain array, so `name` keeps its literal type and
 * `CourseIconName` becomes the union of the hundred. That union is what makes
 * the Record in course-icon.tsx fail to compile when the two drift apart.
 * `satisfies` keeps the shape checked despite the widening being turned off.
 */
export const COURSE_ICONS = [
  // Science
  { name: 'Atom', group: 'Science', keywords: 'physics chemistry particle' },
  { name: 'FlaskConical', group: 'Science', keywords: 'chemistry lab beaker' },
  { name: 'TestTube', group: 'Science', keywords: 'chemistry lab sample' },
  { name: 'Microscope', group: 'Science', keywords: 'biology lab cells' },
  { name: 'Dna', group: 'Science', keywords: 'biology genetics genome' },
  { name: 'Telescope', group: 'Science', keywords: 'astronomy space stars' },
  { name: 'Orbit', group: 'Science', keywords: 'astronomy planets space' },
  { name: 'Rocket', group: 'Science', keywords: 'space launch aerospace' },
  { name: 'Magnet', group: 'Science', keywords: 'physics magnetism force' },
  { name: 'Brain', group: 'Science', keywords: 'psychology neuroscience mind' },
  { name: 'Bone', group: 'Science', keywords: 'anatomy skeleton biology' },
  { name: 'Bug', group: 'Science', keywords: 'entomology insect debug' },
  { name: 'Leaf', group: 'Science', keywords: 'botany plants ecology' },

  // Math and computing
  { name: 'Calculator', group: 'Math', keywords: 'arithmetic numbers count' },
  { name: 'Sigma', group: 'Math', keywords: 'sum series statistics' },
  { name: 'Infinity', group: 'Math', keywords: 'calculus limits endless' },
  { name: 'Percent', group: 'Math', keywords: 'ratio proportion stats' },
  { name: 'Hash', group: 'Math', keywords: 'number count tag' },
  { name: 'Binary', group: 'Math', keywords: 'computing bits logic' },
  { name: 'Code', group: 'Math', keywords: 'programming software dev' },
  { name: 'Braces', group: 'Math', keywords: 'programming syntax json' },
  { name: 'Terminal', group: 'Math', keywords: 'shell console command' },
  { name: 'Cpu', group: 'Math', keywords: 'hardware processor chip' },
  { name: 'Database', group: 'Math', keywords: 'sql storage records' },
  { name: 'Server', group: 'Math', keywords: 'backend hosting infra' },
  { name: 'Network', group: 'Math', keywords: 'graph nodes topology' },

  // Words and society
  { name: 'BookOpen', group: 'Humanities', keywords: 'reading literature' },
  { name: 'Book', group: 'Humanities', keywords: 'reading text novel' },
  { name: 'BookMarked', group: 'Humanities', keywords: 'reference textbook' },
  { name: 'Library', group: 'Humanities', keywords: 'books research shelf' },
  { name: 'ScrollText', group: 'Humanities', keywords: 'history classics' },
  { name: 'Feather', group: 'Humanities', keywords: 'writing poetry essay' },
  { name: 'Languages', group: 'Humanities', keywords: 'translation spanish' },
  { name: 'Globe', group: 'Humanities', keywords: 'geography world global' },
  { name: 'Landmark', group: 'Humanities', keywords: 'history government' },
  { name: 'Scale', group: 'Humanities', keywords: 'law ethics justice' },
  { name: 'Gavel', group: 'Humanities', keywords: 'law court judge' },
  { name: 'Speech', group: 'Humanities', keywords: 'debate rhetoric talk' },
  { name: 'Newspaper', group: 'Humanities', keywords: 'journalism media' },

  // Arts
  { name: 'Palette', group: 'Arts', keywords: 'painting color design' },
  { name: 'Brush', group: 'Arts', keywords: 'painting drawing studio' },
  { name: 'Music', group: 'Arts', keywords: 'band choir theory' },
  { name: 'Guitar', group: 'Arts', keywords: 'music strings band' },
  { name: 'Piano', group: 'Arts', keywords: 'music keys recital' },
  { name: 'Drama', group: 'Arts', keywords: 'theatre acting masks' },
  { name: 'Camera', group: 'Arts', keywords: 'photography photo studio' },
  { name: 'Film', group: 'Arts', keywords: 'cinema movies media' },
  { name: 'Clapperboard', group: 'Arts', keywords: 'film production video' },
  { name: 'Mic', group: 'Arts', keywords: 'audio recording podcast' },
  { name: 'Headphones', group: 'Arts', keywords: 'audio listening sound' },

  // Business
  { name: 'Briefcase', group: 'Business', keywords: 'work career office' },
  { name: 'TrendingUp', group: 'Business', keywords: 'economics growth' },
  { name: 'PieChart', group: 'Business', keywords: 'statistics data share' },
  { name: 'LineChart', group: 'Business', keywords: 'statistics data trend' },
  { name: 'DollarSign', group: 'Business', keywords: 'finance money econ' },
  { name: 'Coins', group: 'Business', keywords: 'finance money accounting' },
  { name: 'Building2', group: 'Business', keywords: 'management corporate' },
  { name: 'Handshake', group: 'Business', keywords: 'negotiation deal' },
  { name: 'Target', group: 'Business', keywords: 'marketing goals strategy' },
  { name: 'Presentation', group: 'Business', keywords: 'slides talk pitch' },

  // Making
  { name: 'Wrench', group: 'Making', keywords: 'engineering repair tools' },
  { name: 'Hammer', group: 'Making', keywords: 'shop woodwork build' },
  { name: 'Cog', group: 'Making', keywords: 'mechanical gears systems' },
  { name: 'Ruler', group: 'Making', keywords: 'drafting measure geometry' },
  { name: 'DraftingCompass', group: 'Making', keywords: 'drafting geometry' },
  { name: 'HardHat', group: 'Making', keywords: 'construction civil safety' },
  { name: 'Zap', group: 'Making', keywords: 'electrical power circuits' },
  { name: 'Lightbulb', group: 'Making', keywords: 'ideas innovation design' },
  { name: 'CircuitBoard', group: 'Making', keywords: 'electronics hardware' },
  { name: 'Blocks', group: 'Making', keywords: 'building modular design' },
  { name: 'Puzzle', group: 'Making', keywords: 'logic problems solving' },

  // Body and sport
  { name: 'Dumbbell', group: 'Health', keywords: 'gym fitness pe workout' },
  { name: 'Bike', group: 'Health', keywords: 'cycling sport commute' },
  { name: 'Trophy', group: 'Health', keywords: 'competition award win' },
  { name: 'Medal', group: 'Health', keywords: 'award sport achievement' },
  { name: 'Volleyball', group: 'Health', keywords: 'sport team pe game' },
  { name: 'HeartPulse', group: 'Health', keywords: 'medicine nursing vitals' },
  { name: 'Stethoscope', group: 'Health', keywords: 'medicine nursing clinic' },

  // School
  { name: 'GraduationCap', group: 'School', keywords: 'degree college grad' },
  { name: 'School', group: 'School', keywords: 'campus class building' },
  { name: 'Backpack', group: 'School', keywords: 'bag student supplies' },
  { name: 'Pencil', group: 'School', keywords: 'writing notes draft' },
  { name: 'NotebookPen', group: 'School', keywords: 'notes journal writing' },
  { name: 'ClipboardList', group: 'School', keywords: 'tasks checklist todo' },
  { name: 'FileText', group: 'School', keywords: 'paper essay document' },
  { name: 'Calendar', group: 'School', keywords: 'schedule dates term' },
  { name: 'Clock', group: 'School', keywords: 'time deadline hours' },
  { name: 'Star', group: 'School', keywords: 'favorite important grade' },
  { name: 'Bookmark', group: 'School', keywords: 'saved reference mark' },

  // Life
  { name: 'Home', group: 'Life', keywords: 'house personal chores' },
  { name: 'Coffee', group: 'Life', keywords: 'break cafe morning' },
  { name: 'Utensils', group: 'Life', keywords: 'food cooking meals' },
  { name: 'Car', group: 'Life', keywords: 'driving commute travel' },
  { name: 'Plane', group: 'Life', keywords: 'travel flight trip' },
  { name: 'Wallet', group: 'Life', keywords: 'budget money personal' },
  { name: 'ShoppingCart', group: 'Life', keywords: 'errands groceries buy' },
  { name: 'Users', group: 'Life', keywords: 'group team club social' },
  { name: 'Phone', group: 'Life', keywords: 'call contact reach' },
  { name: 'Mail', group: 'Life', keywords: 'email message inbox' },
  { name: 'Sun', group: 'Life', keywords: 'weather day summer' },
] as const satisfies readonly CourseIconEntry[]

/** The union of every name a course may store. */
export type CourseIconName = (typeof COURSE_ICONS)[number]['name']

/** Every valid stored value, for the zod enum on the server. */
export const COURSE_ICON_NAMES = COURSE_ICONS.map(
  (icon) => icon.name,
) as CourseIconName[]

/** The order the picker draws its sections in. */
export const COURSE_ICON_GROUPS = [
  ...new Set(COURSE_ICONS.map((icon) => icon.group)),
]

/**
 * Splits a PascalCase export into words, so `FlaskConical` reads as "Flask
 * Conical" in a label and matches a search for "flask".
 */
export function iconLabel(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
}

/** Name and keywords both, matched case insensitively on every term. */
export function searchIcons(query: string): readonly CourseIconEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return COURSE_ICONS

  return COURSE_ICONS.filter((icon) => {
    const haystack =
      `${iconLabel(icon.name)} ${icon.group} ${icon.keywords}`.toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}
