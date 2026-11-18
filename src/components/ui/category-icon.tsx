import {
  Briefcase, Laptop, Percent, TrendingUp, PiggyBank, ShoppingBag, CirclePlus, House, Utensils, ShoppingCart, Bus,
  Fuel, HeartPulse, GraduationCap, PartyPopper, Repeat, Shirt, Plane, HandHeart, PawPrint, Landmark, HandCoins,
  CircleEllipsis, Circle, Target, Shield, Car, Gift, Baby, Wrench, Smartphone, Zap, Droplets, Wifi, Dumbbell,
  ArrowLeftRight, CreditCard, Receipt, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase, laptop: Laptop, percent: Percent, "trending-up": TrendingUp, "piggy-bank": PiggyBank,
  "shopping-bag": ShoppingBag, "circle-plus": CirclePlus, house: House, utensils: Utensils, "shopping-cart": ShoppingCart,
  bus: Bus, fuel: Fuel, "heart-pulse": HeartPulse, "graduation-cap": GraduationCap, "party-popper": PartyPopper,
  repeat: Repeat, shirt: Shirt, plane: Plane, "hand-heart": HandHeart, "paw-print": PawPrint, landmark: Landmark,
  "hand-coins": HandCoins, "circle-ellipsis": CircleEllipsis, circle: Circle, target: Target, shield: Shield, car: Car,
  gift: Gift, baby: Baby, wrench: Wrench, smartphone: Smartphone, zap: Zap, droplets: Droplets, wifi: Wifi,
  dumbbell: Dumbbell, transfer: ArrowLeftRight, "credit-card": CreditCard, receipt: Receipt,
};

export const ICON_OPTIONS = Object.keys(ICONS);

export function CategoryIcon({
  icon,
  color,
  className,
  size = "md",
}: {
  icon?: string | null;
  color?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = ICONS[icon ?? ""] ?? Circle;
  const c = color ?? "#7A8190";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl",
        size === "sm" ? "size-7 rounded-lg" : size === "lg" ? "size-11" : "size-9",
        className,
      )}
      style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}
    >
      <Icon className={size === "sm" ? "size-3.5" : size === "lg" ? "size-5" : "size-4"} />
    </span>
  );
}
