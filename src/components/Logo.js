import logo from "../assets/medsure-logo.png";

export default function Logo({ className = "h-10 w-10" }) {
  return <img src={logo} alt="" className={className} draggable={false} />;
}
