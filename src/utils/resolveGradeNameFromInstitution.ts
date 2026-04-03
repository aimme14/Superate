/**
 * Resuelve el nombre legible del grado a partir del documento de institución
 * (estructura campuses[].grades[] con { id, name }).
 */
export function resolveGradeNameFromInstitution(
  institution: {
    campuses?: Array<{ id: string; grades?: Array<{ id: string; name?: string }> }>
  },
  campusId: string,
  gradeId: string
): string | undefined {
  const campus = institution.campuses?.find((c) => c.id === campusId)
  const grade = campus?.grades?.find((g) => g.id === gradeId)
  return grade?.name
}
