import "server-only";
// The same icon set the video draws with (src/video/components/DrawIcon), so a name that passes here renders.
import { icons } from "lucide";

const names = Object.keys(icons);
const lower = new Map(names.map((n) => [n.toLowerCase(), n]));

/** Icons that suit educational explainers (from the prototype). Gemini is told to prefer these. */
export const SUGGESTED_ICONS = [
  "Sun","Moon","Cloud","CloudRain","CloudSnow","CloudLightning","Wind","Snowflake","Thermometer","Droplet","Droplets","Waves",
  "Mountain","MountainSnow","Trees","TreePine","Leaf","Sprout","Flower2","Globe","Earth","Map","Compass","Flame","Zap",
  "Atom","FlaskConical","Microscope","Dna","Magnet","Orbit","Rocket","Telescope","Lightbulb","Brain","Heart","HeartPulse",
  "Activity","Bone","Eye","Ear","Hand","Footprints","Apple","Fish","Bird","Bug","Rabbit","Users","User","Baby",
  "Building2","Factory","House","Landmark","School","Car","Plane","Ship","TrainFront","Bike","Fuel","Battery","Plug",
  "Cpu","Monitor","Smartphone","Wifi","Database","Server","Code","Lock","Shield","Key","Search","Settings","Wrench",
  "Hammer","BookOpen","GraduationCap","PenLine","Calculator","Clock","Hourglass","Calendar","Timer","TrendingUp",
  "TrendingDown","ChartBar","ChartPie","Coins","Banknote","Wallet","PiggyBank","ShoppingCart","Package","Truck",
  "Recycle","RefreshCw","Repeat","ArrowUp","ArrowDown","ArrowRight","Layers","Box","Target","Flag","Trophy","Star",
  "Sparkles","CircleCheck","CircleX","CircleAlert","MessageCircle","Mail","Phone","Camera","Music","Mic","Volume2",
  "Gauge","Scale","Ruler","Puzzle","Shuffle","Link","Network","Share2","Waypoints","Filter","Sunrise","Sunset",
].filter((n) => n in icons);

/** Whatever Gemini wrote → a real lucide icon name. */
export function resolveIcon(name: string | undefined, fallback = "Sparkles"): string {
  if (!name) return fallback;
  if (name in icons) return name;
  const clean = name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (!clean) return fallback;
  if (lower.has(clean)) return lower.get(clean)!;
  return (
    names.find((n) => n.toLowerCase().startsWith(clean)) ?? names.find((n) => n.toLowerCase().includes(clean)) ?? fallback
  );
}
