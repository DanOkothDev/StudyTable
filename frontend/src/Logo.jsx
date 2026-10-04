import logo from './logo.jpg'; // if your file has another name or type (logo.svg, logo.jpg), change it here, only here

export default function Logo({ size = 28, alt = '' }) {
  return <img src={logo} alt={alt} style={{ height: size, width: 'auto', maxWidth: '100%', display: 'block' }} />;
}
