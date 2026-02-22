import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { processCustomStyling } from '../lib/utils/processCustomStyling.js'

describe('processCustomStyling()', () => {
  it('should move themeCustomStyle from themeVariables to course data', () => {
    const courseData = {
      course: {
        data: {
          themeVariables: { themeCustomStyle: '.custom { color: red; }', otherVar: 'val' }
        }
      }
    }
    processCustomStyling(courseData)
    assert.equal(courseData.course.data.themeCustomStyle, '.custom { color: red; }')
    assert.equal(courseData.course.data.themeVariables.themeCustomStyle, undefined)
    assert.equal(courseData.course.data.themeVariables.otherVar, 'val')
  })

  it('should do nothing when themeCustomStyle is falsy', () => {
    const courseData = {
      course: {
        data: {
          themeVariables: { otherVar: 'val' }
        }
      }
    }
    processCustomStyling(courseData)
    assert.equal(courseData.course.data.themeCustomStyle, undefined)
    assert.equal(courseData.course.data.themeVariables.otherVar, 'val')
  })

  it('should do nothing when themeCustomStyle is empty string', () => {
    const courseData = {
      course: {
        data: {
          themeVariables: { themeCustomStyle: '' }
        }
      }
    }
    processCustomStyling(courseData)
    assert.equal(courseData.course.data.themeCustomStyle, undefined)
  })

  it('should delete themeCustomStyle from themeVariables after moving', () => {
    const courseData = {
      course: {
        data: {
          themeVariables: { themeCustomStyle: 'body {}' }
        }
      }
    }
    processCustomStyling(courseData)
    assert.ok(!('themeCustomStyle' in courseData.course.data.themeVariables))
  })

  it('should preserve other course data properties', () => {
    const courseData = {
      course: {
        data: {
          existingProp: 'keep',
          themeVariables: { themeCustomStyle: 'body {}' }
        }
      }
    }
    processCustomStyling(courseData)
    assert.equal(courseData.course.data.existingProp, 'keep')
  })
})
