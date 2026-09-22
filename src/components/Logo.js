import logo from "../assets/medsure-logo.png";

/**
 * MedSure brand mark. The PNG has a transparent background, so it can sit on
 * light or dark surfaces. The name always appears next to it, so it is marked
 * decorative to avoid announcing "MedSure" twice to screen readers.
 */
export default function Logo({ className = "h-10 w-10" }) {
  return <img src={logo} alt="" className={className} draggable={false} />;
}
