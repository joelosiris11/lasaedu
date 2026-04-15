// Resolves the effective banner image for a section.
// Priority: explicit per-section override → denormalized course image → none.
// Consumers fall back to <CoursePattern courseKey={section.courseId} /> when this
// returns undefined.

export function getSectionBanner(section: {
  image?: string;
  courseImage?: string;
}): string | undefined {
  return section.image || section.courseImage || undefined;
}
