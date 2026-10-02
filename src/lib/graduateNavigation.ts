export function jumpToGraduateSection(id: string) {
  const section = document.getElementById(id);
  section?.focus({ preventScroll: true });
  section?.scrollIntoView({ block: 'start', behavior: 'instant' });
}
