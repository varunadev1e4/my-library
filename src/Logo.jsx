export default function Logo({ size = 40 }) {
  return (
    <svg className="logo" viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Varun's Library logo">
      <rect width="64" height="64" rx="14" fill="#1c2b2a" />
      <rect x="13" y="19" width="8" height="29" rx="1.5" fill="#c4531f" />
      <rect x="23" y="12" width="9" height="36" rx="1.5" fill="#eef1ee" />
      <path d="M26.5 12v10l2-1.6 2 1.6V12z" fill="#c4531f" />
      <rect x="34" y="21" width="8" height="27" rx="1.5" fill="#6f9a8b" />
      <rect x="44.5" y="17" width="8" height="31" rx="1.5" fill="#eef1ee" transform="rotate(12 48.5 48)" />
      <rect x="9" y="48" width="46" height="3.5" rx="1.75" fill="#c4531f" />
    </svg>
  );
}
