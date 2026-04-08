/** Extract course codes like CSCE 221, MATH 151 from free text */
export function extractCoursesAndProfessors(query: string): string[] {
  const courseRegex = /([A-Z]{2,4})[\s-]?([0-9]{3})/g;
  const matches = [...query.toUpperCase().matchAll(courseRegex)];
  if (!matches || matches.length === 0) return [];
  const courses = matches.map((match) => `${match[1]} ${match[2]}`);
  return [...new Set(courses)];
}
