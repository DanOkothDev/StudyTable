import logo from "./logo.jpg"; // if your file has another name or type (logo.svg, logo.jpg), change it here, only here

// With a size, the logo is that many pixels tall (width follows its shape).
// Without a size, it fills whatever box it is placed in and keeps its proportions.
export default function Logo({ size, alt = "" }) {
  return (
    <img
      src={logo}
      alt={alt}
      className="logo-img"
      style={
        size ? { height: size, width: "auto", maxWidth: "100%" } : undefined
      }
    />
  );
}
