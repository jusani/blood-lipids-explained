// Lesson 5 only (QA L2): five general drawings of an artery in cross-section, from no plaque to
// narrowed. Never shown next to a person's values. The lesson text says what they show, so the
// drawings themselves are decorative for screen readers.
const STAGES = [0, 5, 10, 16, 23];

export function PlaqueDrawings() {
  return (
    <div class="plaque" aria-hidden="true">
      {STAGES.map((p, i) => (
        <svg key={i} viewBox="0 0 100 100" width="56" height="56">
          <circle cx="50" cy="50" r="44" class="pl-wall" />
          <circle cx="50" cy="50" r="36" class="pl-plaque" />
          <circle cx="50" cy={50 + p / 2} r={36 - p / 2} class="pl-blood" />
        </svg>
      ))}
    </div>
  );
}
