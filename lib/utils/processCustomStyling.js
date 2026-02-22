/**
 * Processes custom styling by moving the themeCustomStyle attribute from
 * themeVariables to the top-level course data
 * @param {Object} courseData The course data object (fwBuild.courseData)
 * @memberof coursetheme
 */
export function processCustomStyling (courseData) {
  const customStyling = courseData.course.data.themeVariables.themeCustomStyle

  if (!customStyling) return

  courseData.course.data.themeCustomStyle = customStyling

  delete courseData.course.data.themeVariables.themeCustomStyle
}
