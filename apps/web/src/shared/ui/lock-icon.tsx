/** Small padlock for view-only notes and fixed rows. */
export function LockIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 20 20" width="14">
      <rect
        height="9"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        width="13"
        x="3.5"
        y="8.5"
      />
      <path
        d="M6.5 8.5 V6.5 a3.5 3.5 0 0 1 7 0 V8.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
