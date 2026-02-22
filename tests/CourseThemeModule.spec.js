import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getVariablesString, processCustomStyling } from '../lib/utils.js'

describe('CourseThemeModule', () => {
  describe('getVariablesString()', () => {
    it('should return an empty string for empty data', () => {
      assert.equal(getVariablesString({}), '')
    })

    it('should generate LESS variable for a simple key-value pair', () => {
      const result = getVariablesString({ color: '#fff' })
      assert.equal(result, '@color: #fff;\n')
    })

    it('should generate multiple LESS variables', () => {
      const result = getVariablesString({ a: '1', b: '2' })
      assert.ok(result.includes('@a: 1;\n'))
      assert.ok(result.includes('@b: 2;\n'))
    })

    it('should recurse into nested objects', () => {
      const result = getVariablesString({
        _colors: { primary: 'red', secondary: 'blue' }
      })
      assert.ok(result.includes('@primary: red;\n'))
      assert.ok(result.includes('@secondary: blue;\n'))
    })

    it('should skip falsy values', () => {
      const result = getVariablesString({ a: '', b: null, c: 'valid' })
      assert.ok(!result.includes('@a:'))
      assert.ok(!result.includes('@b:'))
      assert.ok(result.includes('@c: valid;\n'))
    })

    it('should use the provided variablesStr as initial value', () => {
      const result = getVariablesString({ a: '1' }, '@existing: yes;\n')
      assert.ok(result.startsWith('@existing: yes;\n'))
      assert.ok(result.includes('@a: 1;\n'))
    })

    it('should default data to empty object', () => {
      assert.equal(getVariablesString(), '')
    })
  })

  describe('processCustomStyling()', () => {
    it('should move themeCustomStyle to top-level course data', () => {
      const courseData = {
        course: {
          data: {
            themeVariables: {
              themeCustomStyle: '.custom { color: red; }'
            }
          }
        }
      }
      processCustomStyling(courseData)
      assert.equal(courseData.course.data.themeCustomStyle, '.custom { color: red; }')
      assert.equal(courseData.course.data.themeVariables.themeCustomStyle, undefined)
    })

    it('should do nothing when themeCustomStyle is falsy', () => {
      const courseData = {
        course: {
          data: {
            themeVariables: {}
          }
        }
      }
      processCustomStyling(courseData)
      assert.equal(courseData.course.data.themeCustomStyle, undefined)
    })
  })
})
