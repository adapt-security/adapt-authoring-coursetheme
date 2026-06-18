/**
 * Processes custom styling by moving the themeCustomStyle attribute from
 * themeVariables to the top-level course data
 * @param {Object} courseData The course data object (fwBuild.courseData)
 * @param {Object} variables The theme variables object
 * @memberof coursetheme
 */
export function processCustomStyling (courseData, variables) {
  const customStyling = variables?.themeCustomStyle

  if (!customStyling) return

  courseData.course.data.themeCustomStyle = customStyling

  delete variables.themeCustomStyle
}
